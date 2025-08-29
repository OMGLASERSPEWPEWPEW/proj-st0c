# ml/scripts/train.py
# This script loads processed data, prepares it for the RNN, and runs training.

import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from ml.src.model import build_model # Import our model builder
from joblib import dump

# --- Configuration ---
# How many past days of data to use for predicting the next day.
TIMESTEPS = 3 
TARGET_FEATURE = 'predicted_next_day_pct'

def load_and_preprocess_data(file_path: str):
    """Loads and preprocesses data from the CSV file."""
    print(f"train.load_and_preprocess_data: Loading data from {file_path}")
    df = pd.read_csv(file_path, index_col='date', parse_dates=True)
    
    # Simple forward-fill to handle missing values
    df.fillna(method='ffill', inplace=True)
    df.fillna(method='bfill', inplace=True) # Backward fill for any remaining NaNs at the start
    
    if df.isnull().sum().sum() > 0:
        print("train.load_and_preprocess_data: Warning! Null values remain after filling.")
        print(df.isnull().sum())
        # As a last resort, fill remaining NaNs with 0
        df.fillna(0, inplace=True)
        
    print("train.load_and_preprocess_data: Data loaded and cleaned.")
    return df

def create_sequences(data, target_col_index, timesteps):
    """Creates sequences of data for the RNN."""
    X, y = [], []
    for i in range(len(data) - timesteps):
        X.append(data[i:(i + timesteps)])
        y.append(data[i + timesteps, target_col_index])
    return np.array(X), np.array(y)

def main(target_ticker: str):
    """Main function to run the training process."""
    # --- Paths ---
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    PROCESSED_DATA_PATH = os.path.join(PROJECT_ROOT, 'ml', 'processed_data', 'historical_features.csv')
    MODEL_OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'ml', 'models')
    os.makedirs(MODEL_OUTPUT_DIR, exist_ok=True)
    
    # --- Load Data ---
    df = load_and_preprocess_data(PROCESSED_DATA_PATH)
    
    # --- Feature Scaling ---
    # Scale all features to be between 0 and 1. This is crucial for neural networks.
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(df)
    
    # --- Create Sequences ---
    target_column_name = f'{target_ticker}_{TARGET_FEATURE}'
    target_col_index = df.columns.get_loc(target_column_name)
    
    X, y = create_sequences(scaled_data, target_col_index, TIMESTEPS)
    
    if X.shape[0] == 0:
        print(f"train.main: Not enough data to create sequences with {TIMESTEPS} timesteps. Need at least {TIMESTEPS + 1} days of data.")
        return
        
    print(f"train.main: Created {X.shape[0]} sequences of shape {X.shape[1:]}")
    
    # --- Split Data ---
    # We will use 80% of the data for training and 20% for validation.
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # --- Build and Train Model ---
    model = build_model(input_shape=(X_train.shape[1], X_train.shape[2]))
    
    print("\n" + "="*50)
    print("train.main: Starting model training...")
    print("="*50 + "\n")
    
    history = model.fit(
        X_train, y_train,
        epochs=50, # How many times to go over the data
        batch_size=1, # Process one sequence at a time
        validation_data=(X_val, y_val),
        verbose=1
    )
    
    # --- Save Model & Scaler ---
    model_save_path = os.path.join(MODEL_OUTPUT_DIR, f'rnn_model_{target_ticker.lower()}_v1.h5')
    model.save(model_save_path)
    
    # ADD THESE LINES TO SAVE THE SCALER
    
    scaler_save_path = os.path.join(MODEL_OUTPUT_DIR, 'scaler.gz')
    dump(scaler, scaler_save_path)
    
    print("\n" + "="*50)
    print("train.main: Training complete!")
    print(f"train.main: Model saved to: {model_save_path}")
    print(f"train.main: Scaler saved to: {scaler_save_path}") # ADD THIS LINE
    print("="*50 + "\n")

if __name__ == "__main__":
    # --- ADD ARGUMENT PARSING ---
    import argparse
    parser = argparse.ArgumentParser(description="Train RNN model for a specific ticker.")
    parser.add_argument("ticker", type=str, help="The stock ticker to train (e.g., OKLO).")
    args = parser.parse_args()
    
    main(args.ticker.upper()) # Pass ticker to main

# File: ml/scripts/train.py - Character count: 3951