Task Document – Full Stack AI Document Consolidation System
Objective
Build a Full Stack AI-powered Document Consolidation Application that:
●
Accepts multiple file formats (PDF, Excel, ZIP, images, etc.)
●
Extracts structured data using OCR + LLM
●
Normalizes different document formats into a single schema
●
Stores structured output in a database
●
Allows export as Excel
●
(Optional) Displays KPI dashboard
This task tests:
●
Full-stack engineering
●
LLM integration
●
OCR + document parsing
●
Database modeling
●
System architecture thinking
Mandatory Technical Stack
GitHub
●
Each developer must use their own personal GitHub account
●
Repository must be public
●
Submit:
○
GitHub repo link
○
Hosted link (if deployed)
○
OR screen recording demo (if local only)
Frontend
●
ReactJS
●
Must include:
○
File upload page (drag & drop preferred)
○
File type validation
○
Upload progress indicator
○
Data preview page
○
Download as Excel button
Optional:
●
KPI Dashboard (Charts, summary cards)
Deployment options:
●
Vercel
●
Netlify
●
Any free hosting
Backend
●
Python FastAPI
●
Responsibilities:
○
Accept file uploads
○
Extract text using OCR
○
Process text using Groq LLM/HiggingFace API
○
Structure into JSON schema
○
Store in DB
○
Provide Excel export endpoint
Hosting options:
●
Render (free tier)
●
Railway
●
Fly.io
●
Local execution acceptable
Database
●
Preferably Supabase (free plan) → PostgreSQL
●
OR local PostgreSQL
●
Proper schema design required
Domain Options (Choose One)
You must choose ONE domain below and build complete consolidation logic.
Option 1 – HR Timesheet Consolidation
Scenario
Company receives timesheets from multiple contractors in:
●
Excel
●
PDF
●
Scanned images
●
ZIP containing multiple files
Example Data Variations
Excel Format A | Employee Name | Week | Hours | Project |
PDF Format B Employee: John Project: ABC Week: 12 Mon – 8h Tue – 7h
Image Format C Scanned printed sheet
Final Unified Schema
employee_name
employee_id
project_name
week_number
total_hours
source_file
uploaded_date
Option 2 – Invoice Consolidation
Sources
●
Vendor PDF invoices
●
Excel invoice sheets
●
Scanned handwritten invoices
●
ZIP folder from finance
Example Differences
Vendor A: Invoice No, Date, Amount, GST
Vendor B: Bill Number, Issue Date, Total
Final Schema
invoice_number
vendor_name
invoice_date
amount
tax_amount
total_amount
payment_status
source_file
Option 3 – Purchase Orders
Multiple suppliers sending:
●
PDF
●
Excel
●
Email-exported documents
●
Zipped archives
Final Schema Example:
po_number
vendor_name
item_name
quantity
unit_price
total_price
order_date
delivery_date
Option 4 – CRM Deals Consolidation
Data from:
●
HubSpot export (CSV)
●
Sales Excel sheet
●
PDF reports
●
Scanned contracts
Final Schema Example:
deal_id
client_name
deal_value
stage
closing_probability
owner
expected_close_date
Option 5 – Employee Churn Dataset
Multiple HR systems:
●
Exit interview PDFs
●
HR Excel sheets
●
Performance review PDFs
●
Zipped HR data
Final Schema:
employee_id
joining_date
exit_date
department
last_performance_rating
salary
exit_reason
churn_flag
Processing Requirements
Step 1 – Upload
●
React page must support:
○
PDF
○
Excel
○
CSV
○
JPG/PNG
○
ZIP
Step 2 – OCR
Use any of:
●
Tesseract
●
EasyOCR
●
Free cloud OCR APIs
Cloud free options allowed.
Step 3 – LLM Structuring (Mandatory)
Use Groq Cloud LLMs
Flow:
1.
Extract raw text
2.
Send to Groq LLM
3.
Prompt it to:
○
Extract structured fields
○
Normalize field names
○
Return JSON
Example Prompt:
Extract invoice details and return strictly valid JSON with keys: invoice_number, vendor_name, amount, invoice_date
Must handle:
●
Different formats
●
Missing fields
●
Field name variations
Step 4 – Database Storage
●
Store structured data
●
Include:
○
source_file
○
upload_timestamp
○
processing_status
Step 5 – Export to Excel
Backend must provide:
GET /export
Download structured consolidated data as Excel.
Optional – KPI Dashboard
React dashboard with:
Examples:
HR Timesheet
●
Total hours per project
●
Top contributors
●
Weekly utilization %
Invoice
●
Total outstanding amount
●
Vendor distribution
●
Monthly revenue
CRM
●
Total pipeline value
●
Conversion rate
●
Stage distribution
Use:
●
Chart.js
●
Recharts
●
Any library
🏗 Architecture Expectations
Your README must include:
1.
Architecture diagram
2.
Processing flow explanation
3.
LLM prompt strategy
4.
Database schema
5.
Challenges faced
6.
Cost estimation if scaled
Hosting Instructions
Allowed options:
Frontend:
●
Vercel
●
Netlify
Backend:
●
Render
●
Railway
●
Fly.io
Database:
●
Supabase Free
OR fully local setup.
Submission Requirements
You must submit:
GitHub repository link Hosted link (if deployed) OR Screen recording demo (5–8 minutes)
Demo must show:
●
Upload multiple file formats
●
Processing
●
Structured output
●
DB entry
●
Excel export