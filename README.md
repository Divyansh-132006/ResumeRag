# Resume RAG

Resume RAG is an evidence-first resume workspace. It extracts text from PDF resumes, detects common sections, converts them into editable structured data, and analyzes job descriptions without inventing candidate facts.

## Current implementation

- Express/TypeScript backend with strict compilation.
- PDF signature validation, page limits, text extraction, normalization, and section detection.
- MongoDB persistence for users, resumes, and job descriptions.
- Password hashing with bcrypt and short-lived JWT authentication.
- Ownership-scoped resume CRUD and deletion cleanup.
- Deterministic job-description keyword/requirement analysis.
- Qdrant collection initialization, approved-resume ingestion, filtered evidence retrieval, and vector deletion.
- Configurable OpenAI-compatible embedding and LLM adapters with strict output validation.
- Evidence-linked generation history, account deletion, and PDF export that preserves the uploaded resume pages and appends an evidence-backed tailored page using the source PDF's page size, margins, typography scale, and spacing. Job-description keywords are used to tailor supported evidence-backed content rather than being printed as a keyword list.
- React/Vite frontend for registration, login, upload, structured review, and job-description submission.
- Health and readiness endpoints.

## Local setup

1. Start MongoDB locally.
2. Copy `backend/.env.example` to `backend/.env` and set a random `JWT_SECRET`.
3. Install and build the backend:

   ```powershell
   cd backend
   npm install
   npm run build
   npm start
   ```

4. Install and run the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open `http://localhost:5173`.

## Render backend deployment

Set the Render service root directory to `backend`. Use these commands:

- Build command: `npm install && npm run build`
- Start command: `npm start`

The backend also compiles during `npm install` through its `postinstall` script, which prevents deployment from starting without `dist/server.js` when a platform uses `npm install` as its build command.

Set these Render environment variables:

```env
FRONTEND_ORIGIN=https://jobresumerag.netlify.app
```

For the Netlify site, set this environment variable and redeploy:

```env
VITE_API_URL=https://resumerag-j9p1.onrender.com/api
```

The backend allows the deployed Netlify origin and local Vite development origin only. `FRONTEND_ORIGIN` may contain additional comma-separated trusted origins if needed.

`GET http://localhost:5000/health` checks process health. `GET http://localhost:5000/ready` reports whether MongoDB is connected.

## Provider configuration

Set `QDRANT_URL`, `EMBEDDING_API_URL`/`EMBEDDING_API_KEY`, and either the OpenAI-compatible LLM variables or Gemini variables to enable vector ingestion and grounded generation:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.8-flash
```

Without embedding credentials, resume approval is marked with a failed ingestion status. Without an LLM key, generation returns a clear provider-configuration error. Provider-dependent integration tests require those services; parser and analyzer tests run locally.
