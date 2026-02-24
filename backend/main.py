import os
import json
import re
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
    validation_status: str = None
    is_confirmed: bool = None


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

    print('\n--- RAW EXTRACTED TEXT ---')
    print(text)
    return text.strip()


def process_with_llm(text: str) -> list:
    prompt = """
    You are a data recovery assistant. Extract a JSON ARRAY of employees from the text.

    CRITICAL RULES FOR employee_id AND validation_status:
    - validation_status is ONLY about the employee_id column. It has NOTHING to do with other fields like salary, rating, or department.
    - If a row has an employee_id present in the original data, set validation_status to "verified" NO MATTER WHAT. Even if other fields are missing or weird.
    - If a row has a BLANK/EMPTY employee_id but you can infer it from a numerical pattern in surrounding rows (e.g., rows have EMP-1001, [blank], EMP-1003, so the blank is EMP-1002), set the guessed ID and set validation_status to "guess".
    - If a row has a BLANK/EMPTY employee_id and you CANNOT guess it, set employee_id to null and validation_status to "error".
    - NEVER set a row to "error" or "guess" if the original data already contains an employee_id for that row.

    OTHER RULES:
    - Even if columns are named differently (e.g., "Pay" instead of "Salary"), map them semantically.
    - If you see 13-digit numbers like 1673740800000, these are Unix timestamps; convert them to YYYY-MM-DD.
    - If a salary is a non-numeric string like "Competitive", return null for salary.
    - Output ONLY a raw JSON array. Start with [ and end with ].

    Each object in the array must match this schema:
    - "employee_id" (string, or null if missing and unguessable)
    - "joining_date" (string, format YYYY-MM-DD, or null if missing)
    - "exit_date" (string, format YYYY-MM-DD, or null if missing)
    - "department" (string, or null if missing)
    - "last_performance_rating" (string, or null if missing)
    - "salary" (float, or null if missing, strip any currency symbols and commas)
    - "exit_reason" (string, or null if missing)
    - "churn_flag" (boolean, true if the employee has exited, false otherwise)
    - "validation_status" (string, ONLY about employee_id: "verified" if ID was in the original data, "guess" if you inferred it, "error" if ID is blank and unguessable)

    Text to process:
    """ + text

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a data recovery assistant. Extract employees into a JSON array. CRITICAL: validation_status is ONLY about the employee_id column. If a row already has an employee_id in the source data, validation_status MUST be verified, even if other fields like salary or rating are missing. Only set guess if the employee_id was blank and you inferred it from a pattern. Only set error if the employee_id was blank and you could not guess it. Output ONLY a raw JSON array starting with [ and ending with ]. No text before or after."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1024,
        )

        response_content = completion.choices[0].message.content.strip()
        print('\n--- RAW LLM RESPONSE ---')
        print(response_content)

        if response_content.startswith("```json"):
            response_content = response_content.replace("```json", "", 1)
        if response_content.endswith("```"):
            response_content = response_content[: -3]

        match = re.search(r'\[.*\]', response_content, re.DOTALL)
        if match:
            response_content = match.group(0)

        parsed_data = json.loads(response_content.strip())

        if isinstance(parsed_data, dict):
            return [parsed_data]

        return parsed_data

    except Exception as e:
        print(f'\n--- JSON PARSE ERROR ---\n{str(e)}')
        return []


def safe_parse_date(date_str):
    if not date_str or date_str.lower() in ['none', 'null']:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def safe_parse_salary(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
        try:
            return float(value.replace(",", "").replace("$", ""))
        except (ValueError, TypeError):
            return None
    return None


def safe_parse_rating(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
    return str(value)


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

            if not structured_data:
                raise ValueError("LLM could not extract any valid employee data")

            for emp_data in structured_data:
                try:
                    validation_status = emp_data.get("validation_status", "verified")
                    is_confirmed = validation_status not in ["error", "guess"]

                    if validation_status == "error":
                        emp_id = "MISSING"
                    elif not emp_data.get("employee_id"):
                        emp_id = "MISSING"
                        validation_status = "error"
                        is_confirmed = False
                    else:
                        emp_id = str(emp_data.get("employee_id"))

                    try:
                        salary = float(str(emp_data.get("salary")).replace("$", "").replace(",", ""))
                    except (ValueError, TypeError):
                        salary = None

                    db_record = models.EmployeeChurn(
                        employee_id=emp_id,
                        joining_date=safe_parse_date(emp_data.get("joining_date")),
                        exit_date=safe_parse_date(emp_data.get("exit_date")),
                        department=emp_data.get("department"),
                        last_performance_rating=safe_parse_rating(emp_data.get("last_performance_rating")),
                        salary=salary,
                        exit_reason=emp_data.get("exit_reason"),
                        churn_flag=bool(emp_data.get("churn_flag", False)),
                        validation_status=validation_status,
                        is_confirmed=is_confirmed,
                        source_file=file.filename,
                        processing_status="COMPLETED"
                    )

                    db.add(db_record)

                except Exception as e:
                    print(f'\n--- ROW INSERT ERROR ---\n{str(e)}')
                    error_record = models.EmployeeChurn(
                        employee_id="ERROR",
                        source_file=file.filename,
                        processing_status="FAILED",
                        exit_reason=str(e)[:255]
                    )
                    db.add(error_record)

            db.commit()

            results.append({
                "filename": file.filename,
                "status": "success",
                "employees_processed": len(structured_data)
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
    if update_data.validation_status is not None:
        record.validation_status = update_data.validation_status
    if update_data.is_confirmed is not None:
        record.is_confirmed = update_data.is_confirmed
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
