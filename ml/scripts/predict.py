# ml/scripts/predict.py
# This script is designed to be run from another script.
# It should be silent except for its final output.

import os
# Suppress TensorFlow logging before other imports
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 

import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model
from joblib import load
import sys

def make_prediction(target_ticker: str):
    """Loads the model and latest data to make a single prediction."""
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    MODEL_DIR = os.path.join(PROJECT_ROOT, 'ml', 'models')
    PROCESSED_DATA_PATH = os.path.join(PROJECT_ROOT, 'ml', 'processed_data', 'historical_features.csv')
    
    MODEL_PATH = os.path.join(MODEL_DIR, f'rnn_model_{target_ticker.lower()}_v1.h5')
    SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.gz')
    
    TIMESTEPS = 3
    TARGET_FEATURE = 'predicted_next_day_pct'

    # --- Load Artifacts ---
    model = load_model(MODEL_PATH, compile=False) # No need to compile for prediction
    scaler = load(SCALER_PATH)

    # --- Load and Prepare Data ---
    df = pd.read_csv(PROCESSED_DATA_PATH, index_col='date', parse_dates=True)
    df.ffill(inplace=True)
    df.bfill(inplace=True)
    df.fillna(0, inplace=True)

    target_column_name = f'{target_ticker}_{TARGET_FEATURE}'
    target_col_index = df.columns.get_loc(target_column_name)

    last_sequence_scaled = scaler.transform(df.tail(TIMESTEPS))
    input_data = np.reshape(last_sequence_scaled, (1, TIMESTEPS, last_sequence_scaled.shape[1]))

    # --- Make Prediction ---
    predicted_value_scaled = model.predict(input_data, verbose=0)[0][0]

    # --- Inverse Transform ---
    dummy_array = np.zeros((1, len(df.columns)))
    dummy_array[0, target_col_index] = predicted_value_scaled
    inversed_prediction_array = scaler.inverse_transform(dummy_array)
    final_prediction = inversed_prediction_array[0, target_col_index]

    # --- FINAL, CLEAN OUTPUT ---
    # This is the only thing the script should print.
    print(f'"{target_ticker}": {final_prediction:.4f}')

if __name__ == "__main__":
    if len(sys.argv) > 1:
        make_prediction(sys.argv[1].upper())