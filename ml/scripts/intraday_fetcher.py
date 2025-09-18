# File: ml/scripts/intraday_fetcher.py
# Script to fetch 5-minute intraday data from AlphaVantage during market hours

import os
import sys
import json
import csv
from datetime import datetime, time
from pathlib import Path
import pytz

# Add project root to path for imports
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(PROJECT_ROOT)

from ml.services.alpha_vantage_client import AlphaVantageClient

class IntradayMarketFetcher:
    """Handles 5-minute intraday market data collection from AlphaVantage."""
    
    def __init__(self):
        """Initialize the intraday fetcher with required services."""
        print("intraday_fetcher.IntradayMarketFetcher.__init__: Initializing intraday fetcher")
        
        self.alpha_vantage = AlphaVantageClient()
        
        # Set up paths
        self.project_root = PROJECT_ROOT
        self.data_intraday_dir = os.path.join(self.project_root, 'data', 'intraday')
        
        # Ensure data/intraday directory exists
        os.makedirs(self.data_intraday_dir, exist_ok=True)
        
        # Market tickers to track
        self.tickers = ['OKLO', 'RKLB', 'SPY', 'VIX', 'VIXY', 'VIXM']
        
        # Market hours (Eastern Time)
        self.market_open = time(9, 30)  # 9:30 AM ET
        self.market_close = time(16, 0)  # 4:00 PM ET
        self.eastern_tz = pytz.timezone('US/Eastern')
        
        print("intraday_fetcher.IntradayMarketFetcher.__init__: Fetcher initialized successfully")
    
    def is_market_hours(self) -> bool:
        """Check if current time is during market hours (9:30 AM - 4:00 PM ET)."""
        print("intraday_fetcher.IntradayMarketFetcher.is_market_hours: Checking if market is open")
        
        # Get current time in Eastern timezone
        et_now = datetime.now(self.eastern_tz)
        current_time = et_now.time()
        current_weekday = et_now.weekday()  # 0=Monday, 6=Sunday
        
        # Check if it's a weekday (Monday-Friday)
        is_weekday = current_weekday < 5
        
        # Check if within market hours
        is_open_hours = self.market_open <= current_time <= self.market_close
        
        is_open = is_weekday and is_open_hours
        
        print(f"intraday_fetcher.IntradayMarketFetcher.is_market_hours: Market open: {is_open} (weekday: {is_weekday}, hours: {is_open_hours})")
        return is_open
    
    def get_csv_filename(self, date_str: str) -> str:
        """Generate CSV filename for intraday data."""
        return f"intraday_{date_str}.csv"
    
    def initialize_daily_csv(self, filepath: str):
        """Create CSV file with headers if it doesn't exist."""
        print(f"intraday_fetcher.IntradayMarketFetcher.initialize_daily_csv: Initializing CSV at {filepath}")
        
        if not os.path.exists(filepath):
            headers = [
                'timestamp',
                'symbol',
                'open',
                'high', 
                'low',
                'close',
                'volume',
                'fetched_at'
            ]
            
            with open(filepath, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(headers)
            
            print(f"intraday_fetcher.IntradayMarketFetcher.initialize_daily_csv: Created new CSV file with headers")
        else:
            print(f"intraday_fetcher.IntradayMarketFetcher.initialize_daily_csv: CSV file already exists")
    
    def append_to_csv(self, filepath: str, data_rows: list):
        """Append new data rows to existing CSV file."""
        print(f"intraday_fetcher.IntradayMarketFetcher.append_to_csv: Appending {len(data_rows)} rows to CSV")
        
        with open(filepath, 'a', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerows(data_rows)
        
        print(f"intraday_fetcher.IntradayMarketFetcher.append_to_csv: Successfully appended data to CSV")
    
    def fetch_current_quotes(self) -> dict:
        """Fetch current quotes for all tickers."""
        print("intraday_fetcher.IntradayMarketFetcher.fetch_current_quotes: Fetching current quotes for all tickers")
        
        quotes = self.alpha_vantage.get_multiple_quotes(self.tickers)
        
        print(f"intraday_fetcher.IntradayMarketFetcher.fetch_current_quotes: Fetched quotes for {len(quotes)} tickers")
        return quotes
    
    def quotes_to_csv_rows(self, quotes: dict, timestamp: str) -> list:
        """Convert quotes data to CSV rows format."""
        print("intraday_fetcher.IntradayMarketFetcher.quotes_to_csv_rows: Converting quotes to CSV format")
        
        rows = []
        
        for symbol, quote_data in quotes.items():
            # Skip if there was an error fetching this quote
            if 'error' in quote_data:
                print(f"intraday_fetcher.IntradayMarketFetcher.quotes_to_csv_rows: Skipping {symbol} due to error: {quote_data['error']}")
                continue
            
            # Create row with quote data
            # Note: For real-time quotes, we use current price as OHLC since it's a single point
            row = [
                timestamp,
                quote_data.get('symbol', symbol),
                quote_data.get('price', 0),        # open
                quote_data.get('price', 0),        # high  
                quote_data.get('price', 0),        # low
                quote_data.get('price', 0),        # close
                quote_data.get('volume', 0),       # volume
                quote_data.get('fetched_at', '')   # fetched_at
            ]
            rows.append(row)
        
        print(f"intraday_fetcher.IntradayMarketFetcher.quotes_to_csv_rows: Converted {len(rows)} quotes to CSV rows")
        return rows
    
    def save_backup_json(self, quotes: dict, timestamp: str):
        """Save raw quotes data as JSON backup."""
        print("intraday_fetcher.IntradayMarketFetcher.save_backup_json: Saving JSON backup")
        
        # Create backup filename
        date_str = datetime.now().strftime('%Y-%m-%d')
        time_str = datetime.now().strftime('%H-%M-%S')
        json_filename = f"backup_{date_str}_{time_str}.json"
        json_filepath = os.path.join(self.data_intraday_dir, json_filename)
        
        # Prepare backup data
        backup_data = {
            'timestamp': timestamp,
            'quotes': quotes,
            'tickers_requested': self.tickers,
            'market_hours_check': self.is_market_hours()
        }
        
        # Save JSON backup
        with open(json_filepath, 'w') as f:
            json.dump(backup_data, f, indent=2)
        
        print(f"intraday_fetcher.IntradayMarketFetcher.save_backup_json: Backup saved to {json_filepath}")
    
    def run_intraday_fetch(self) -> bool:
        """Complete intraday fetch workflow."""
        print("intraday_fetcher.IntradayMarketFetcher.run_intraday_fetch: Starting intraday fetch workflow")
        
        try:
            # Check if market is open
            if not self.is_market_hours():
                print("intraday_fetcher.IntradayMarketFetcher.run_intraday_fetch: Market closed - skipping fetch")
                return False
            
            # Get current timestamp
            current_time = datetime.now()
            timestamp = current_time.strftime('%Y-%m-%d %H:%M:%S')
            date_str = current_time.strftime('%Y-%m-%d')
            
            print(f"intraday_fetcher.IntradayMarketFetcher.run_intraday_fetch: Fetching market data at {timestamp}")
            
            # Set up CSV file for today
            csv_filename = self.get_csv_filename(date_str)
            csv_filepath = os.path.join(self.data_intraday_dir, csv_filename)
            
            # Initialize CSV if needed
            self.initialize_daily_csv(csv_filepath)
            
            # Fetch current quotes
            quotes = self.fetch_current_quotes()
            
            # Convert to CSV format
            csv_rows = self.quotes_to_csv_rows(quotes, timestamp)
            
            if csv_rows:
                # Append to CSV
                self.append_to_csv(csv_filepath, csv_rows)
                
                # Save JSON backup (optional, for debugging)
                self.save_backup_json(quotes, timestamp)
                
                print(f"intraday_fetcher.IntradayMarketFetcher.run_intraday_fetch: ✅ SUCCESS - Saved {len(csv_rows)} data points to {csv_filepath}")
                return True
            else:
                print("intraday_fetcher.IntradayMarketFetcher.run_intraday_fetch: ⚠️ WARNING - No valid data to save")
                return False
            
        except Exception as e:
            print(f"intraday_fetcher.IntradayMarketFetcher.run_intraday_fetch: ❌ ERROR - {str(e)}")
            return False

def main():
    """Main function to run intraday fetch."""
    print(f"intraday_fetcher.main: Starting intraday market data fetch at {datetime.now()}")
    
    try:
        # Create fetcher
        fetcher = IntradayMarketFetcher()
        
        # Run intraday fetch
        success = fetcher.run_intraday_fetch()
        
        if success:
            print("intraday_fetcher.main: ✅ SUCCESS - Intraday fetch completed")
        else:
            print("intraday_fetcher.main: ℹ️ INFO - No data collected (market closed or no valid quotes)")
        
    except Exception as e:
        print(f"intraday_fetcher.main: ❌ ERROR - {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

# File: ml/scripts/intraday_fetcher.py - Character count: 8754