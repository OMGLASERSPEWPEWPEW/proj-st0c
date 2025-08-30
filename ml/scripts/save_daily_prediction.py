# ml/scripts/save_daily_prediction.py
# Script to save daily RNN predictions with metadata about training data

import os
import json
import sys
from datetime import datetime, timedelta
import pandas as pd
from pathlib import Path

def get_training_data_metadata(processed_data_path: str):
    """Extract metadata about the training data sources."""
    print(f"save_daily_prediction.get_training_data_metadata: Analyzing training data from {processed_data_path}")
    
    # Load the processed data to get date range and feature info
    df = pd.read_csv(processed_data_path, index_col='date', parse_dates=True)
    
    start_date = df.index.min().strftime('%Y-%m-%d')
    end_date = df.index.max().strftime('%Y-%m-%d')
    feature_count = len(df.columns)
    training_samples = len(df)
    
    # Get list of source JSON files from data/raw that fall within this date range
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    raw_data_dir = os.path.join(project_root, 'data', 'raw')
    
    source_files = []
    if os.path.exists(raw_data_dir):
        for filename in os.listdir(raw_data_dir):
            if filename.endswith('.json'):
                # Extract date from filename (assuming format like "2024-01-15.json")
                try:
                    file_date_str = filename.replace('.json', '')
                    file_date = datetime.strptime(file_date_str, '%Y-%m-%d')
                    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
                    end_dt = datetime.strptime(end_date, '%Y-%m-%d')
                    
                    if start_dt <= file_date <= end_dt:
                        source_files.append(filename)
                except ValueError:
                    # Skip files that don't match expected date format
                    continue
    
    source_files.sort()  # Ensure chronological order
    
    return {
        'training_data_sources': source_files,
        'training_period': {
            'start_date': start_date,
            'end_date': end_date
        },
        'feature_count': feature_count,
        'training_samples': training_samples
    }

def save_daily_prediction(predictions_data: dict):
    """Save today's RNN predictions with metadata to the ChatGPTRNN folder."""
    print(f"save_daily_prediction.save_daily_prediction: Saving predictions with {len(predictions_data)} tickers")
    
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    processed_data_path = os.path.join(project_root, 'ml', 'processed_data', 'historical_features.csv')
    
    # Create ChatGPTRNN directory if it doesn't exist
    rnn_data_dir = os.path.join(project_root, 'data', 'ChatGPTRNN')
    os.makedirs(rnn_data_dir, exist_ok=True)
    
    # Get today's date for the filename
    today = datetime.now().strftime('%Y-%m-%d')
    output_file = os.path.join(rnn_data_dir, f'{today}.json')
    
    # Get metadata about training data
    metadata = get_training_data_metadata(processed_data_path)
    metadata.update({
        'model_version': 'v1',
        'timesteps': 3  # This should match the TIMESTEPS constant in your training script
    })
    
    # Build the prediction object
    prediction_obj = {
        'date': today,
        'created_at': datetime.now().isoformat(),
        'predictions': {},
        'metadata': metadata,
        'schema_version': '1.0'
    }
    
    # Convert predictions to the expected format
    for ticker, predicted_value in predictions_data.items():
        prediction_obj['predictions'][ticker] = {
            'predicted_next_day_pct': float(predicted_value)
        }
    
    # Save to file
    with open(output_file, 'w') as f:
        json.dump(prediction_obj, f, indent=2)
    
    print(f"save_daily_prediction.save_daily_prediction: Saved predictions to {output_file}")
    return output_file

def main():
    """Load the latest ML predictions and save them with metadata."""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    latest_predictions_path = os.path.join(project_root, 'frontend', 'public', 'latest_ml_predictions.json')
    
    if not os.path.exists(latest_predictions_path):
        print("save_daily_prediction.main: No latest ML predictions file found")
        return
    
    # Load the latest predictions
    with open(latest_predictions_path, 'r') as f:
        data = json.load(f)
    
    predictions = data.get('ml_predictions', {})
    if not predictions:
        print("save_daily_prediction.main: No ML predictions found in file")
        return
    
    # Save with metadata
    output_file = save_daily_prediction(predictions)
    print(f"save_daily_prediction.main: Successfully saved daily prediction to {output_file}")

if __name__ == "__main__":
    main()

# File: ml/scripts/save_daily_prediction.py - Character count: 4089