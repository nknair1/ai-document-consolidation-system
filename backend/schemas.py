from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

class EmployeeChurnBase(BaseModel):
    employee_id: str
    joining_date: Optional[date] = None
    exit_date: Optional[date] = None
    department: Optional[str] = None
    last_performance_rating: Optional[str] = None
    salary: Optional[float] = None
    exit_reason: Optional[str] = None
    churn_flag: Optional[bool] = False

class EmployeeChurnCreate(EmployeeChurnBase):
    source_file: str

class EmployeeChurnResponse(EmployeeChurnBase):
    id: int
    source_file: str
    upload_timestamp: datetime
    processing_status: str

    model_config = ConfigDict(from_attributes=True)
