# File: create_sample_intraday_data.py
# Creates sample intraday CSV files to test the market data processor locally

import os
import csv
import pandas as pd
from datetime import datetime, timedelta

def create_sample_intraday_csv(date_str: str, output_dir: str):
    """Create a sample intraday CSV file for testing."""
    print(f"create_sample_intraday_data.create_sample_intraday_csv: Creating sample data for {date_str}")
    
    # Sample data for each ticker
    tickers_data = {
        'OKLO': {'base_price': 12.50, 'volatility': 0.02},
        'RKLB': {'base_price': 4.90, 'volatility': 0.015}, 
        'SPY': {'base_price': 567.89, 'volatility': 0.005},
        'VIX': {'base_price': 18.45, 'volatility': 0.03},
        'VIXY': {'base_price': 15.23, 'volatility': 0.025},
        'VIXM': {'base_price': 22.78, 'volatility': 0.02}
    }
    
    # Create timestamps for market hours (9:30 AM to 4:00 PM ET, every 5 minutes)
    base_date = datetime.strptime(date_str, '%Y-%m-%d')
    start_time = base_date.replace(hour=9, minute=30)
    end_time = base_date.replace(hour=16, minute=0)
    
    timestamps = []
    current_time = start_time
    while current_time <= end_time:
        timestamps.append(current_time)
        current_time += timedelta(minutes=5)
    
    # Generate sample data
    csv_rows = []
    csv_rows.append(['timestamp', 'symbol', 'open', 'high', 'low', 'close', 'volume', 'fetched_at'])
    
    import random
    random.seed(42)  # For consistent test data
    
    for timestamp in timestamps:
        for symbol, data in tickers_data.items():
            base_price = data['base_price']
            volatility = data['volatility']
            
            # Create realistic OHLC data
            price_change = random.uniform(-volatility, volatility)
            close_price = base_price * (1 + price_change)
            
            # Open is close from previous period (simplified)
            open_price = close_price * (1 + random.uniform(-volatility/2, volatility/2))
            
            # High/Low around the open/close range
            high_price = max(open_price, close_price) * (1 + random.uniform(0, volatility/2))
            low_price = min(open_price, close_price) * (1 - random.uniform(0, volatility/2))
            
            # Volume based on ticker (SPY much higher than others)
            if symbol == 'SPY':
                volume = random.randint(1000000, 3000000)
            elif symbol in ['OKLO', 'RKLB']:
                volume = random.randint(50000, 200000)
            else:  # VIX products
                volume = random.randint(100000, 500000)
            
            row = [
                timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                symbol,
                round(open_price, 2),
                round(high_price, 2),
                round(low_price, 2),
                round(close_price, 2),
                volume,
                timestamp.strftime('%Y-%m-%dT%H:%M:%S')
            ]
            csv_rows.append(row)
    
    # Write CSV file
    filename = f"intraday_{date_str}.csv"
    filepath = os.path.join(output_dir, filename)
    
    with open(filepath, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerows(csv_rows)
    
    print(f"create_sample_intraday_data.create_sample_intraday_csv: Created {filepath} with {len(csv_rows)-1} data points")
    return filepath

def main():
    """Create sample intraday data for the last 5 trading days."""
    print("create_sample_intraday_data.main: Creating sample intraday data for testing")
    
    # Set up output directory
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
    output_dir = os.path.join(project_root, 'data', 'intraday')
    os.makedirs(output_dir, exist_ok=True)
    
    # Create data for last 5 trading days (excluding weekends)
    end_date = datetime.now().date()
    current_date = end_date - timedelta(days=10)  # Start 10 days back to ensure we get 5 trading days
    
    files_created = []
    trading_days_created = 0
    
    while trading_days_created < 5 and current_date <= end_date:
        # Skip weekends (Saturday=5, Sunday=6)
        if current_date.weekday() < 5:  # Monday=0 to Friday=4
            date_str = current_date.strftime('%Y-%m-%d')
            filepath = create_sample_intraday_csv(date_str, output_dir)
            files_created.append(filepath)
            trading_days_created += 1
        
        current_date += timedelta(days=1)
    
    print(f"\ncreate_sample_intraday_data.main: ✅ Created {len(files_created)} sample files:")
    for filepath in files_created:
        print(f"  • {os.path.basename(filepath)}")
    
    print("\n🎉 Sample data ready! Now you can test the market data processor.")

if __name__ == "__main__":
    main()

# File: create_sample_intraday_data.py - Character count: 4451