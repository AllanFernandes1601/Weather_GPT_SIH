#!/usr/bin/env python3
"""Train Bengaluru's first next-hour rainfall classifier using XGBoost.

The input must be the real Open-Meteo historical CSV created by
fetch_historical_weather.py. Features at time t are used to predict whether
the recorded rain at t + 1 hour is greater than zero.
"""

from __future__ import annotations

import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import brier_score_loss, f1_score, precision_score, recall_score, roc_auc_score
from xgboost import XGBClassifier


ML_DIRECTORY = Path(__file__).resolve().parents[1]
DATA_PATH = ML_DIRECTORY / "data" / "bengaluru_weather.csv"
MODEL_PATH = ML_DIRECTORY / "models" / "rain_model.pkl"
TEST_FRACTION = 0.20
THRESHOLD = 0.50

BASE_WEATHER_FEATURES = [
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
]


def load_and_engineer_features(path: Path) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """Load observations chronologically and create features available at time t."""
    if not path.exists():
        raise FileNotFoundError(
            f"Historical data was not found at {path}. Run fetch_historical_weather.py first."
        )

    data = pd.read_csv(path)
    required_columns = {"time", *BASE_WEATHER_FEATURES}
    missing_columns = sorted(required_columns - set(data.columns))
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing_columns)}")

    data["time"] = pd.to_datetime(data["time"], errors="raise")
    data = data.sort_values("time").drop_duplicates("time").reset_index(drop=True)

    # The label is explicitly shifted into the future; all feature values stay at or before t.
    data["rain_next_hour"] = (data["rain"].shift(-1) > 0).astype("int8")
    data = data.iloc[:-1].copy()  # The final timestamp has no observed next hour.

    hour = data["time"].dt.hour
    day_of_year = data["time"].dt.dayofyear
    data["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    data["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    data["day_of_year_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    data["day_of_year_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)
    data["is_monsoon_season"] = data["time"].dt.month.isin([6, 7, 8, 9]).astype("int8")

    # Lagged and trailing-rain features only include the current and earlier observations.
    for column in ("rain", "precipitation", "relative_humidity_2m", "cloud_cover", "surface_pressure"):
        data[f"{column}_lag_1h"] = data[column].shift(1)
    data["rain_trailing_3h"] = data["rain"].rolling(window=3, min_periods=1).sum()
    data["rain_trailing_6h"] = data["rain"].rolling(window=6, min_periods=1).sum()
    data["precipitation_trailing_6h"] = data["precipitation"].rolling(window=6, min_periods=1).sum()

    time_features = [
        "hour_sin",
        "hour_cos",
        "day_of_year_sin",
        "day_of_year_cos",
        "is_monsoon_season",
    ]
    lag_features = [
        "rain_lag_1h",
        "precipitation_lag_1h",
        "relative_humidity_2m_lag_1h",
        "cloud_cover_lag_1h",
        "surface_pressure_lag_1h",
        "rain_trailing_3h",
        "rain_trailing_6h",
        "precipitation_trailing_6h",
    ]
    feature_names = [*BASE_WEATHER_FEATURES, *time_features, *lag_features]
    return data[feature_names], data["rain_next_hour"], data["time"]


def train_and_evaluate(features: pd.DataFrame, target: pd.Series, times: pd.Series) -> dict:
    """Fit on the oldest observations and evaluate on the newest held-out period."""
    split_index = int(len(features) * (1 - TEST_FRACTION))
    if split_index <= 0 or split_index >= len(features):
        raise ValueError("Dataset is too small for the configured chronological split.")

    x_train, x_test = features.iloc[:split_index], features.iloc[split_index:]
    y_train, y_test = target.iloc[:split_index], target.iloc[split_index:]
    imputer = SimpleImputer(strategy="median")
    x_train_imputed = imputer.fit_transform(x_train)
    x_test_imputed = imputer.transform(x_test)

    positive_count = int(y_train.sum())
    negative_count = len(y_train) - positive_count
    if positive_count == 0 or negative_count == 0:
        raise ValueError("Training period must contain both rainy and non-rainy hours.")

    model = XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        n_estimators=350,
        max_depth=4,
        learning_rate=0.05,
        min_child_weight=3,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=negative_count / positive_count,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_train_imputed, y_train)

    probabilities = model.predict_proba(x_test_imputed)[:, 1]
    predictions = (probabilities >= THRESHOLD).astype(int)
    metrics = {
        "precision": precision_score(y_test, predictions, zero_division=0),
        "recall": recall_score(y_test, predictions, zero_division=0),
        "f1": f1_score(y_test, predictions, zero_division=0),
        "roc_auc": roc_auc_score(y_test, probabilities),
        "brier_score": brier_score_loss(y_test, probabilities),
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model_bundle = {
        "model": model,
        "imputer": imputer,
        "feature_names": list(features.columns),
        "threshold": THRESHOLD,
        "target": "rain_next_hour: rain at t + 1 hour > 0 mm",
        "training_period": {"start": str(times.iloc[0]), "end": str(times.iloc[split_index - 1])},
        "test_period": {"start": str(times.iloc[split_index]), "end": str(times.iloc[-1])},
        "metrics": metrics,
    }
    with MODEL_PATH.open("wb") as model_file:
        pickle.dump(model_bundle, model_file)

    return {
        "train_rows": len(x_train),
        "test_rows": len(x_test),
        "train_rain_rate": float(y_train.mean()),
        "test_rain_rate": float(y_test.mean()),
        "training_period": model_bundle["training_period"],
        "test_period": model_bundle["test_period"],
        "metrics": metrics,
    }


def main() -> None:
    features, target, times = load_and_engineer_features(DATA_PATH)
    result = train_and_evaluate(features, target, times)

    print("Chronological split (oldest 80% train, newest 20% test)")
    print(f"Training rows: {result['train_rows']} | rain rate: {result['train_rain_rate']:.2%}")
    print(f"Test rows:     {result['test_rows']} | rain rate: {result['test_rain_rate']:.2%}")
    print(f"Training period: {result['training_period']['start']} to {result['training_period']['end']}")
    print(f"Test period:     {result['test_period']['start']} to {result['test_period']['end']}")
    print("Evaluation at probability threshold 0.50:")
    for name, value in result["metrics"].items():
        print(f"  {name}: {value:.4f}")
    print(f"Saved model bundle to {MODEL_PATH}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, ImportError) as exc:
        print(f"Training failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
