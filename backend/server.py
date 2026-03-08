from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class ChecklistItem(BaseModel):
    name: str
    passed: bool = False
    defects: str = ""

class Location(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None

class DailyEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD format
    worker_name: str = "Worker"
    fleet_number: str = ""
    pre_start_checklist: List[ChecklistItem] = []
    pre_start_completed: bool = False
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None  # HH:MM format
    break_duration: int = 0  # minutes
    total_hours: float = 0.0
    overtime_hours: float = 0.0
    job_project: str = ""
    engine_hours_start: Optional[float] = None
    engine_hours_end: Optional[float] = None
    fuel_usage: Optional[float] = None  # Litres
    location: Optional[Location] = None
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DailyEntryCreate(BaseModel):
    date: str
    worker_name: str = "Worker"
    fleet_number: str = ""
    pre_start_checklist: List[ChecklistItem] = []
    pre_start_completed: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_duration: int = 0
    total_hours: float = 0.0
    overtime_hours: float = 0.0
    job_project: str = ""
    engine_hours_start: Optional[float] = None
    engine_hours_end: Optional[float] = None
    fuel_usage: Optional[float] = None
    location: Optional[Location] = None
    notes: str = ""

class DailyEntryUpdate(BaseModel):
    worker_name: Optional[str] = None
    fleet_number: Optional[str] = None
    pre_start_checklist: Optional[List[ChecklistItem]] = None
    pre_start_completed: Optional[bool] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_duration: Optional[int] = None
    total_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    job_project: Optional[str] = None
    engine_hours_start: Optional[float] = None
    engine_hours_end: Optional[float] = None
    fuel_usage: Optional[float] = None
    location: Optional[Location] = None
    notes: Optional[str] = None

class WeeklySummary(BaseModel):
    week_start: str
    week_end: str
    total_hours: float
    total_overtime: float
    days_worked: int
    entries: List[DailyEntry]

# Default checklist items
DEFAULT_CHECKLIST = [
    "Lights",
    "Brakes",
    "Tyres/Tracks",
    "Engine Oil",
    "Hydraulic Oil",
    "Coolant",
    "Mirrors",
    "Seatbelts",
    "UHF",
    "Leaks",
    "Steering",
    "Windscreen/Windows"
]

# Routes
@api_router.get("/")
async def root():
    return {"message": "Weekly Timesheet API"}

@api_router.get("/checklist-items")
async def get_checklist_items():
    """Get default checklist items"""
    return {"items": DEFAULT_CHECKLIST}

@api_router.post("/entries", response_model=DailyEntry)
async def create_entry(entry: DailyEntryCreate):
    """Create a new daily entry"""
    # Check if entry already exists for this date
    existing = await db.daily_entries.find_one({"date": entry.date})
    if existing:
        raise HTTPException(status_code=400, detail="Entry already exists for this date")
    
    entry_dict = entry.dict()
    entry_obj = DailyEntry(**entry_dict)
    await db.daily_entries.insert_one(entry_obj.dict())
    return entry_obj

@api_router.get("/entries/{date}", response_model=DailyEntry)
async def get_entry(date: str):
    """Get entry for a specific date"""
    entry = await db.daily_entries.find_one({"date": date})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return DailyEntry(**entry)

@api_router.get("/entries", response_model=List[DailyEntry])
async def get_entries(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get all entries, optionally filtered by date range"""
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    entries = await db.daily_entries.find(query).sort("date", -1).to_list(1000)
    return [DailyEntry(**entry) for entry in entries]

@api_router.put("/entries/{date}", response_model=DailyEntry)
async def update_entry(date: str, entry_update: DailyEntryUpdate):
    """Update an existing entry"""
    existing = await db.daily_entries.find_one({"date": date})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = {k: v for k, v in entry_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.daily_entries.update_one(
        {"date": date},
        {"$set": update_data}
    )
    
    updated = await db.daily_entries.find_one({"date": date})
    return DailyEntry(**updated)

@api_router.delete("/entries/{date}")
async def delete_entry(date: str):
    """Delete an entry"""
    result = await db.daily_entries.delete_one({"date": date})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully"}

@api_router.get("/weekly-summary", response_model=WeeklySummary)
async def get_weekly_summary(week_start: str, week_end: str):
    """Get weekly summary for a date range"""
    entries = await db.daily_entries.find({
        "date": {"$gte": week_start, "$lte": week_end}
    }).sort("date", 1).to_list(7)
    
    total_hours = sum(e.get("total_hours", 0) for e in entries)
    total_overtime = sum(e.get("overtime_hours", 0) for e in entries)
    days_worked = len([e for e in entries if e.get("total_hours", 0) > 0])
    
    return WeeklySummary(
        week_start=week_start,
        week_end=week_end,
        total_hours=total_hours,
        total_overtime=total_overtime,
        days_worked=days_worked,
        entries=[DailyEntry(**e) for e in entries]
    )

# Download endpoint for source code
@api_router.get("/download/source-code")
async def download_source_code():
    """Download the complete source code package"""
    file_path = Path("/app/download_package/truck-and-machine-app.zip")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Download package not found")
    return FileResponse(
        path=str(file_path),
        filename="truck-and-machine-app.zip",
        media_type="application/zip"
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
