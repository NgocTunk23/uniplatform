# Backend Python Service

## Local setup

```bash
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
```

## Run

```bash
WHISPER_MODEL_SIZE=small \
WHISPER_DEVICE=cpu \
WHISPER_COMPUTE_TYPE=int8 \
WHISPER_LANGUAGE=vi \
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

The first transcription request downloads the `faster-whisper` model if it is not already cached.

## Test

```bash
venv/bin/python -m unittest discover tests
```
