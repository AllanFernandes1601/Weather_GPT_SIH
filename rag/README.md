# WeatherGPT structured retrieval

The RAG data layer uses SQLite for the prototype so it can run locally without a PostgreSQL service or another Node dependency. Numerical weather and disaster records are queried with SQL; they are not embedded as documents.

## Build the local database

Run this from the repository root, replacing the data directory if needed:

```bash
python3 rag/scripts/ingest_cleaned_data.py \
  --data-dir /Users/saif/Documents/Codex/2026-09-16/referenced-chatgpt-conversation-this-is-an-3/outputs
```

This creates `rag/data/weathergpt.sqlite`, which is intentionally ignored by Git because it is generated from the cleaned CSVs.

## Query from the command line

The query process accepts one JSON object through standard input:

```bash
echo '{"action":"historical_weather","location":"Delhi","date":"2000-01-01"}' \
  | python3 rag/scripts/query_weather_data.py
```

Supported actions:

- `historical_weather`
- `climate_baseline`
- `cyclone_history`
- `flood_history`
- `district_flood_metrics`
- `heatwave_history`

## API routes

After starting the application with `npm run dev`, the same retrieval layer is available through:

- `POST /api/rag/retrieve`
- `GET /api/rag/historical-weather`
- `GET /api/rag/climate-baseline`
- `GET /api/rag/cyclones`
- `GET /api/rag/floods`
- `GET /api/rag/district-flood-metrics`
- `GET /api/rag/heatwaves`

Every response retains source filename/row provenance. Ambiguous same-named flood districts are returned with a warning rather than silently joined.

## Test

```bash
python3 -m unittest rag/tests/test_retrieval.py -v
```
