from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from google import genai
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import httpx
import json
import os
import tempfile
from pathlib import Path

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

async def _preload_whisper_background():
    try:
        await asyncio.to_thread(get_whisper_model)
        print("INFO:     Whisper model pre-loaded successfully")
    except Exception as exc:
        print(f"WARNING:  Whisper model pre-load failed: {exc}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if get_bool_env("WHISPER_PRELOAD_MODEL", True):
        asyncio.create_task(_preload_whisper_background())
    yield

app = FastAPI(title="UniPlatform AI & Scheduling Service", lifespan=lifespan)

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

class SummarizationScoreRequest(BaseModel):
    referenceContexts: List[str]
    response: str
    coeff: Optional[float] = None

whisper_model = None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="faster-whisper is not installed") from exc

        model_size = os.getenv("WHISPER_MODEL_SIZE", "small")
        device = os.getenv("WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
    return whisper_model

def get_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}

def get_float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default

def get_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default

def get_ollama_openai_base_url() -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    return base_url if base_url.endswith("/v1") else f"{base_url}/v1"

def extract_ragas_score_value(result) -> float:
    value = getattr(result, "value", result)
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Ragas returned non-numeric score: {value!r}") from exc

def get_segment_number(segment, attr_name: str):
    value = getattr(segment, attr_name, None)
    return value if isinstance(value, (int, float)) else None

def get_word_items(segment):
    words = []
    for word in getattr(segment, "words", None) or []:
        words.append({
            "word": getattr(word, "word", "").strip(),
            "start": get_segment_number(word, "start"),
            "end": get_segment_number(word, "end"),
            "probability": get_segment_number(word, "probability"),
        })
    return words

def is_uncertain_segment(segment, text: str) -> bool:
    if not text:
        return False

    avg_logprob = get_segment_number(segment, "avg_logprob")
    no_speech_prob = get_segment_number(segment, "no_speech_prob")
    compression_ratio = get_segment_number(segment, "compression_ratio")
    logprob_threshold = get_float_env("WHISPER_UNCERTAIN_LOGPROB_THRESHOLD", -0.75)
    no_speech_threshold = get_float_env("WHISPER_UNCERTAIN_NO_SPEECH_THRESHOLD", 0.55)
    compression_threshold = get_float_env("WHISPER_UNCERTAIN_COMPRESSION_THRESHOLD", 2.4)

    return (
        (avg_logprob is not None and avg_logprob <= logprob_threshold) or
        (no_speech_prob is not None and no_speech_prob >= no_speech_threshold) or
        (compression_ratio is not None and compression_ratio >= compression_threshold)
    )

def build_segment_payload(segment, retried: bool = False):
    segment_text = getattr(segment, "text", "").strip()
    payload = {
        "id": getattr(segment, "id", None),
        "start": get_segment_number(segment, "start"),
        "end": get_segment_number(segment, "end"),
        "text": segment_text,
        "avgLogprob": get_segment_number(segment, "avg_logprob"),
        "noSpeechProb": get_segment_number(segment, "no_speech_prob"),
        "compressionRatio": get_segment_number(segment, "compression_ratio"),
        "temperature": get_segment_number(segment, "temperature"),
        "words": get_word_items(segment),
        "uncertain": is_uncertain_segment(segment, segment_text),
        "retried": retried,
    }
    return payload

def transcribe_with_options(model, audio_path: str, selected_language: str, *, word_timestamps: bool, clip_timestamps="0", retry=False):
    beam_size = get_int_env("WHISPER_RETRY_BEAM_SIZE" if retry else "WHISPER_BEAM_SIZE", 5 if retry else 3)
    kwargs = {
        "language": selected_language,
        "vad_filter": not retry,
        "word_timestamps": word_timestamps,
        "beam_size": beam_size,
        "condition_on_previous_text": not retry,
        "clip_timestamps": clip_timestamps,
    }
    hotwords = os.getenv("WHISPER_HOTWORDS")
    initial_prompt = os.getenv("WHISPER_INITIAL_PROMPT")
    if hotwords:
        kwargs["hotwords"] = hotwords
    if initial_prompt:
        kwargs["initial_prompt"] = initial_prompt
    if retry:
        kwargs["temperature"] = 0.0
        kwargs["vad_filter"] = False
    return model.transcribe(audio_path, **kwargs)

def retry_uncertain_segment_payloads(model, audio_path: str, selected_language: str, segments: List[dict], *, word_timestamps: bool):
    if not get_bool_env("WHISPER_RETRY_UNCERTAIN_SEGMENTS", True):
        return segments, 0

    retry_limit = max(0, get_int_env("WHISPER_RETRY_MAX_SEGMENTS", 3))
    retry_padding = max(0.0, get_float_env("WHISPER_RETRY_PADDING_SECONDS", 0.4))
    retried_count = 0

    for segment in segments:
        if retried_count >= retry_limit or not segment.get("uncertain"):
            continue

        start = segment.get("start")
        end = segment.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or end <= start:
            continue

        clip_start = max(0.0, start - retry_padding)
        clip_end = end + retry_padding
        try:
            retry_iter, _ = transcribe_with_options(
                model,
                audio_path,
                selected_language,
                word_timestamps=word_timestamps,
                clip_timestamps=f"{clip_start:.2f},{clip_end:.2f}",
                retry=True,
            )
            retry_segments = [build_segment_payload(item, retried=True) for item in retry_iter]
            retry_text = " ".join(item["text"] for item in retry_segments if item["text"]).strip()
            if retry_text:
                segment["originalText"] = segment["text"]
                segment["text"] = retry_text
                segment["words"] = [
                    word
                    for item in retry_segments
                    for word in item.get("words", [])
                ]
                segment["retried"] = True
                segment["retrySegments"] = retry_segments
                segment["uncertain"] = any(item.get("uncertain") for item in retry_segments)
                retried_count += 1
        except Exception as exc:
            segment["retryError"] = str(exc)

    return segments, retried_count

class _NoThinkAsyncTransport(httpx.AsyncBaseTransport):
    """Injects think=false into every Ollama chat/completions request body."""
    def __init__(self):
        self._inner = httpx.AsyncHTTPTransport()

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if b"/chat/completions" in request.url.raw_path:
            try:
                body = json.loads(request.content)
                body.setdefault("think", False)
                request = request.copy(content=json.dumps(body).encode())
            except Exception:
                pass
        return await self._inner.handle_async_request(request)

    async def aclose(self):
        await self._inner.aclose()


async def score_summary_with_ragas(reference_contexts: List[str], response: str, coeff: Optional[float] = None) -> float:
    try:
        from openai import AsyncOpenAI
        from ragas.llms import llm_factory
        from ragas.metrics.collections import SummaryScore
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="ragas and openai are required for summary evaluation") from exc

    model = os.getenv("SUMMARY_SCORE_MODEL", "qwen3:1.7b")
    timeout_seconds = get_int_env("SUMMARY_SCORE_TIMEOUT_MS", 300000) / 1000
    selected_coeff = coeff if coeff is not None else get_float_env("SUMMARY_SCORE_CONCISENESS_COEFF", 0.5)
    async with httpx.AsyncClient(transport=_NoThinkAsyncTransport()) as http_client:
        client = AsyncOpenAI(
            api_key="ollama",
            base_url=get_ollama_openai_base_url(),
            http_client=http_client,
            timeout=timeout_seconds,
        )
        llm = llm_factory(model, provider="openai", client=client)
        scorer = SummaryScore(llm=llm, coeff=selected_coeff)
        result = await scorer.ascore(
            reference_contexts=reference_contexts,
            response=response,
        )
    return extract_ragas_score_value(result)

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

@app.post("/api/transcription/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(default=None),
    word_timestamps: bool = Form(default=False),
    retry_uncertain_segments: bool = Form(default=True),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing audio file")

    suffix = Path(file.filename).suffix or ".wav"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                tmp.write(chunk)

        if os.path.getsize(tmp_path) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        model = get_whisper_model()
        selected_language = language or os.getenv("WHISPER_LANGUAGE", "vi")
        segments_iter, info = transcribe_with_options(
            model,
            tmp_path,
            selected_language,
            word_timestamps=word_timestamps,
        )

        segments = [build_segment_payload(segment) for segment in segments_iter]
        retried_count = 0
        if retry_uncertain_segments:
            segments, retried_count = retry_uncertain_segment_payloads(
                model,
                tmp_path,
                selected_language,
                segments,
                word_timestamps=word_timestamps,
            )

        text_parts = [segment["text"] for segment in segments if segment.get("text")]
        uncertain_count = sum(1 for segment in segments if segment.get("uncertain"))

        return {
            "text": " ".join(text_parts).strip(),
            "language": getattr(info, "language", selected_language),
            "durationSeconds": getattr(info, "duration", None),
            "segments": segments,
            "metadata": {
                "wordTimestamps": word_timestamps,
                "retryUncertainSegments": retry_uncertain_segments,
                "retriedSegmentCount": retried_count,
                "uncertainSegmentCount": uncertain_count,
                "segmentCount": len(segments),
                "asrModel": os.getenv("WHISPER_MODEL_SIZE", "small"),
                "language": getattr(info, "language", selected_language),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await file.close()
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

@app.post("/api/evaluation/summarization-score")
async def evaluate_summarization_score(request: SummarizationScoreRequest):
    reference_contexts = [item.strip() for item in request.referenceContexts if item and item.strip()]
    response = request.response.strip() if request.response else ""
    threshold = get_float_env("SUMMARY_SCORE_THRESHOLD", 0.55)
    model = os.getenv("SUMMARY_SCORE_MODEL", "qwen3:1.7b")
    coeff = request.coeff if request.coeff is not None else get_float_env("SUMMARY_SCORE_CONCISENESS_COEFF", 0.5)

    if not reference_contexts:
        raise HTTPException(status_code=400, detail="referenceContexts must include at least one non-empty string")
    if not response:
        raise HTTPException(status_code=400, detail="response must be a non-empty string")

    if not get_bool_env("SUMMARY_SCORE_ENABLED", True):
        return {
            "score": 1.0,
            "passed": True,
            "threshold": threshold,
            "metric": "ragas_summary_score",
            "model": model,
            "metadata": {
                "enabled": False,
                "coeff": coeff,
            },
        }

    try:
        score = await score_summary_with_ragas(reference_contexts, response, coeff)
        return {
            "score": score,
            "passed": score >= threshold,
            "threshold": threshold,
            "metric": "ragas_summary_score",
            "model": model,
            "metadata": {
                "enabled": True,
                "coeff": coeff,
            },
        }
    except HTTPException:
        raise
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
