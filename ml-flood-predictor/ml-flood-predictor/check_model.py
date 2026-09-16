import streamlit as st
import pandas as pd
import joblib

st.set_page_config(page_title="Weather GPT - Flood Predictor", page_icon="🌊", layout="centered")
st.title("🌊 AI Flood Risk Predictor")
st.markdown("Enter the details below to get an instant, AI-powered flood risk assessment.")

# 1. Load Model
@st.cache_resource
def load_model():
    return joblib.load('flood_model_final_rivers.pkl')

model = load_model()

# The EXACT 26 features the model was trained on (in exact order)
EXPECTED_FEATURES = [
    'Unnamed: 0', 'UEI', 'Start Date', 'End Date', 'Duration(Days)', 'Main Cause',
    'Location', 'Districts', 'Latitude', 'Longitude', 'Area Affected',
    'Human fatality', 'Human injured', 'Human Displaced', 'Animal Fatality',
    'Description of Casualties/injured', 'Extent of damage ', 'Event Source',
    'Event Souce ID', 'District_LGD_Codes', 'State_Codes', 'Avg_Discharge',
    'Max_Discharge', 'Min_Discharge', 'Std_Discharge', 'Total_Readings'
]

# 2. User Input Form
with st.form("flood_form"):
    st.subheader(" Location Details")
    col1, col2 = st.columns(2)
    state = col1.text_input("State", "Kerala")
    district = col2.text_input("District", "Wayanad")
    
    st.subheader("🌧️ Weather & River Conditions")
    col3, col4 = st.columns(2)
    rain = col3.number_input("Max Daily Rainfall (mm)", min_value=0.0, value=50.0)
    duration = col4.number_input("Expected Duration (Days)", min_value=0, value=3)
    
    discharge = st.number_input("Avg River Discharge (cumecs)", min_value=0.0, value=100.0)
    
    submitted = st.form_submit_button("🔮 Predict Flood Risk", use_container_width=True, type="primary")

# 3. Prediction Logic
if submitted:
    with st.spinner("Analyzing historical data and river discharge patterns..."):
        try:
            # Create a dictionary with ALL 26 features, defaulting to 0
            input_dict = {col: 0 for col in EXPECTED_FEATURES}
            
            # Map user inputs to the exact column names the model expects
            input_dict['Duration(Days)'] = duration
            input_dict['Avg_Discharge'] = discharge
            input_dict['Max_Discharge'] = rain # Using rain as a proxy for max discharge if not separate
            
            # Create DataFrame with the exact column order
            input_df = pd.DataFrame([input_dict], columns=EXPECTED_FEATURES)
            
            # Predict
            prediction = model.predict(input_df)[0]
            probabilities = model.predict_proba(input_df)[0]
            
            # 4. Display Results
            st.divider()
            if prediction == 1:
                st.error("⚠️ HIGH FLOOD RISK DETECTED!")
                st.metric("Risk Confidence", f"{probabilities[1]*100:.1f}%")
                st.warning("Recommendation: Immediate evacuation protocols and safety measures advised for this region.")
            else:
                st.success("✅ LOW FLOOD RISK")
                st.metric("Safety Confidence", f"{probabilities[0]*100:.1f}%")
                st.info("Recommendation: Conditions appear stable. Continue routine monitoring.")
                
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")