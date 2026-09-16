#!/usr/bin/env python3
"""Collect resumable city-year Open-Meteo data for rainfall correction research.

This script downloads historical forecast inputs and ERA5 target weather data
for the specified Indian cities. It does not train or modify any model.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd


ML_DIRECTORY = Path(__file__).resolve().parents[1]
DATA_DIRECTORY = ML_DIRECTORY / "data"
RAW_FORECAST_DIRECTORY = DATA_DIRECTORY / "raw" / "historical_forecast"
RAW_TARGET_DIRECTORY = DATA_DIRECTORY / "raw" / "historical_weather_targets"
PROCESSED_DIRECTORY = DATA_DIRECTORY / "processed"
REGISTRY_PATH = DATA_DIRECTORY / "city_registry.csv"
MANIFEST_PATH = PROCESSED_DIRECTORY / "rainfall_correction_manifest.json"

HISTORICAL_FORECAST_API = "https://historical-forecast-api.open-meteo.com/v1/forecast"
HISTORICAL_WEATHER_API = "https://archive-api.open-meteo.com/v1/archive"
TIMEZONE = "Asia/Kolkata"
FORECAST_MODEL = "gfs_global"
TARGET_MODEL = "era5"
YEARS = range(2022, 2026)
MAX_ATTEMPTS = 4

CITIES = [
    {"city_id": "bengaluru", "city": "Bengaluru", "state": "Karnataka", "latitude": 12.9716, "longitude": 77.5946},
    {"city_id": "mumbai", "city": "Mumbai", "state": "Maharashtra", "latitude": 19.0760, "longitude": 72.8777},
    {"city_id": "delhi", "city": "Delhi", "state": "Delhi", "latitude": 28.6139, "longitude": 77.2090},
    {"city_id": "chennai", "city": "Chennai", "state": "Tamil Nadu", "latitude": 13.0827, "longitude": 80.2707},
    {"city_id": "kolkata", "city": "Kolkata", "state": "West Bengal", "latitude": 22.5726, "longitude": 88.3639},
    {"city_id": "hyderabad", "city": "Hyderabad", "state": "Telangana", "latitude": 17.3850, "longitude": 78.4867},
    {"city_id": "guwahati", "city": "Guwahati", "state": "Assam", "latitude": 26.1445, "longitude": 91.7362},
    {"city_id": "ahmedabad", "city": "Ahmedabad", "state": "Gujarat", "latitude": 23.0225, "longitude": 72.5714},
    {"city_id": "jaipur", "city": "Jaipur", "state": "Rajasthan", "latitude": 26.9124, "longitude": 75.7873},
    {"city_id": "kochi", "city": "Kochi", "state": "Kerala", "latitude": 9.9312, "longitude": 76.2673},
]

FORECAST_VARIABLES = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature",
    "surface_pressure", "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "precipitation_probability",
    "precipitation", "rain", "showers", "weather_code", "visibility", "cape", "lifted_index",
    "convective_inhibition", "boundary_layer_height", "total_column_integrated_water_vapour", "is_day",
]
TARGET_VARIABLES = ["precipitation", "rain", "weather_code"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def expected_times(year: int) -> pd.DatetimeIndex:
    return pd.date_range(f"{year}-01-01 00:00", f"{year}-12-31 23:00", freq="h")


def city_year_path(root: Path, city_id: str, year: int, filename: str) -> Path:
    return root / f"city={city_id}" / f"year={year}" / filename


def request_json(url: str, parameters: dict[str, Any]) -> dict[str, Any]:
    request = Request(
        f"{url}?{urlencode(parameters)}",
        headers={"User-Agent": "WeatherGPT-ML-Collector/1.0"},
    )
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urlopen(request, timeout=90) as response:
                payload = json.load(response)
            if payload.get("error"):
                raise RuntimeError(payload.get("reason", "Unknown Open-Meteo API error"))
            return payload
        except (HTTPError, URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Request failed after {MAX_ATTEMPTS} attempts: {last_error}")


def normalize_payload(
    payload: dict[str, Any], city: dict[str, Any], year: int, source_api: str, source_model: str,
    variables: list[str], prefix: str,
) -> pd.DataFrame:
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict) or "time" not in hourly:
        raise ValueError("Response does not include hourly data")
    missing = [column for column in variables if column not in hourly]
    if missing:
        raise ValueError(f"Response is missing requested hourly variables: {', '.join(missing)}")

    frame = pd.DataFrame({"time": hourly["time"]})
    for variable in variables:
        frame[f"{prefix}{variable}"] = hourly[variable]
    frame["time"] = pd.to_datetime(frame["time"], errors="raise")
    frame.insert(0, "city_id", city["city_id"])
    frame.insert(1, "city", city["city"])
    frame.insert(2, "state", city["state"])
    frame["latitude_requested"] = city["latitude"]
    frame["longitude_requested"] = city["longitude"]
    frame["latitude_returned"] = payload.get("latitude")
    frame["longitude_returned"] = payload.get("longitude")
    frame["elevation_returned"] = payload.get("elevation")
    frame["timezone"] = payload.get("timezone", TIMEZONE)
    frame["source_api"] = source_api
    frame["source_model"] = source_model
    frame["source_generationtime_ms"] = payload.get("generationtime_ms")
    frame["fetched_at_utc"] = utc_now()
    frame["year"] = year
    return frame


def validate_frame(frame: pd.DataFrame, year: int, label: str) -> dict[str, Any]:
    expected = expected_times(year)
    actual = pd.DatetimeIndex(frame["time"])
    if len(frame) != len(expected):
        raise ValueError(f"{label}: expected {len(expected)} rows, received {len(frame)}")
    if actual.has_duplicates or not actual.is_monotonic_increasing:
        raise ValueError(f"{label}: timestamps must be unique and ordered")
    if not actual.equals(expected):
        raise ValueError(
            f"{label}: expected {expected[0]} to {expected[-1]}, received {actual[0]} to {actual[-1]}"
        )
    return {"rows": len(frame), "start": str(actual[0]), "end": str(actual[-1])}


def validate_processed_frame(frame: pd.DataFrame, year: int, label: str) -> dict[str, Any]:
    expected = expected_times(year)[:-1]
    actual = pd.DatetimeIndex(frame["time"])
    if len(frame) != len(expected):
        raise ValueError(f"{label}: expected {len(expected)} rows, received {len(frame)}")
    if actual.has_duplicates or not actual.is_monotonic_increasing or not actual.equals(expected):
        raise ValueError(f"{label}: timestamps do not match the expected t+1 training range")
    return {"rows": len(frame), "start": str(actual[0]), "end": str(actual[-1])}


def read_valid_parquet(path: Path, year: int, label: str) -> tuple[pd.DataFrame | None, dict[str, Any] | None]:
    if not path.exists():
        return None, None
    try:
        frame = pd.read_parquet(path)
        return frame, validate_frame(frame, year, label)
    except Exception as error:
        print(f"Re-fetching invalid {label} at {path}: {error}", file=sys.stderr)
        return None, None


def write_parquet(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(".parquet.tmp")
    frame.to_parquet(temporary_path, index=False, engine="pyarrow", compression="zstd")
    temporary_path.replace(path)


def fetch_source(city: dict[str, Any], year: int, source: str) -> tuple[pd.DataFrame, dict[str, Any], str]:
    start_date, end_date = f"{year}-01-01", f"{year}-12-31"
    if source == "forecast":
        url, model, variables, prefix = HISTORICAL_FORECAST_API, FORECAST_MODEL, FORECAST_VARIABLES, "forecast_"
    else:
        url, model, variables, prefix = HISTORICAL_WEATHER_API, TARGET_MODEL, TARGET_VARIABLES, "target_"
    payload = request_json(
        url,
        {
            "latitude": city["latitude"], "longitude": city["longitude"],
            "start_date": start_date, "end_date": end_date, "hourly": ",".join(variables),
            "timezone": TIMEZONE, "models": model,
        },
    )
    frame = normalize_payload(payload, city, year, url, model, variables, prefix)
    validation = validate_frame(frame, year, f"{city['city_id']} {year} {source}")
    return frame, validation, url


def create_processed_frame(forecast: pd.DataFrame, target: pd.DataFrame, year: int) -> tuple[pd.DataFrame, dict[str, Any]]:
    target_columns = ["time", "target_precipitation", "target_rain", "target_weather_code"]
    merged = forecast.merge(target[target_columns], on="time", how="inner", validate="one_to_one")
    if len(merged) != len(forecast):
        raise ValueError("Forecast and target time series do not align")
    merged["target_precipitation_mm_t_plus_1"] = merged["target_precipitation"].shift(-1)
    merged["target_rain_mm_t_plus_1"] = merged["target_rain"].shift(-1)
    merged["target_weather_code_t_plus_1"] = merged["target_weather_code"].shift(-1)
    merged["target_rain_event_t_plus_1"] = (merged["target_rain_mm_t_plus_1"] > 0).astype("int8")
    processed = merged.iloc[:-1].copy()
    validation = validate_frame(merged, year, "processed alignment")
    return processed, {"rows": len(processed), "source_rows": validation["rows"], "start": str(processed["time"].iloc[0]), "end": str(processed["time"].iloc[-1])}


def load_manifest() -> dict[str, Any]:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {
        "dataset": "weathergpt_rainfall_correction",
        "timezone": TIMEZONE,
        "forecast_source": {"api": HISTORICAL_FORECAST_API, "model": FORECAST_MODEL, "variables": FORECAST_VARIABLES},
        "target_source": {"api": HISTORICAL_WEATHER_API, "model": TARGET_MODEL, "variables": TARGET_VARIABLES},
        "city_years": {},
    }


def save_manifest(manifest: dict[str, Any]) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest["updated_at_utc"] = utc_now()
    temporary_path = MANIFEST_PATH.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    temporary_path.replace(MANIFEST_PATH)


def process_city_year(city: dict[str, Any], year: int, manifest: dict[str, Any]) -> bool:
    key = f"{city['city_id']}-{year}"
    forecast_path = city_year_path(RAW_FORECAST_DIRECTORY, city["city_id"], year, "hourly.parquet")
    target_path = city_year_path(RAW_TARGET_DIRECTORY, city["city_id"], year, "hourly.parquet")
    processed_path = city_year_path(PROCESSED_DIRECTORY, city["city_id"], year, "rainfall_correction.parquet")
    entry: dict[str, Any] = {"city_id": city["city_id"], "year": year, "status": "in_progress", "updated_at_utc": utc_now()}
    manifest["city_years"][key] = entry
    save_manifest(manifest)

    try:
        forecast, forecast_validation = read_valid_parquet(forecast_path, year, f"{key} forecast")
        if forecast is None:
            forecast, forecast_validation, _ = fetch_source(city, year, "forecast")
            write_parquet(forecast, forecast_path)

        target, target_validation = read_valid_parquet(target_path, year, f"{key} target")
        if target is None:
            target, target_validation, _ = fetch_source(city, year, "target")
            write_parquet(target, target_path)

        processed = None
        processed_validation = None
        if processed_path.exists():
            try:
                processed = pd.read_parquet(processed_path)
                processed_validation = validate_processed_frame(processed, year, f"{key} processed")
            except Exception as error:
                print(f"Re-building invalid processed data at {processed_path}: {error}", file=sys.stderr)
        if processed is None or len(processed) != len(forecast) - 1:
            processed, processed_validation = create_processed_frame(forecast, target, year)
            write_parquet(processed, processed_path)

        entry.update(
            {
                "status": "complete",
                "forecast": {**forecast_validation, "path": str(forecast_path.relative_to(ML_DIRECTORY)), "bytes": forecast_path.stat().st_size},
                "target": {**target_validation, "path": str(target_path.relative_to(ML_DIRECTORY)), "bytes": target_path.stat().st_size},
                "processed": {**processed_validation, "path": str(processed_path.relative_to(ML_DIRECTORY)), "bytes": processed_path.stat().st_size},
                "updated_at_utc": utc_now(),
            }
        )
        save_manifest(manifest)
        print(f"Complete: {key} ({processed_validation['rows']} processed rows)")
        return True
    except Exception as error:
        entry.update({"status": "failed", "error": str(error), "updated_at_utc": utc_now()})
        save_manifest(manifest)
        print(f"Failed: {key}: {error}", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", choices=[city["city_id"] for city in CITIES], help="Collect one city only")
    parser.add_argument("--year", type=int, choices=list(YEARS), help="Collect one year only")
    args = parser.parse_args()

    DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(CITIES).to_csv(REGISTRY_PATH, index=False)
    manifest = load_manifest()
    selected_cities = [city for city in CITIES if args.city is None or city["city_id"] == args.city]
    selected_years = [year for year in YEARS if args.year is None or year == args.year]

    completed = failed = 0
    for city in selected_cities:
        for year in selected_years:
            if process_city_year(city, year, manifest):
                completed += 1
            else:
                failed += 1
            time.sleep(0.25)

    print(f"Collection complete: {completed} city-years succeeded, {failed} failed.")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
