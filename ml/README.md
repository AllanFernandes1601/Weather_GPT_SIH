# WeatherGPT ML

This directory is reserved for the project's machine-learning work. It is intentionally a scaffold: no model, dataset, or training pipeline has been implemented yet.

## Initial goal

Predict the probability of measurable rainfall during the **next hour** for a selected location, using real historical weather data from Open-Meteo.

The initial target should be a binary label derived from hourly historical precipitation, for example:

```text
rain_next_hour = 1 if precipitation at t + 1 is greater than 0 mm; otherwise 0
```

The model output should be a calibrated probability from 0 to 1, rather than only a yes/no forecast.

## Planned workflow

1. Fetch historical hourly weather records from Open-Meteo for selected Indian locations and date ranges.
2. Store raw source downloads under `data/raw/` and derived, versioned datasets under `data/processed/` (both ignored until data work begins).
3. Build time-safe features using only observations available at prediction time, such as temperature, relative humidity, dew point, pressure, wind, cloud cover, precipitation history, hour, and season.
4. Split data chronologically into training, validation, and test periods; do not randomly shuffle time series observations.
5. Establish a baseline (persistence or logistic regression), then evaluate tree-based classifiers.
6. Evaluate probability quality with Brier score and calibration in addition to classification metrics such as PR-AUC, ROC-AUC, recall, and precision.
7. Serialize the selected model and its preprocessing metadata under `models/` for a later inference integration.

## Directory layout

```text
ml/
├── data/          # Historical Open-Meteo data and derived datasets (not committed by default)
├── models/        # Trained model artifacts (not committed by default)
├── scripts/       # Future data-fetching, feature, training, and evaluation scripts
├── requirements.txt
└── README.md
```

## Environment

Use a dedicated virtual environment, then install the planned dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
```

Open-Meteo historical weather data can be retrieved without embedding credentials in this repository. Any future API keys or deployment settings must be supplied through environment variables and never committed.
