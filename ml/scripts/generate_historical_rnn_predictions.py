# ml/scripts/generate_historical_rnn_predictions.py
# Generate historical RNN predictions by progressively training on more data

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler
from joblib import dump
import sys

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def parse_single_json(file_path: str) -> dict:
    """Parse a single JSON file and extract features."""
    print(f"generate_historical_rnn_predictions.parse_single_json: Processing {os.path.basename(file_path)}")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
        
    row = {'date': data.get('date')}
    
    # Extract ticker data
    for ticker in ['OKLO', 'RKLB']:
        ticker_data = data.get('tickers', {}).get(ticker, {})
        row[f'{ticker}_close'] = ticker_data.get('close')
        row[f'{ticker}_pct_change'] = ticker_data.get('pct_change')
        row[f'{ticker}_streak'] = ticker_data.get('streak')
        row[f'{ticker}_confidence'] = ticker_data.get('confidence')
        row[f'{ticker}_predicted_next_day_pct'] = ticker_data.get('predicted_next_day_pct')
        row[f'{ticker}_dip_onset_prob'] = ticker_data.get('dip_onset_prob')
        row[f'{ticker}_dip_exhaustion_prob'] = ticker_data.get('dip_exhaustion_prob')

    # Extract benchmarks
    for benchmark in ['SPY', 'VIXY', 'VIXM', 'VIX']:
        bench_data = data.get('benchmarks', {}).get(benchmark)
        if isinstance(bench_data, dict):
            row[f'{benchmark}_close'] = bench_data.get('close')
        elif isinstance(bench_data, (int, float)):
            row[f'{benchmark}_close'] = bench_data
        else:
            row[f'{benchmark}_close'] = None
            
    return row

def prepare_data_subset(raw_files: list, raw_dir: str) -> pd.DataFrame:
    """Prepare data from a subset of raw files."""
    all_rows = []
    
    for filename in raw_files:
        file_path = os.path.join(raw_dir, filename)
        if os.path.exists(file_path):
            row_data = parse_single_json(file_path)
            all_rows.append(row_data)
    
    if not all_rows:
        raise ValueError("No data found for the given files")
    
    df = pd.DataFrame(all_rows)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    df.sort_index(inplace=True)
    
    # Clean the data
    df.ffill(inplace=True)
    df.bfill(inplace=True)
    df.fillna(0, inplace=True)
    
    return df

def build_model(input_shape):
    """Build and compile the RNN model."""
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(50, return_sequences=False),
        Dropout(0.2),
        Dense(25),
        Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mean_squared_error')
    return model

def create_sequences(data, timesteps=3):
    """Create sequences for RNN training."""
    if len(data) < timesteps + 1:
        raise ValueError(f"Not enough data points. Need at least {timesteps + 1}, got {len(data)}")
    
    X, y = [], []
    for i in range(len(data) - timesteps):
        X.append(data[i:(i + timesteps)])
        y.append(data[i + timesteps])
    
    return np.array(X), np.array(y)

def train_and_predict(df: pd.DataFrame, target_ticker: str, prediction_date: str):
    """Train model on the dataframe and make prediction."""
    print(f"generate_historical_rnn_predictions.train_and_predict: Training {target_ticker} model for {prediction_date}")
    
    TIMESTEPS = 3
    TARGET_FEATURE = 'predicted_next_day_pct'
    
    # Prepare target column
    target_column_name = f'{target_ticker}_{TARGET_FEATURE}'
    if target_column_name not in df.columns:
        print(f"generate_historical_rnn_predictions.train_and_predict: Warning - {target_column_name} not found, using 0")
        df[target_column_name] = 0
    
    # Scale the data
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(df)
    
    # Create sequences
    try:
        X, y = create_sequences(scaled_data, TIMESTEPS)
        print(f"generate_historical_rnn_predictions.train_and_predict: Created {len(X)} sequences of shape {X[0].shape}")
    except ValueError as e:
        print(f"generate_historical_rnn_predictions.train_and_predict: {str(e)}")
        return None
    
    # Build and train model
    model = build_model((TIMESTEPS, scaled_data.shape[1]))
    
    # Split data (use last 20% for validation if we have enough data)
    if len(X) >= 5:  # Need at least 5 sequences to have validation
        split_idx = int(len(X) * 0.8)
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        validation_data = (X_val, y_val)
    else:
        X_train, y_train = X, y
        validation_data = None
    
    # Train model (fewer epochs for speed in historical generation)
    model.fit(
        X_train, y_train,
        epochs=25,  # Reduced from 50 for faster historical generation
        batch_size=2,
        validation_data=validation_data,
        verbose=0  # Silent training
    )
    
    # Make prediction using the last sequence
    target_col_index = df.columns.get_loc(target_column_name)
    last_sequence_scaled = scaled_data[-TIMESTEPS:]
    input_data = np.reshape(last_sequence_scaled, (1, TIMESTEPS, scaled_data.shape[1]))
    
    predicted_value_scaled = model.predict(input_data, verbose=0)[0][0]
    
    # Inverse transform
    dummy_array = np.zeros((1, len(df.columns)))
    dummy_array[0, target_col_index] = predicted_value_scaled
    inversed_prediction_array = scaler.inverse_transform(dummy_array)
    final_prediction = inversed_prediction_array[0, target_col_index]
    
    return final_prediction

def get_training_sources(files_used: list):
    """Get metadata about training sources."""
    if not files_used:
        return {}
    
    # Extract dates from filenames to get training period
    dates = []
    for filename in files_used:
        try:
            date_str = filename.replace('.json', '')
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            dates.append(date_obj)
        except ValueError:
            continue
    
    if dates:
        dates.sort()
        start_date = dates[0].strftime('%Y-%m-%d')
        end_date = dates[-1].strftime('%Y-%m-%d')
    else:
        start_date = end_date = "unknown"
    
    return {
        'training_data_sources': sorted(files_used),
        'training_period': {
            'start_date': start_date,
            'end_date': end_date
        },
        'training_samples': len(files_used)
    }

def main():
    """Generate historical RNN predictions progressively."""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    raw_dir = os.path.join(project_root, 'data', 'raw')
    output_dir = os.path.join(project_root, 'data', 'ChatGPTRNN')
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Get all JSON files from raw directory
    all_files = [f for f in os.listdir(raw_dir) if f.endswith('.json')]
    all_files.sort()  # Chronological order
    
    if len(all_files) < 2:
        print("generate_historical_rnn_predictions.main: Need at least 2 files to generate predictions")
        return
    
    print(f"generate_historical_rnn_predictions.main: Found {len(all_files)} files to process")
    
    # For each date (starting from the second), train on all previous data
    for i in range(1, len(all_files)):
        current_file = all_files[i]
        training_files = all_files[:i]  # All files before current
        
        # Extract date from filename for prediction
        try:
            prediction_date = current_file.replace('.json', '')
            datetime.strptime(prediction_date, '%Y-%m-%d')  # Validate format
        except ValueError:
            print(f"generate_historical_rnn_predictions.main: Skipping {current_file} - invalid date format")
            continue
        
        print(f"generate_historical_rnn_predictions.main: Processing {prediction_date} (training on {len(training_files)} files)")
        
        # Skip if we don't have enough training data
        if len(training_files) < 3:  # Need at least 3 for timesteps
            print(f"generate_historical_rnn_predictions.main: Skipping {prediction_date} - need at least 3 training files")
            continue
        
        try:
            # Prepare training data
            df = prepare_data_subset(training_files, raw_dir)
            
            # Train models and make predictions for both tickers
            predictions = {}
            for ticker in ['OKLO', 'RKLB']:
                pred_value = train_and_predict(df, ticker, prediction_date)
                if pred_value is not None:
                    predictions[ticker] = {
                        'predicted_next_day_pct': float(pred_value)
                    }
            
            if not predictions:
                print(f"generate_historical_rnn_predictions.main: No predictions generated for {prediction_date}")
                continue
            
            # Build prediction object
            prediction_obj = {
                'date': prediction_date,
                'created_at': datetime.now().isoformat(),
                'predictions': predictions,
                'metadata': {
                    **get_training_sources(training_files),
                    'feature_count': len(df.columns),
                    'model_version': 'v1',
                    'timesteps': 3
                },
                'schema_version': '1.0'
            }
            
            # Save to file
            output_file = os.path.join(output_dir, f'{prediction_date}.json')
            with open(output_file, 'w') as f:
                json.dump(prediction_obj, f, indent=2)
            
            print(f"generate_historical_rnn_predictions.main: Saved prediction to {output_file}")
            
        except Exception as e:
            print(f"generate_historical_rnn_predictions.main: Error processing {prediction_date}: {str(e)}")
            continue
    
    print("generate_historical_rnn_predictions.main: Historical RNN prediction generation complete!")

if __name__ == "__main__":
    main()

# File: ml/scripts/generate_historical_rnn_predictions.py - Character count: 8847