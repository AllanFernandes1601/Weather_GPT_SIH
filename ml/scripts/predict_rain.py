#!/usr/bin/env python3
"""Run Bengaluru next-hour rain inference from a JSON weather payload on stdin."""

from __future__ import annotations

import json
import pickle
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ML_DIRECTORY = Path(__file__).resolve().parents[1]
MODEL_PATH = ML_DIRECTORY / "models" / "rain_model.pkl"
BASE_WEATHER_FEATURES = (
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


def as_number(value: Any, field: str) -> float:
    if value is None:
        raise ValueError(f"Missing value for {field}")
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid numeric value for {field}") from exc


def hourly_index(hourly: dict[str, Any], current_time: str) -> int:
    times = hourly.get("time")
    if not isinstance(times, list):
        raise ValueError("Hourly weather data is missing timestamps")

    hour_prefix = current_time[:13]
    index = next((i for i, value in enumerate(times) if str(value).startswith(hour_prefix)), -1)
    if index < 5:
        raise ValueError("At least six current/past hourly weather records are required")
    return index


def hourly_value(hourly: dict[str, Any], field: str, index: int) -> float:
    values = hourly.get(field)
    if not isinstance(values, list) or len(values) <= index:
        raise ValueError(f"Hourly weather data is missing {field}")
    return as_number(values[index], field)


def build_features(weather: dict[str, Any], feature_names: list[str]) -> pd.DataFrame:
    current = weather.get("current")
    hourly = weather.get("hourly")
    if not isinstance(current, dict) or not isinstance(hourly, dict):
        raise ValueError("Weather payload must include current and hourly observations")

    current_time = str(current.get("time", ""))
    if not current_time:
        raise ValueError("Current weather timestamp is missing")
    try:
        observed_at = datetime.fromisoformat(current_time)
    except ValueError as exc:
        raise ValueError("Current weather timestamp is invalid") from exc

    index = hourly_index(hourly, current_time)
    features = {field: as_number(current.get(field), field) for field in BASE_WEATHER_FEATURES}
    features.update(
        {
            "hour_sin": np.sin(2 * np.pi * observed_at.hour / 24),
            "hour_cos": np.cos(2 * np.pi * observed_at.hour / 24),
            "day_of_year_sin": np.sin(2 * np.pi * observed_at.timetuple().tm_yday / 365.25),
            "day_of_year_cos": np.cos(2 * np.pi * observed_at.timetuple().tm_yday / 365.25),
            "is_monsoon_season": int(observed_at.month in (6, 7, 8, 9)),
            "rain_lag_1h": hourly_value(hourly, "rain", index - 1),
            "precipitation_lag_1h": hourly_value(hourly, "precipitation", index - 1),
            "relative_humidity_2m_lag_1h": hourly_value(hourly, "relative_humidity_2m", index - 1),
            "cloud_cover_lag_1h": hourly_value(hourly, "cloud_cover", index - 1),
            "surface_pressure_lag_1h": hourly_value(hourly, "surface_pressure", index - 1),
        }
    )

    # Use the current observation at t and prior observations only, matching training.
    rain_values = [hourly_value(hourly, "rain", i) for i in range(index - 5, index)] + [features["rain"]]
    precipitation_values = [
        hourly_value(hourly, "precipitation", i) for i in range(index - 5, index)
    ] + [features["precipitation"]]
    features["rain_trailing_3h"] = sum(rain_values[-3:])
    features["rain_trailing_6h"] = sum(rain_values)
    features["precipitation_trailing_6h"] = sum(precipitation_values)

    missing_features = [name for name in feature_names if name not in features]
    if missing_features:
        raise ValueError(f"Model requires unsupported features: {', '.join(missing_features)}")
    return pd.DataFrame([[features[name] for name in feature_names]], columns=feature_names)


def main() -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    payload = json.load(sys.stdin)
    with MODEL_PATH.open("rb") as model_file:
        bundle = pickle.load(model_file)

    model = bundle["model"]
    imputer = bundle["imputer"]
    feature_names = bundle["feature_names"]
    features = build_features(payload["weather"], feature_names)
    probability = float(model.predict_proba(imputer.transform(features))[0, 1])
    threshold = float(bundle.get("threshold", 0.5))

    print(
        json.dumps(
            {
                "probability": probability,
                "willRain": probability >= threshold,
                "threshold": threshold,
                "observedAt": payload["weather"]["current"]["time"],
                "modelScope": "Bengaluru",
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        raise SystemExit(1)
