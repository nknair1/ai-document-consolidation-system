import os
import json
import io
import pandas as pd
import pdfplumber
import easyocr
import numpy as np
from PIL import Image
from groq import Groq
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv
from pydantic import BaseModel

import models
from database import engine, get_db

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Employee Churn API",
    description="Backend for Document Consolidation System (Option 5)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
reader = easyocr.Reader(['en'], gpu=False)


class ChatRequest(BaseModel):
    question: str
    data: list


class UpdateRecord(BaseModel):
    employee_id: str = None
    department: str = None
    exit_reason: str = None
    salary: float = None


def extract_text(file_content: bytes, filename: str) -> str:
    ext = filename.lower().split('.')[-1]
    text = ""

    try:
        if ext == 'pdf':
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        elif ext in ['csv']:
            df = pd.read_csv(io.BytesIO(file_content))
            text = df.to_json(orient='records')
        elif ext in ['xls', 'xlsx']:
            df = pd.read_excel(io.BytesIO(file_content))
            text = df.to_json(orient='records')
        elif ext in ['jpg', 'jpeg', 'png']:
            img = Image.open(io.BytesIO(file_content))
            img_np = np.array(img)
            result = reader.readtext(img_np)
            for _, extracted_text, _ in result:
                text += extracted_text + " "
        else:
            raise ValueError(f"Unsupported file extension: {ext}")

    except Exception as e:
        print(f"Error extracting text from {filename}: {str(e)}")
        raise

    return text.strip()


def process_with_llm(text: str) -> dict:
    prompt = """
    You are an expert HR data extractor. 
    Extract the following structured information from the provided text and return ONLY a raw, valid JSON object matching this schema. Do not include any markdown formatting, explanations, or code blocks. Just the raw JSON.
    
    Required JSON keys:
    - "employee_id" (string)
    - "joining_date" (string, format YYYY-MM-DD, or null if missing)
    - "exit_date" (string, format YYYY-MM-DD, or null if missing)
    - "department" (string, or null if missing)
    - "last_performance_rating" (string, or null if missing)
    - "salary" (float, or null if missing, strip any currency symbols and commas)
    - "exit_reason" (string, or null if missing)
    - "churn_flag" (boolean, true if the employee has exited, false otherwise)
    
    Text to process:
    """ + text

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You output only valid JSON. No markdown."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1024,
        )

        response_content = completion.choices[0].message.content.strip()

        if response_content.startswith("```json"):
            response_content = response_content.replace("```json", "", 1)
        if response_content.endswith("```"):
            response_content = response_content[: -3]

        parsed_data = json.loads(response_content.strip())
        return parsed_data

    except Exception as e:
        print(f"Error processing with LLM: {str(e)}")
        return {}


def safe_parse_date(date_str):
    if not date_str or date_str.lower() in ['none', 'null']:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


@app.get("/")
def read_root():
    return {"message": "Welcome to the Employee Churn Document Consolidation API"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {"status": "healthy", "database": "connected"}


@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    results = []

    for file in files:
        try:
            content = await file.read()

            raw_text = extract_text(content, file.filename)
            if not raw_text:
                raise ValueError("Could not extract any text from the file")

            structured_data = process_with_llm(raw_text)

            if not structured_data.get("employee_id"):
                raise ValueError("LLM could not extract a valid employee_id")

            db_record = models.EmployeeChurn(
                employee_id=str(structured_data.get("employee_id", "UNKNOWN")),
                joining_date=safe_parse_date(structured_data.get("joining_date")),
                exit_date=safe_parse_date(structured_data.get("exit_date")),
                department=structured_data.get("department"),
                last_performance_rating=structured_data.get("last_performance_rating"),
                salary=float(structured_data.get("salary")) if structured_data.get("salary") is not None else None,
                exit_reason=structured_data.get("exit_reason"),
                churn_flag=bool(structured_data.get("churn_flag", False)),
                source_file=file.filename,
                processing_status="COMPLETED"
            )

            db.add(db_record)
            db.commit()
            db.refresh(db_record)

            results.append({
                "filename": file.filename,
                "status": "success",
                "record_id": db_record.id
            })

        except Exception as e:
            db.rollback()

            error_record = models.EmployeeChurn(
                employee_id="ERROR",
                source_file=file.filename,
                processing_status="FAILED",
                exit_reason=str(e)[:255]
            )
            db.add(error_record)
            try:
                db.commit()
            except:
                db.rollback()

            results.append({
                "filename": file.filename,
                "status": "failed",
                "error": str(e)
            })

    return {"message": "Processing complete", "results": results}


@app.get("/export")
def export_data(db: Session = Depends(get_db)):
    records = db.query(models.EmployeeChurn).all()

    data = []
    for record in records:
        row = {column.name: getattr(record, column.name) for column in models.EmployeeChurn.__table__.columns}
        data.append(row)

    df = pd.DataFrame(data)

    for col in df.select_dtypes(['datetimetz']).columns:
        df[col] = df[col].dt.tz_localize(None)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Sheet1')

    headers = {
        'Content-Disposition': 'attachment; filename="consolidated_data.xlsx"'
    }

    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@app.get("/api/churn-data")
def get_churn_data(db: Session = Depends(get_db)):
    records = db.query(models.EmployeeChurn).all()

    data = []
    for record in records:
        row = {column.name: getattr(record, column.name) for column in models.EmployeeChurn.__table__.columns}
        if row.get("joining_date"):
            row["joining_date"] = str(row["joining_date"])
        if row.get("exit_date"):
            row["exit_date"] = str(row["exit_date"])
        if row.get("upload_timestamp"):
            row["upload_timestamp"] = str(row["upload_timestamp"])
        data.append(row)

    return data


@app.delete("/api/churn-data/{record_id}")
def delete_churn_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.EmployeeChurn).filter(models.EmployeeChurn.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()
    return {"message": "Record deleted successfully", "record_id": record_id}


@app.put("/api/churn-data/{record_id}")
def update_churn_record(record_id: int, update_data: UpdateRecord, db: Session = Depends(get_db)):
    record = db.query(models.EmployeeChurn).filter(models.EmployeeChurn.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if update_data.employee_id is not None:
        record.employee_id = update_data.employee_id
    if update_data.department is not None:
        record.department = update_data.department
    if update_data.exit_reason is not None:
        record.exit_reason = update_data.exit_reason
    if update_data.salary is not None:
        record.salary = update_data.salary
    db.commit()
    db.refresh(record)
    return {"message": "Record updated successfully", "record_id": record_id}


@app.post("/api/chat")
def chat_with_data(request: ChatRequest):
    data_str = json.dumps(request.data)
    completion = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You are a senior HR data analyst. Answer questions strictly based on the provided JSON data. Do not make up information or use external knowledge. Be precise and data-driven in your responses."
            },
            {
                "role": "user",
                "content": f"Here is the HR data in JSON format:\n{data_str}\n\nQuestion: {request.question}"
            }
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    return {"response": completion.choices[0].message.content}
