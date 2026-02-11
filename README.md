# Boardroom LLM Council

## Backend (FastAPI + LangChain Groq)

1. Install dependencies (inside backend directory):
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Populate `.env` with `GROQ_API_KEY` (and optionally `GROQ_MODEL`).
3. Launch the API:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

## Frontend (React + Vite)

1. Install:
   ```bash
   cd frontend
   npm install
   ```
2. Run the dev server (it proxies directly to backend via env variable):
   ```bash
   VITE_API_BASE_URL=http://localhost:8000 npm run dev
   ```

## Notes
- The UI lets you edit personas, set the question, and pick models as they become available from the `/api/options` endpoint.
- Backend handles persona debates through LangChain + Groq.
