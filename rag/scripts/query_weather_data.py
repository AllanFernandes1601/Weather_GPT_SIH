#!/usr/bin/env python3
"""Query the local WeatherGPT SQLite database using a JSON request on stdin."""

from __future__ import annotations

import json
import math
import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any


DEFAULT_DATABASE = Path(__file__).resolve().parents[1] / "data" / "weathergpt.sqlite"


def normalize_place(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value.lower())).strip()


def require_text(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value.strip()


def optional_int(payload: dict[str, Any], key: str) -> int | None:
    value = payload.get(key)
    if value in (None, ""):
        return None
    return int(value)


def rows(cursor: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.fetchall()]


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    position = (len(values) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return values[lower]
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def historical_weather(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    location = require_text(payload, "location")
    start_date = payload.get("startDate") or payload.get("date")
    end_date = payload.get("endDate") or start_date
    limit = min(max(optional_int(payload, "limit") or 100, 1), 500)
    conditions = ["(city = ? COLLATE NOCASE)"]
    params: list[Any] = [location]
    if start_date:
        conditions.append("date >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("date <= ?")
        params.append(end_date)
    params.append(limit)
    longterm = rows(connection.execute(
        f"""SELECT city AS location, date, temp_min_c, temp_max_c,
                   precipitation_sum_mm, rain_sum_mm, weather_code,
                   wind_speed_10m_max_kmh, source_file, source_row, cleaning_flags
              FROM weather_longterm WHERE {' AND '.join(conditions)}
             ORDER BY date LIMIT ?""",
        params,
    ))

    detailed_conditions = ["(station_name = ? COLLATE NOCASE OR district = ? COLLATE NOCASE OR state = ? COLLATE NOCASE)"]
    detailed_params: list[Any] = [location, location, location]
    if start_date:
        detailed_conditions.append("date >= ?")
        detailed_params.append(start_date)
    if end_date:
        detailed_conditions.append("date <= ?")
        detailed_params.append(end_date)
    detailed_params.append(limit)
    detailed = rows(connection.execute(
        f"""SELECT station_name, district, state, date, latitude, longitude,
                   temp_mean_c, temp_min_c, temp_max_c, rainfall_mm, air_pressure_hpa,
                   source_file, source_row, cleaning_flags
              FROM weather_detailed WHERE {' AND '.join(detailed_conditions)}
             ORDER BY date, station_name LIMIT ?""",
        detailed_params,
    ))
    return {"query": {"location": location, "startDate": start_date, "endDate": end_date}, "longTerm": longterm, "detailed": detailed}


def climate_baseline(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    location = require_text(payload, "location")
    month = optional_int(payload, "month")
    if month is None or not 1 <= month <= 12:
        raise ValueError("month must be an integer from 1 to 12")
    records = rows(connection.execute(
        """SELECT temp_min_c, temp_max_c, precipitation_sum_mm, rain_sum_mm
             FROM weather_longterm
            WHERE city = ? COLLATE NOCASE AND CAST(strftime('%m', date) AS INTEGER) = ?""",
        (location, month),
    ))
    if not records:
        return {"query": {"location": location, "month": month}, "available": False, "reason": "No matching long-term city data"}
    rain = [float(record["precipitation_sum_mm"]) for record in records if record["precipitation_sum_mm"] is not None]
    minimums = [float(record["temp_min_c"]) for record in records if record["temp_min_c"] is not None]
    maximums = [float(record["temp_max_c"]) for record in records if record["temp_max_c"] is not None]
    mean_temps = [(a + b) / 2 for a, b in zip(minimums, maximums)] if len(minimums) == len(maximums) else []
    rounded = lambda value: round(value, 2) if value is not None else None
    return {
        "query": {"location": location, "month": month},
        "available": True,
        "observationCount": len(records),
        "baselinePeriod": "2000-2024",
        "tempMinMeanC": rounded(sum(minimums) / len(minimums)) if minimums else None,
        "tempMaxMeanC": rounded(sum(maximums) / len(maximums)) if maximums else None,
        "tempDailyMeanC": rounded(sum(mean_temps) / len(mean_temps)) if mean_temps else None,
        "precipitationMeanMm": rounded(sum(rain) / len(rain)) if rain else None,
        "precipitationP90Mm": rounded(percentile(rain, 0.90)),
        "precipitationP95Mm": rounded(percentile(rain, 0.95)),
        "source": "weather_india_2000_2024_cleaned.csv",
    }


def cyclone_history(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    year = optional_int(payload, "year")
    basin = payload.get("basin")
    name = payload.get("name")
    limit = min(max(optional_int(payload, "limit") or 100, 1), 500)
    conditions = ["1=1"]
    params: list[Any] = []
    if year is not None:
        conditions.append("source_year = ?")
        params.append(year)
    if isinstance(basin, str) and basin.strip():
        conditions.append("basin = ? COLLATE NOCASE")
        params.append(basin.strip())
    if isinstance(name, str) and name.strip():
        conditions.append("system_name LIKE ? COLLATE NOCASE")
        params.append(f"%{name.strip()}%")
    params.append(limit)
    matches = rows(connection.execute(
        f"""SELECT event_id, source_year, basin, system_name, timestamp_utc, latitude, longitude,
                   central_pressure_hpa, max_sustained_wind_kt, grade, source_file, source_sheet,
                   source_row, cleaning_flags
              FROM cyclone_tracks WHERE {' AND '.join(conditions)}
             ORDER BY timestamp_utc LIMIT ?""",
        params,
    ))
    return {"query": {"year": year, "basin": basin, "name": name}, "records": matches}


def flood_history(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    state = payload.get("state")
    district = payload.get("district")
    year = optional_int(payload, "year")
    limit = min(max(optional_int(payload, "limit") or 100, 1), 500)
    if not any([state, district, year]):
        raise ValueError("At least one of state, district, or year is required")
    conditions = ["1=1"]
    params: list[Any] = []
    if isinstance(state, str) and state.strip():
        conditions.append("state LIKE ? COLLATE NOCASE")
        params.append(f"%{state.strip()}%")
    if isinstance(district, str) and district.strip():
        conditions.append("districts LIKE ? COLLATE NOCASE")
        params.append(f"%{district.strip()}%")
    if year is not None:
        conditions.append("CAST(substr(start_date, 1, 4) AS INTEGER) = ?")
        params.append(year)
    params.append(limit)
    matches = rows(connection.execute(
        f"""SELECT event_id, start_date, start_date_raw, end_date, end_date_raw, duration_days, main_cause, districts, state,
                   human_fatalities, human_injured, human_displaced, damage_description,
                   event_source, source_file, source_row, cleaning_flags
              FROM flood_events WHERE {' AND '.join(conditions)}
             ORDER BY start_date LIMIT ?""",
        params,
    ))
    return {"query": {"state": state, "district": district, "year": year}, "events": matches}


def district_flood_metrics(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    district = require_text(payload, "district")
    state = payload.get("state")
    normalized = normalize_place(district)
    dfsi_conditions = ["district_name_normalized = ?"]
    dfsi_params: list[Any] = [normalized]
    if isinstance(state, str) and state.strip():
        dfsi_conditions.append("state_name = ? COLLATE NOCASE")
        dfsi_params.append(state.strip())
    dfsi = rows(connection.execute(
        f"SELECT district_name, state_name, dfsi, source_file, source_row, cleaning_flags FROM flood_dfsi WHERE {' AND '.join(dfsi_conditions)}",
        dfsi_params,
    ))
    area = rows(connection.execute(
        """SELECT district_name, percent_flooded_area, permanent_water_percent,
                  corrected_percent_flooded_area, source_file, source_row, cleaning_flags
             FROM flood_area WHERE district_name_normalized = ?""",
        (normalized,),
    ))
    impact = rows(connection.execute(
        """SELECT district_name, human_fatalities, human_injured, population,
                  mean_flood_duration_days, source_file, source_row, cleaning_flags
             FROM flood_impact WHERE district_name_normalized = ?""",
        (normalized,),
    ))
    ambiguous = len(area) > 1 or len(impact) > 1 or (state is None and len(dfsi) > 1)
    return {
        "query": {"district": district, "state": state},
        "ambiguous": ambiguous,
        "warning": "Same-named districts cannot be safely joined without a state identifier." if ambiguous else None,
        "dfsi": dfsi,
        "area": area,
        "impact": impact,
    }


def heatwave_history(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    region = payload.get("region")
    year = optional_int(payload, "year")
    conditions = ["1=1"]
    params: list[Any] = []
    if isinstance(region, str) and region.strip():
        conditions.append("(region_name LIKE ? COLLATE NOCASE OR region_source_label LIKE ? COLLATE NOCASE)")
        params.extend([f"%{region.strip()}%", f"%{region.strip()}%"])
    if year is not None:
        conditions.append("year = ?")
        params.append(year)
    matches = rows(connection.execute(
        f"""SELECT year, region_type, region_source_label, region_name, heatwave_days,
                   source_organization, source_reference, source_url, source_file, source_row
              FROM heatwave_days WHERE {' AND '.join(conditions)} ORDER BY year, region_name""",
        params,
    ))
    return {"query": {"region": region, "year": year}, "records": matches}


def resolve_location(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    text = require_text(payload, "text")
    normalized_text = f" {normalize_place(text)} "
    candidates: dict[tuple[str, str], dict[str, Any]] = {}

    queries = [
        ("city", "SELECT DISTINCT city AS name, NULL AS state FROM weather_longterm WHERE city IS NOT NULL"),
        ("station", "SELECT DISTINCT station_name AS name, state FROM weather_detailed WHERE station_name IS NOT NULL"),
        ("district", "SELECT DISTINCT district AS name, state FROM weather_detailed WHERE district IS NOT NULL"),
        ("state", "SELECT DISTINCT state AS name, state FROM weather_detailed WHERE state IS NOT NULL"),
        ("district", "SELECT DISTINCT district_name AS name, state_name AS state FROM flood_dfsi WHERE district_name IS NOT NULL"),
        ("heatwave_region", "SELECT DISTINCT region_name AS name, NULL AS state FROM heatwave_days WHERE region_name IS NOT NULL"),
    ]
    for kind, sql in queries:
        for row in connection.execute(sql):
            name = row["name"]
            normalized = normalize_place(name or "")
            if not normalized or len(normalized) < 3:
                continue
            key = (normalized, kind)
            candidates[key] = {"name": name, "kind": kind, "state": row["state"], "normalized": normalized}

    aliases = {
        "bangalore": {"name": "Bengaluru", "kind": "city", "state": "Karnataka", "normalized": "bangalore"},
        "bombay": {"name": "Mumbai", "kind": "city", "state": "Maharashtra", "normalized": "bombay"},
        "calcutta": {"name": "Kolkata", "kind": "city", "state": "West Bengal", "normalized": "calcutta"},
        "madras": {"name": "Chennai", "kind": "city", "state": "Tamil Nadu", "normalized": "madras"},
        "orissa": {"name": "Odisha", "kind": "state", "state": "Odisha", "normalized": "orissa"},
    }
    candidates.update({(key, "alias"): value for key, value in aliases.items()})

    matches = [
        candidate for candidate in candidates.values()
        if f" {candidate['normalized']} " in normalized_text
    ]
    if not matches:
        return {"query": {"text": text}, "match": None}

    priority = {"district": 5, "station": 4, "city": 3, "state": 2, "heatwave_region": 1}
    match = max(matches, key=lambda item: (len(item["normalized"]), priority.get(item["kind"], 0)))
    return {
        "query": {"text": text},
        "match": {"name": match["name"], "kind": match["kind"], "state": match["state"]},
    }


HANDLERS = {
    "historical_weather": historical_weather,
    "climate_baseline": climate_baseline,
    "cyclone_history": cyclone_history,
    "flood_history": flood_history,
    "district_flood_metrics": district_flood_metrics,
    "heatwave_history": heatwave_history,
    "resolve_location": resolve_location,
}


def main() -> None:
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict):
            raise ValueError("Request must be a JSON object")
        action = require_text(request, "action")
        if action not in HANDLERS:
            raise ValueError(f"Unsupported action: {action}")
        database = Path(os.environ.get("WEATHERGPT_RAG_DB", str(DEFAULT_DATABASE)))
        if not database.is_file():
            raise FileNotFoundError(f"Retrieval database not found: {database}. Run ingest_cleaned_data.py first.")
        connection = sqlite3.connect(database)
        connection.row_factory = sqlite3.Row
        try:
            result = HANDLERS[action](connection, request)
        finally:
            connection.close()
        print(json.dumps({"ok": True, "action": action, "result": result}, allow_nan=False))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
