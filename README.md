Frontend (Ứng dụng Web): http://localhost:5173

Backend Node.js (API): http://localhost:5001

Backend Python (Swagger UI): http://localhost:8000/docs

docker-compose up --build
OLLAMA_HOST="0.0.0.0:11434" ollama serve

docker-compose down

npx prisma generate

docker compose build --no-cache backend-node

docker compose up -d

## Local recording/transcription flow

1. Copy env defaults:

```bash
cp .env.example .env
```

2. Start infrastructure and install local AI dependencies:

```bash
docker compose up -d mongodb
brew install ffmpeg ollama
ollama serve
ollama pull qwen3:1.7b
```

3. Start the Python transcription API:

```bash
cd backend-python
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

4. Start the Node API and frontend:

```bash
cd backend-node
npm install
npm run check:recording-env
npx prisma generate
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

5. Manual verification:

- Open `http://localhost:5173`, create or join a meeting in two browser tabs.
- Turn on microphone in at least one tab.
- Organizer or Workspace Leader clicks record, speaks Vietnamese, then stops or ends the meeting.
- Open Meeting Review and wait for `processing` to become `review_required`.
- Review/edit the corrected transcript, approve it, generate summary, then re-evaluate if the Ragas score is below threshold.

Recording uses `faster-whisper` with `small`, `cpu`, `int8`, `language=vi` by default. The meeting room includes a 5-second mic test, realtime mic meter, and browser audio constraints for echo cancellation, noise suppression, auto gain, and mono capture. Backend recording stores mixed audio plus per-participant audio tracks when available, records audio quality metadata, asks Whisper for segment/word timestamps, and retries uncertain segments before LLM transcript correction. Transcript correction and summary use local Ollama model `qwen3:1.7b`. Summary publishing is gated by Ragas `SummaryScore` with default threshold `0.55`; failed summaries stay in draft until edited and re-evaluated. If backend Node runs inside Docker Desktop on macOS, set `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
