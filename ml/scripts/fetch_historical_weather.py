#!/usr/bin/env python3
"""Download hourly Open-Meteo historical weather data for Bengaluru.

The output is intended as the raw input for the next-hour rainfall-probability
project. It contains observations only; this script does not create labels,
features, or a model.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_URL = "https://archive-api.open-meteo.com/v1/archive"
BENGALURU_LATITUDE = 12.9716
BENGALURU_LONGITUDE = 77.5946
START_DATE = "2024-01-01"
END_DATE = "2025-12-31"
HOURLY_VARIABLES = (
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "surface_pressure",
    "cloud_cover",
    "wind_speed_10m",
    "wind_gusts_10m",
    "precipitation",
    "rain",
    "weather_code",
)

ML_DIRECTORY = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ML_DIRECTORY / "data" / "bengaluru_weather.csv"


def fetch_historical_weather() -> dict[str, Any]:
    """Request Bengaluru hourly observations from Open-Meteo's archive API."""
    query = urlencode(
        {
            "latitude": BENGALURU_LATITUDE,
            "longitude": BENGALURU_LONGITUDE,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "hourly": ",".join(HOURLY_VARIABLES),
            "timezone": "Asia/Kolkata",
        }
    )
    request = Request(
        f"{API_URL}?{query}", headers={"User-Agent": "WeatherGPT-ML/1.0"}
    )

    try:
        with urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Open-Meteo returned HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach Open-Meteo: {exc.reason}") from exc

    if payload.get("error"):
        raise RuntimeError(f"Open-Meteo API error: {payload.get('reason', payload)}")
    return payload


def validate_hourly_payload(payload: dict[str, Any]) -> dict[str, list[Any]]:
    """Confirm the API returned aligned hourly arrays for every requested field."""
    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise RuntimeError("Open-Meteo response does not contain an hourly data object.")

    required_fields = ("time",) + HOURLY_VARIABLES
    missing = [field for field in required_fields if field not in hourly]
    if missing:
        raise RuntimeError(f"Open-Meteo response is missing hourly fields: {', '.join(missing)}")

    row_count = len(hourly["time"])
    if row_count == 0:
        raise RuntimeError("Open-Meteo returned no hourly rows.")

    misaligned = [field for field in required_fields if len(hourly[field]) != row_count]
    if misaligned:
        raise RuntimeError(f"Hourly arrays have inconsistent lengths: {', '.join(misaligned)}")

    return hourly


def write_csv(hourly: dict[str, list[Any]], output_path: Path) -> int:
    """Write the validated observations atomically as a CSV file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(".csv.tmp")
    fieldnames = ["time", *HOURLY_VARIABLES]

    with temporary_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for index, timestamp in enumerate(hourly["time"]):
            writer.writerow({field: hourly[field][index] for field in fieldnames})

    temporary_path.replace(output_path)
    return len(hourly["time"])


def main() -> None:
    payload = fetch_historical_weather()
    hourly = validate_hourly_payload(payload)
    row_count = write_csv(hourly, OUTPUT_PATH)
    print(f"Downloaded {row_count} hourly Bengaluru observations to {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"Download failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
