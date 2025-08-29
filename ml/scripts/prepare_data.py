# ml/scripts/prepare_data.py
# This script reads raw JSON data, flattens it, and saves it as a CSV.

import os
import json
import pandas as pd
from typing import List, Dict, Any

def parse_single_json(file_path: str) -> Dict[str, Any]:
    """
    Loads a single JSON file and extracts key features into a flat dictionary.
    
    Args:
        file_path: The full path to the JSON file.
        
    Returns:
        A dictionary containing the flattened data for one day.
    """
    print(f"prepare_data.parse_single_json: Processing {os.path.basename(file_path)}")
    
    with open(file_path, 'r') as f:
        data = json.load(f)
        
    row = {'date': data.get('date')}
    
    # --- Tickers ---
    # We focus on the main tickers of interest and their key metrics
    for ticker in ['OKLO', 'RKLB']:
        ticker_data = data.get('tickers', {}).get(ticker, {})
        row[f'{ticker}_close'] = ticker_data.get('close')
        row[f'{ticker}_pct_change'] = ticker_data.get('pct_change')
        row[f'{ticker}_streak'] = ticker_data.get('streak')
        row[f'{ticker}_confidence'] = ticker_data.get('confidence')
        row[f'{ticker}_predicted_next_day_pct'] = ticker_data.get('predicted_next_day_pct') # This is our target
        row[f'{ticker}_dip_onset_prob'] = ticker_data.get('dip_onset_prob')
        row[f'{ticker}_dip_exhaustion_prob'] = ticker_data.get('dip_exhaustion_prob')

    # --- Benchmarks ---
    # Extract close prices for key market benchmarks
    for benchmark in ['SPY', 'VIXY', 'VIXM', 'VIX']:
        bench_data = data.get('benchmarks', {}).get(benchmark)
        
        # Benchmarks can be a number (VIX) or an object with a 'close' key
        if isinstance(bench_data, dict):
            row[f'{benchmark}_close'] = bench_data.get('close')
        elif isinstance(bench_data, (int, float)):
            row[f'{benchmark}_close'] = bench_data
        else:
            row[f'{benchmark}_close'] = None
            
    return row

def process_all_data(raw_dir: str, output_path: str):
    """
    Processes all JSON files in the raw_dir, combines them, and saves to CSV.
    
    Args:
        raw_dir: Directory containing the raw JSON files.
        output_path: Path to save the final CSV file.
    """
    print(f"prepare_data.process_all_data: Starting data processing from '{raw_dir}'")
    
    all_files = [f for f in os.listdir(raw_dir) if f.endswith('.json')]
    all_files.sort() # Ensure chronological order
    
    if not all_files:
        print("prepare_data.process_all_data: No JSON files found. Exiting.")
        return

    all_rows: List[Dict[str, Any]] = []
    for filename in all_files:
        file_path = os.path.join(raw_dir, filename)
        try:
            row = parse_single_json(file_path)
            all_rows.append(row)
        except Exception as e:
            print(f"prepare_data.process_all_data: ERROR processing {filename}: {e}")
            
    # Create DataFrame
    df = pd.DataFrame(all_rows)
    
    # Set date as index
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(by='date').set_index('date')
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save to CSV
    df.to_csv(output_path)
    print(f"prepare_data.process_all_data: Successfully processed {len(df)} entries.")
    print(f"prepare_data.process_all_data: Data saved to '{output_path}'")

if __name__ == "__main__":
    # Define relative paths
    # The script is in ml/scripts, so we go up two levels to the project root
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    RAW_DATA_DIR = os.path.join(PROJECT_ROOT, 'data', 'raw')
    PROCESSED_DATA_PATH = os.path.join(PROJECT_ROOT, 'ml', 'processed_data', 'historical_features.csv')
    
    process_all_data(RAW_DATA_DIR, PROCESSED_DATA_PATH)

# File: ml/scripts/prepare_data.py - Character count: 3458