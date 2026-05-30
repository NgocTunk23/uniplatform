# Backend Python Service

Dịch vụ transcription Python chịu trách nhiệm xử lý ghi âm và nhận dạng giọng nói.

## Yêu cầu

- Python 3.11+
- `ffmpeg` đã cài đặt trên máy
- Docker Compose (nếu muốn chạy MongoDB và Ollama qua Docker)

## Cài đặt

```bash
cd backend-python
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
```

## Chạy ứng dụng

```bash
cd backend-python
WHISPER_MODEL_SIZE=small \
WHISPER_DEVICE=cpu \
WHISPER_COMPUTE_TYPE=int8 \
WHISPER_LANGUAGE=vi \
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Mặc định

- Dịch vụ sẽ chạy tại: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- Lần gọi transcription đầu tiên sẽ tự động tải model `faster-whisper` nếu chưa có.

## Thử nghiệm

```bash
cd backend-python
venv/bin/python -m unittest discover tests
```

## Các biến môi trường quan trọng

Các giá trị này được đọc từ file root `.env` khi chạy cùng Docker Compose hoặc khi backend-node gọi dịch vụ:

- `PYTHON_API_URL`
- `WHISPER_MODEL_SIZE`
- `WHISPER_DEVICE`
- `WHISPER_COMPUTE_TYPE`
- `WHISPER_LANGUAGE`
- `OLLAMA_BASE_URL`
- `SUMMARY_SCORE_THRESHOLD`

## Ghi chú

- Nếu dùng Docker Compose, service Python sẽ tự động nhận cấu hình từ `docker-compose.yml`.
- Nếu bạn muốn dùng model khác, thay `WHISPER_MODEL_SIZE` và `WHISPER_DEVICE` cho phù hợp.
