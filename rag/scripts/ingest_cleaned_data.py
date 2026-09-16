#!/usr/bin/env python3
"""Build the local WeatherGPT retrieval database from cleaned CSV exports."""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from pathlib import Path
from typing import Callable, Iterable


DATASETS = {
    "weather_longterm": "weather_india_2000_2024_cleaned.csv",
    "weather_detailed": "weather_india_2015_2025_cleaned.csv",
    "cyclone_tracks": "cyclone_best_tracks_1982_2026_cleaned.csv",
    "flood_events": "flood_inventory_india_cleaned.csv",
    "flood_dfsi": "flood_dfsi_district_cleaned.csv",
    "flood_area": "flood_district_area_cleaned.csv",
    "flood_impact": "flood_district_impact_cleaned.csv",
    "heatwave_days": "heatwave_days_india_2022_2024_cleaned.csv",
}


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;

DROP TABLE IF EXISTS weather_longterm;
DROP TABLE IF EXISTS weather_detailed;
DROP TABLE IF EXISTS cyclone_tracks;
DROP TABLE IF EXISTS flood_events;
DROP TABLE IF EXISTS flood_dfsi;
DROP TABLE IF EXISTS flood_area;
DROP TABLE IF EXISTS flood_impact;
DROP TABLE IF EXISTS heatwave_days;
DROP TABLE IF EXISTS dataset_manifest;

CREATE TABLE weather_longterm (
  city TEXT NOT NULL,
  date TEXT NOT NULL,
  temp_max_c REAL,
  temp_min_c REAL,
  apparent_temp_max_c REAL,
  apparent_temp_min_c REAL,
  precipitation_sum_mm REAL,
  rain_sum_mm REAL,
  weather_code INTEGER,
  wind_speed_10m_max_kmh REAL,
  wind_gusts_10m_max_kmh REAL,
  wind_direction_10m_dominant_deg REAL,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE weather_detailed (
  date TEXT NOT NULL,
  month TEXT,
  season TEXT,
  station_name TEXT,
  state TEXT,
  district TEXT,
  latitude REAL,
  longitude REAL,
  elevation_m REAL,
  temp_mean_c REAL,
  temp_min_c REAL,
  temp_max_c REAL,
  rainfall_mm REAL,
  wind_speed_source_unit_unknown REAL,
  air_pressure_hpa REAL,
  source_file TEXT NOT NULL,
  source_sheet TEXT,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE cyclone_tracks (
  event_id TEXT,
  source_year INTEGER,
  basin TEXT,
  system_name TEXT,
  date TEXT,
  time_utc TEXT,
  timestamp_utc TEXT,
  latitude REAL,
  longitude REAL,
  ci_number REAL,
  central_pressure_hpa REAL,
  max_sustained_wind_kt REAL,
  pressure_drop_hpa REAL,
  grade TEXT,
  source_file TEXT NOT NULL,
  source_sheet TEXT,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE flood_events (
  event_id TEXT NOT NULL,
  start_date TEXT,
  start_date_raw TEXT,
  end_date TEXT,
  end_date_raw TEXT,
  duration_days INTEGER,
  main_cause TEXT,
  districts TEXT,
  state TEXT,
  human_fatalities REAL,
  human_injured REAL,
  human_displaced REAL,
  animal_fatalities REAL,
  damage_description TEXT,
  event_source TEXT,
  district_lgd_codes TEXT,
  state_codes TEXT,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE flood_dfsi (
  district_name TEXT,
  district_name_normalized TEXT,
  state_name TEXT,
  dfsi REAL,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE flood_area (
  district_name TEXT,
  district_name_normalized TEXT,
  percent_flooded_area REAL,
  permanent_water_percent REAL,
  corrected_percent_flooded_area REAL,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE flood_impact (
  district_name TEXT,
  district_name_normalized TEXT,
  human_fatalities REAL,
  human_injured REAL,
  population INTEGER,
  mean_flood_duration_days REAL,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE heatwave_days (
  year INTEGER NOT NULL,
  region_type TEXT NOT NULL,
  region_source_label TEXT NOT NULL,
  region_name TEXT NOT NULL,
  heatwave_days INTEGER NOT NULL,
  source_organization TEXT,
  source_reference TEXT,
  source_url TEXT,
  source_file TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  cleaning_flags TEXT
);

CREATE TABLE dataset_manifest (
  table_name TEXT PRIMARY KEY,
  source_filename TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


INDEXES = """
CREATE INDEX idx_weather_longterm_city_date ON weather_longterm(city COLLATE NOCASE, date);
CREATE INDEX idx_weather_detailed_station_date ON weather_detailed(station_name COLLATE NOCASE, date);
CREATE INDEX idx_weather_detailed_district_date ON weather_detailed(district COLLATE NOCASE, date);
CREATE INDEX idx_weather_detailed_state_date ON weather_detailed(state COLLATE NOCASE, date);
CREATE INDEX idx_cyclone_event_time ON cyclone_tracks(event_id, timestamp_utc);
CREATE INDEX idx_cyclone_year_basin ON cyclone_tracks(source_year, basin COLLATE NOCASE);
CREATE INDEX idx_flood_state_date ON flood_events(state COLLATE NOCASE, start_date);
CREATE INDEX idx_flood_district_date ON flood_events(districts COLLATE NOCASE, start_date);
CREATE INDEX idx_dfsi_district_state ON flood_dfsi(district_name_normalized, state_name COLLATE NOCASE);
CREATE INDEX idx_flood_area_district ON flood_area(district_name_normalized);
CREATE INDEX idx_flood_impact_district ON flood_impact(district_name_normalized);
CREATE INDEX idx_heatwave_region_year ON heatwave_days(region_name COLLATE NOCASE, year);
"""


def nullable_text(value: str) -> str | None:
    value = value.strip()
    return value or None


def nullable_float(value: str) -> float | None:
    value = value.strip()
    return float(value) if value else None


def nullable_int(value: str) -> int | None:
    value = value.strip()
    return int(float(value)) if value else None


def text(value: str) -> str:
    return value.strip()


T = Callable[[str], object]


MAPPINGS: dict[str, list[tuple[str, T]]] = {
    "weather_longterm": [
        ("city", text), ("date", text), ("temp_max_c", nullable_float), ("temp_min_c", nullable_float),
        ("apparent_temp_max_c", nullable_float), ("apparent_temp_min_c", nullable_float),
        ("precipitation_sum_mm", nullable_float), ("rain_sum_mm", nullable_float), ("weather_code", nullable_int),
        ("wind_speed_10m_max_kmh", nullable_float), ("wind_gusts_10m_max_kmh", nullable_float),
        ("wind_direction_10m_dominant_deg", nullable_float), ("source_file", text), ("source_row", nullable_int),
        ("cleaning_flags", nullable_text),
    ],
    "weather_detailed": [
        ("date", text), ("month", nullable_text), ("season", nullable_text), ("station_name", nullable_text),
        ("state", nullable_text), ("district", nullable_text), ("latitude", nullable_float), ("longitude", nullable_float),
        ("elevation_m", nullable_float), ("temp_mean_c", nullable_float), ("temp_min_c", nullable_float),
        ("temp_max_c", nullable_float), ("rainfall_mm", nullable_float),
        ("wind_speed_source_unit_unknown", nullable_float), ("air_pressure_hpa", nullable_float),
        ("source_file", text), ("source_sheet", nullable_text), ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
    "cyclone_tracks": [
        ("event_id", nullable_text), ("source_year", nullable_int), ("basin", nullable_text), ("system_name", nullable_text),
        ("date", nullable_text), ("time_utc", nullable_text), ("timestamp_utc", nullable_text), ("latitude", nullable_float),
        ("longitude", nullable_float), ("ci_number", nullable_float), ("central_pressure_hpa", nullable_float),
        ("max_sustained_wind_kt", nullable_float), ("pressure_drop_hpa", nullable_float), ("grade", nullable_text),
        ("source_file", text), ("source_sheet", nullable_text), ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
    "flood_events": [
        ("event_id", text), ("start_date", nullable_text), ("start_date_raw", nullable_text),
        ("end_date", nullable_text), ("end_date_raw", nullable_text), ("duration_days", nullable_int),
        ("main_cause", nullable_text), ("districts", nullable_text), ("state", nullable_text),
        ("human_fatalities", nullable_float), ("human_injured", nullable_float), ("human_displaced", nullable_float),
        ("animal_fatalities", nullable_float), ("damage_description", nullable_text), ("event_source", nullable_text),
        ("district_lgd_codes", nullable_text), ("state_codes", nullable_text), ("source_file", text),
        ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
    "flood_dfsi": [
        ("district_name", nullable_text), ("district_name_normalized", nullable_text), ("state_name", nullable_text),
        ("dfsi", nullable_float), ("source_file", text), ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
    "flood_area": [
        ("district_name", nullable_text), ("district_name_normalized", nullable_text), ("percent_flooded_area", nullable_float),
        ("permanent_water_percent", nullable_float), ("corrected_percent_flooded_area", nullable_float),
        ("source_file", text), ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
    "flood_impact": [
        ("district_name", nullable_text), ("district_name_normalized", nullable_text), ("human_fatalities", nullable_float),
        ("human_injured", nullable_float), ("population", nullable_int), ("mean_flood_duration_days", nullable_float),
        ("source_file", text), ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
    "heatwave_days": [
        ("year", nullable_int), ("region_type", text), ("region_source_label", text), ("region_name", text),
        ("heatwave_days", nullable_int), ("source_organization", nullable_text), ("source_reference", nullable_text),
        ("source_url", nullable_text), ("source_file", text), ("source_row", nullable_int), ("cleaning_flags", nullable_text),
    ],
}


def rows_for(path: Path, mapping: list[tuple[str, T]]) -> Iterable[tuple[object, ...]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [column for column, _ in mapping if column not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path.name} is missing required columns: {', '.join(missing)}")
        for source_row, row in enumerate(reader, start=2):
            try:
                yield tuple(convert(row[column]) for column, convert in mapping)
            except Exception as exc:
                raise ValueError(f"{path.name}: could not parse CSV row {source_row}: {exc}") from exc


def ingest_table(connection: sqlite3.Connection, table: str, path: Path) -> int:
    mapping = MAPPINGS[table]
    placeholders = ",".join("?" for _ in mapping)
    columns = ",".join(column for column, _ in mapping)
    sql = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
    count = 0
    batch: list[tuple[object, ...]] = []
    for row in rows_for(path, mapping):
        batch.append(row)
        if len(batch) >= 5000:
            connection.executemany(sql, batch)
            count += len(batch)
            batch.clear()
    if batch:
        connection.executemany(sql, batch)
        count += len(batch)
    connection.execute(
        "INSERT INTO dataset_manifest(table_name, source_filename, row_count) VALUES (?, ?, ?)",
        (table, path.name, count),
    )
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True, help="Directory containing cleaned WeatherGPT CSVs")
    parser.add_argument("--database", type=Path, default=Path("rag/data/weathergpt.sqlite"))
    args = parser.parse_args()

    missing = [filename for filename in DATASETS.values() if not (args.data_dir / filename).is_file()]
    if missing:
        raise SystemExit("Missing cleaned inputs: " + ", ".join(missing))

    args.database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(args.database)
    try:
        connection.executescript(SCHEMA)
        counts = {}
        with connection:
            for table, filename in DATASETS.items():
                counts[table] = ingest_table(connection, table, args.data_dir / filename)
        connection.executescript(INDEXES)
        connection.execute("PRAGMA optimize")
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity check failed: {integrity}")
    finally:
        connection.close()

    print(json.dumps({"database": str(args.database.resolve()), "rows": counts, "integrity": "ok"}, indent=2))


if __name__ == "__main__":
    main()
