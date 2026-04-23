from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta
from google import genai
from motor.motor_asyncio import AsyncIOMotorClient
import os

# ----------------------BEGIN module 1---------------------

app = FastAPI(title="UniPlatform AI Service - Schedule Module")

mock_schedules = [
    {
        "username": "ton_nguyen",
        "starttime": datetime(2026, 5, 10, 8, 0),
        "endtime": datetime(2026, 5, 10, 10, 0),
        "type": "Bận"
    },
    {
        "username": "trang_vo",
        "starttime": datetime(2026, 5, 10, 9, 0),
        "endtime": datetime(2026, 5, 10, 11, 0),
        "type": "Bận"
    }
]

# 2. Định nghĩa Model yêu cầu từ Frontend/Node.js [cite: 301]
class MeetingRequest(BaseModel):
    usernames: List[str]
    duration_minutes: int
    search_date: str  # Format: "YYYY-MM-DD"

@app.post("/suggest-free-slots")
async def suggest_slots(req: MeetingRequest):
    # Xác định khung thời gian tìm kiếm (ví dụ 8h sáng đến 18h tối của ngày đó) [cite: 301]
    day = datetime.strptime(req.search_date, "%Y-%m-%d")
    work_start = day.replace(hour=8, minute=0)
    work_end = day.replace(hour=18, minute=0)
    
    # Bước 1: Lọc lịch bận của các thành viên trong danh sách [cite: 301]
    busy_intervals = []
    for sch in mock_schedules:
        if sch["username"] in req.usernames and sch["type"] == "Bận":
            busy_intervals.append((sch["starttime"], sch["endtime"]))
            
    # Bước 2: Hợp nhất các khoảng bận (Merge Intervals)
    busy_intervals.sort()
    merged_busy = []
    if busy_intervals:
        curr_start, curr_end = busy_intervals[0]
        for next_start, next_end in busy_intervals[1:]:
            if next_start <= curr_end:
                curr_end = max(curr_end, next_end)
            else:
                merged_busy.append((curr_start, curr_end))
                curr_start, curr_end = next_start, next_end
        merged_busy.append((curr_start, curr_end))

    # Bước 3: Tìm khoảng trống (Free Slots) [cite: 301, 146]
    free_slots = []
    current_time = work_start
    duration = timedelta(minutes=req.duration_minutes)

    for b_start, b_end in merged_busy:
        if b_start - current_time >= duration:
            free_slots.append({
                "start": current_time.strftime("%H:%M"),
                "end": b_start.strftime("%H:%M")
            })
        current_time = max(current_time, b_end)

    if work_end - current_time >= duration:
        free_slots.append({
            "start": current_time.strftime("%H:%M"),
            "end": work_end.strftime("%H:%M")
        })

    if not free_slots:
        # Xử lý Exception Flow: Không có giờ trống [cite: 301]
        return {"message": "Không tìm thấy khung giờ phù hợp", "suggest": "Giảm thời lượng hoặc bớt thành viên"}

    return {"free_slots": free_slots}

# ---------------------END module 1---------------------

# 1. Cấu hình các biến môi trường
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://root:password@mongodb:27017")

# 2. Khởi tạo các kết nối (AI & Database)
# Khởi tạo Gemini Client
if GEMINI_API_KEY:
    client_ai = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("CẢNH BÁO: Chưa tìm thấy GEMINI_API_KEY")
    client_ai = None

# Khởi tạo MongoDB Client
client_db = AsyncIOMotorClient(MONGO_URI)
db = client_db.uniplatform

app = FastAPI(title="UniPlatform AI & Scheduling Service")

# 3. Cấu hình CORS để Frontend (port 3000) có thể gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class PromptRequest(BaseModel):
    message: str

class ScheduleRequest(BaseModel):
    usernames: List[str]
    duration_minutes: int
    search_start: str  # ISO Format: "2026-04-05T08:00:00"
    search_end: str

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "AI & Scheduling Service is running smoothly!"}

# Endpoint 1: Trợ lý ảo AI Chat
@app.post("/api/ai/chat")
async def chat_with_ai(request: PromptRequest):
    if not client_ai:
        raise HTTPException(status_code=500, detail="Thiếu Gemini API Key!")
    try:
        system_context = "Bạn là trợ lý ảo AI của nền tảng UniPlatform, chuyên hỗ trợ sinh viên làm việc nhóm. Hãy trả lời ngắn gọn, thân thiện và tiếng Việt tự nhiên.\n\nCâu hỏi: "
        final_prompt = system_context + request.message

        response = client_ai.models.generate_content(
            model='gemini-2.0-flash',
            contents=final_prompt,
        )
        return {"success": True, "reply": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 2: Thuật toán tìm khung giờ rảnh chung
@app.post("/api/schedule/find-free-slots")
async def find_free_slots(req: ScheduleRequest):
    try:
        start_dt = datetime.fromisoformat(req.search_start)
        end_dt = datetime.fromisoformat(req.search_end)
        
        # 1. Truy xuất lịch bận từ MongoDB
        busy_slots = []
        cursor = db.Schedules.find({
            "username": {"$in": req.usernames},
            "starttime": {"$lt": end_dt},
            "endtime": {"$gt": start_dt}
        })
        
        async for doc in cursor:
            # Chuyển đổi từ string/datetime trong DB sang object datetime
            busy_slots.append((doc["starttime"], doc["endtime"]))

        # 2. Hợp nhất các khoảng bận (Merge Overlapping Intervals)
        busy_slots.sort()
        if not busy_slots:
            return {"suggested_slots": [{"start": start_dt, "end": end_dt}]}

        merged = [busy_slots[0]]
        for current in busy_slots[1:]:
            prev_start, prev_end = merged[-1]
            curr_start, curr_end = current
            if curr_start <= prev_end:
                merged[-1] = (prev_start, max(prev_end, curr_end))
            else:
                merged.append(current)

        # 3. Tìm các khoảng trống (Free slots) đủ thời lượng yêu cầu
        free_slots = []
        current_time = start_dt
        
        for b_start, b_end in merged:
            if (b_start - current_time) >= timedelta(minutes=req.duration_minutes):
                free_slots.append({"start": current_time, "end": b_start})
            current_time = max(current_time, b_end)
            
        if (end_dt - current_time) >= timedelta(minutes=req.duration_minutes):
            free_slots.append({"start": current_time, "end": end_dt})

        return {
            "team": req.usernames,
            "suggested_slots": free_slots
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))