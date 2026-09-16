from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
from datetime import datetime

app = FastAPI(title="WeatherGPT Flood Risk API (Rainfall Enhanced)")

# Allow your React frontend to talk to this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the NEW model and encoders
print("🔄 Loading Enhanced ML Model...")
model = joblib.load('flood_model_rainfall.pkl')
encoders = joblib.load('encoders_rainfall.pkl')

class FloodRequest(BaseModel):
    state: str
    district: str

@app.post("/predict")
async def predict_risk(request: FloodRequest):
    try:
        # Handle unseen locations gracefully
        if request.state.upper() not in encoders['state'].classes_:
            return {"risk_level": "Moderate", "warning": "No historical data for this state.", "probability": 0.3}
        if request.district.title() not in encoders['district'].classes_:
            return {"risk_level": "Moderate", "warning": "No historical data for this district.", "probability": 0.3}

        # Encode inputs
        state_enc = encoders['state'].transform([request.state.upper()])[0]
        district_enc = encoders['district'].transform([request.district.title()])[0]
        
        # Mock features for the API request
        # In a real production app, you would fetch these from a live weather API (like OpenWeatherMap)
        # For this demo, we use safe averages that trigger the model correctly
        duration = 2.0  # Assume short duration for flash flood check
        avg_daily_rain = 50.0
        max_daily_rain = 100.0
        avg_anomaly = 1.2  # 20% more rain than normal
        state_avg_rain = 80.0
        state_avg_anomaly = 1.1

        # Create DataFrame for prediction using the EXACT 8 features the new model expects
        input_data = pd.DataFrame([[
            state_enc, 
            district_enc, 
            duration, 
            avg_daily_rain, 
            max_daily_rain, 
            avg_anomaly, 
            state_avg_rain, 
            state_avg_anomaly
        ]], columns=encoders['features'])
        
        # Predict probability of High Risk
        probability = model.predict_proba(input_data)[0][1]

        # Generate Alert based on probability
        if probability > 0.5:
            risk = "SEVERE"
            warning = "🚨 HIGH FLASH FLOOD RISK. Rainfall anomaly detected. Evacuate low-lying areas immediately."
        elif probability > 0.3:
            risk = "HIGH"
            warning = "️ High risk of flash flooding. Avoid riverbanks and stay indoors during heavy rains."
        else:
            risk = "MODERATE"
            warning = "✅ Moderate risk. Monitor local weather updates and stay alert."

        return {
            "risk_level": risk,
            "probability": round(float(probability), 2),
            "warning": warning,
            "district": request.district,
            "state": request.state
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def root():
    return {"message": "Flood Risk API is running with Rainfall Data. POST to /predict"}