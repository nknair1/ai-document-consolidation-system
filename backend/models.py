from sqlalchemy import Column, Integer, String, Date, Float, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class EmployeeChurn(Base):
    __tablename__ = "employee_churn"

    id = Column(Integer, primary_key=True, index=True)
    
    # Option 5 Final Schema Fields
    employee_id = Column(String, index=True, nullable=False)
    joining_date = Column(Date, nullable=True)
    exit_date = Column(Date, nullable=True)
    department = Column(String, index=True, nullable=True)
    last_performance_rating = Column(String, nullable=True)
    salary = Column(Float, nullable=True)
    exit_reason = Column(String, nullable=True)
    churn_flag = Column(Boolean, default=False)
    
    # Mandatory Tracking Fields
    source_file = Column(String, nullable=False)
    upload_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    processing_status = Column(String, default="PENDING")  # PENDING, COMPLETED, FAILED
