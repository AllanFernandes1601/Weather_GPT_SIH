# WeatherGPT

WeatherGPT combines live Open-Meteo conditions, a Bengaluru next-hour rain model, structured retrieval over cleaned Indian weather/disaster datasets, and Gemini-generated grounded answers.

## Local setup

1. Install JavaScript packages: `npm install`
2. Create the permanent ML environment: `npm run setup:ml`
3. Copy `.env.example` to `.env` and add the real `GEMINI_API_KEY` only to `.env`.
4. Set `WEATHERGPT_CLEAN_DATA_DIR` to the folder containing the cleaned CSV files.
5. Build the local retrieval database: `npm run rag:ingest`
6. Start the application: `npm run dev`

The application runs at `http://localhost:3000` by default. Set `PORT` to use another port.

## Verification

- `npm run rag:test` runs focused retrieval unit tests.
- `npm run rag:evaluate` runs the 43-case known-answer evaluation suite.
- `npm run lint` checks TypeScript.
- `npm run build` creates the production frontend and server bundle.
- `npm run deploy:check` checks secrets configuration, database integrity, all eight ingested datasets, ML dependencies, the rain model, and the production build.
- `npm run deploy:prepare` runs the full readiness sequence.

## Deployment notes

- Never commit `.env`; `.gitignore` excludes it.
- `rag/data/weathergpt.sqlite` is generated and ignored. Build it on the deployment host or copy it through private deployment storage.
- The deployment host must include Python and the `.venv` dependencies for Bengaluru rain inference and structured retrieval.
- Set `GEMINI_MODEL=gemini-3.6-flash` unless a supported replacement is intentionally selected.

## Data and safety boundary

Numerical records are retrieved with SQLite rather than semantic similarity. Gemini receives only the bounded evidence selected for the question. Historical records are labeled as historical and are not presented as live warnings. The alert and radar views are preparedness demonstrations until an official alert/radar provider is connected.
