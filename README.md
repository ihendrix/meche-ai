# Hendrix Mechanical Analytics 2.0

A complete mechanical-testing web application built with **Next.js**, **FastAPI**, and **Supabase**. It uploads Instron/Bluehill exports, cleans stress-strain data, calculates material properties, plots interactive curves, saves analyses, and exports results.

## Open the website

**Current public website:** [Open Hendrix Mechanical Analytics](https://hendrix-mechanical-analytics.streamlit.app)

**New full-stack website when running locally:** [http://localhost:3000](http://localhost:3000)

**Expected Vercel address after deployment:** `https://hendrix-mechanical-analytics.vercel.app`

The current public link opens the existing version. The new Next.js website becomes public after the `frontend` folder is deployed to Vercel and connected to the FastAPI URL from Render.

## What is included

- Next.js frontend with file upload, controls, metric cards, Plotly charts, tables, notes, and downloads
- FastAPI backend with pandas, NumPy, SciPy, and Instron/Bluehill parsing
- Supabase authentication, PostgreSQL tables, Row Level Security, and private file storage
- Saved-analysis interface for storing results and uploaded source files
- Baseline correction, smoothing, optional spike removal, and confirmed-failure cropping
- Peak stress, strain at peak, Young's modulus, modulus R², and area-under-curve calculations
- Render and Vercel deployment configuration

## Repository structure

```text
hendrix-mechanical-stack/
├── frontend/                       Next.js website
│   ├── app/
│   ├── components/
│   └── lib/
├── backend/                        FastAPI scientific API
│   ├── app/
│   │   ├── api/routes/analysis.py
│   │   ├── models/schemas.py
│   │   └── services/mechanics.py
│   └── tests/
├── supabase/
│   └── migrations/001_initial.sql
├── render.yaml
├── docker-compose.yml
└── README.md
```

## Upload this project to GitHub

1. Download and unzip the project.
2. Create a new empty GitHub repository named `hendrix-mechanical-analytics`.
3. In the empty repository, choose **Add file → Upload files**.
4. Drag everything inside the unzipped folder into GitHub.
5. Commit the upload to the `main` branch.

The repository root should display `frontend`, `backend`, `supabase`, `render.yaml`, and `README.md`. Do not upload the ZIP as a single file.

## Run the full stack locally

### 1. Start FastAPI

Open PowerShell in the project folder:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend health check: [http://localhost:8000/health](http://localhost:8000/health)

API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Start Next.js

Open a second PowerShell window:

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

Open the website: [http://localhost:3000](http://localhost:3000)

## Set up Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Copy and run `supabase/migrations/001_initial.sql`.
4. In Supabase, open **Authentication → Providers → Email** and enable email authentication.
5. Copy the project URL and publishable key.
6. Add them to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

The migration creates:

- `analyses`
- `analysis_files`
- `analysis_metrics`
- Private `mechanical-files` Storage bucket
- User-specific Row Level Security policies

## Deploy FastAPI to Render

1. Sign in to Render.
2. Choose **New → Blueprint**.
3. Connect the GitHub repository.
4. Render reads `render.yaml` and deploys the backend.
5. Copy the generated backend URL, such as:

```text
https://hendrix-mechanical-api.onrender.com
```

Confirm the backend is working by opening:

```text
https://hendrix-mechanical-api.onrender.com/health
```

## Deploy Next.js to Vercel

1. Sign in to Vercel and import the same GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Add these environment variables:

```env
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-URL.onrender.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

4. Deploy.
5. Open the Vercel website URL.
6. Replace the expected Vercel address near the top of this README if Vercel assigns a different URL.

## API endpoints

```text
POST /api/v1/analysis
GET  /api/v1/analysis/demo
GET  /health
```

## Supported uploads

```text
.csv
.xlsx
.xls
.txt
.dat
.tsv
```

## Important validation note

Confirm source units, modulus-fit regions, cleaning choices, and instrument-specific calculation settings before using results for final materials validation.
