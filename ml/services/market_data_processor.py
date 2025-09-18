# File: ml/services/market_data_processor.py
# Process intraday CSV data from AlphaVantage into features for RNN training

import os
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path

class MarketDataProcessor:
    """Processes raw intraday CSV data into daily technical indicators and features."""
    
    def __init__(self, intraday_data_dir: str = None):
        """Initialize the market data processor."""
        print("market_data_processor.MarketDataProcessor.__init__: Initializing market data processor")
        
        # Set up paths
        if intraday_data_dir is None:
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            self.intraday_data_dir = os.path.join(project_root, 'data', 'intraday')
            self.processed_data_dir = os.path.join(project_root, 'ml', 'processed_data')
        else:
            self.intraday_data_dir = intraday_data_dir
            self.processed_data_dir = os.path.join(os.path.dirname(intraday_data_dir), 'ml', 'processed_data')
        
        # Ensure processed data directory exists
        os.makedirs(self.processed_data_dir, exist_ok=True)
        
        # Tickers we're tracking (must match intraday_fetcher.py)
        self.tickers = ['OKLO', 'RKLB', 'SPY', 'VIX', 'VIXY', 'VIXM']
        
        print("market_data_processor.MarketDataProcessor.__init__: Processor initialized successfully")
    
    def load_intraday_csv_files(self, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        """Load and combine multiple intraday CSV files into one DataFrame."""
        print("market_data_processor.MarketDataProcessor.load_intraday_csv_files: Loading CSV files")
        
        if not os.path.exists(self.intraday_data_dir):
            raise ValueError(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Directory not found: {self.intraday_data_dir}")
        
        # Get all CSV files matching intraday pattern
        csv_files = [f for f in os.listdir(self.intraday_data_dir) if f.startswith('intraday_') and f.endswith('.csv')]
        
        if not csv_files:
            raise ValueError(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: No intraday CSV files found in {self.intraday_data_dir}")
        
        # Filter by date range if provided
        if start_date or end_date:
            filtered_files = []
            for filename in csv_files:
                # Extract date from filename: intraday_2025-09-17.csv
                try:
                    date_str = filename.replace('intraday_', '').replace('.csv', '')
                    file_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    if start_date:
                        start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
                        if file_date < start_dt:
                            continue
                    
                    if end_date:
                        end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
                        if file_date > end_dt:
                            continue
                    
                    filtered_files.append(filename)
                except ValueError:
                    print(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Skipping file with invalid date format: {filename}")
                    continue
            
            csv_files = filtered_files
        
        csv_files.sort()  # Ensure chronological order
        
        print(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Found {len(csv_files)} CSV files to process")
        
        # Load and combine all CSV files
        all_dataframes = []
        
        for filename in csv_files:
            filepath = os.path.join(self.intraday_data_dir, filename)
            try:
                df = pd.read_csv(filepath)
                
                # Ensure required columns exist
                required_columns = ['timestamp', 'symbol', 'open', 'high', 'low', 'close', 'volume']
                missing_columns = [col for col in required_columns if col not in df.columns]
                
                if missing_columns:
                    print(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Skipping {filename} - missing columns: {missing_columns}")
                    continue
                
                all_dataframes.append(df)
                print(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Loaded {len(df)} records from {filename}")
                
            except Exception as e:
                print(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Error loading {filename}: {e}")
                continue
        
        if not all_dataframes:
            raise ValueError("market_data_processor.MarketDataProcessor.load_intraday_csv_files: No valid CSV files could be loaded")
        
        # Combine all dataframes
        combined_df = pd.concat(all_dataframes, ignore_index=True)
        
        # Convert timestamp to datetime
        combined_df['timestamp'] = pd.to_datetime(combined_df['timestamp'])
        
        # Sort by timestamp and symbol
        combined_df.sort_values(['symbol', 'timestamp'], inplace=True)
        combined_df.reset_index(drop=True, inplace=True)
        
        print(f"market_data_processor.MarketDataProcessor.load_intraday_csv_files: Combined {len(combined_df)} total records")
        return combined_df
    
    def aggregate_to_daily(self, intraday_df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate intraday data to daily OHLCV data."""
        print("market_data_processor.MarketDataProcessor.aggregate_to_daily: Aggregating to daily data")
        
        # Create date column from timestamp
        intraday_df['date'] = intraday_df['timestamp'].dt.date
        
        # Aggregate by symbol and date
        daily_data = []
        
        for symbol in self.tickers:
            symbol_data = intraday_df[intraday_df['symbol'] == symbol].copy()
            
            if symbol_data.empty:
                print(f"market_data_processor.MarketDataProcessor.aggregate_to_daily: No data found for {symbol}")
                continue
            
            # Group by date and aggregate
            daily_agg = symbol_data.groupby('date').agg({
                'open': 'first',    # First open of the day
                'high': 'max',      # Highest high of the day
                'low': 'min',       # Lowest low of the day
                'close': 'last',    # Last close of the day
                'volume': 'sum'     # Total volume for the day
            }).reset_index()
            
            # Add symbol column
            daily_agg['symbol'] = symbol
            
            daily_data.append(daily_agg)
            print(f"market_data_processor.MarketDataProcessor.aggregate_to_daily: Aggregated {len(daily_agg)} days for {symbol}")
        
        if not daily_data:
            raise ValueError("market_data_processor.MarketDataProcessor.aggregate_to_daily: No daily data could be aggregated")
        
        # Combine all symbols
        daily_df = pd.concat(daily_data, ignore_index=True)
        
        # Convert date back to datetime for easier processing
        daily_df['date'] = pd.to_datetime(daily_df['date'])
        
        # Sort by date and symbol
        daily_df.sort_values(['symbol', 'date'], inplace=True)
        daily_df.reset_index(drop=True, inplace=True)
        
        print(f"market_data_processor.MarketDataProcessor.aggregate_to_daily: Created {len(daily_df)} daily records")
        return daily_df
    
    def calculate_technical_indicators(self, daily_df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators for each symbol."""
        print("market_data_processor.MarketDataProcessor.calculate_technical_indicators: Calculating technical indicators")
        
        enhanced_data = []
        
        for symbol in self.tickers:
            symbol_data = daily_df[daily_df['symbol'] == symbol].copy()
            
            if symbol_data.empty:
                continue
            
            # Sort by date to ensure correct order
            symbol_data.sort_values('date', inplace=True)
            
            # Basic price features
            symbol_data['daily_return'] = symbol_data['close'].pct_change()
            symbol_data['daily_high_low_pct'] = ((symbol_data['high'] - symbol_data['low']) / symbol_data['close']) * 100
            symbol_data['daily_open_close_pct'] = ((symbol_data['close'] - symbol_data['open']) / symbol_data['open']) * 100
            
            # Moving averages (if we have enough data)
            if len(symbol_data) >= 5:
                symbol_data['ma_5'] = symbol_data['close'].rolling(window=5, min_periods=1).mean()
                symbol_data['ma_5_ratio'] = symbol_data['close'] / symbol_data['ma_5']
            else:
                symbol_data['ma_5'] = symbol_data['close']
                symbol_data['ma_5_ratio'] = 1.0
            
            if len(symbol_data) >= 10:
                symbol_data['ma_10'] = symbol_data['close'].rolling(window=10, min_periods=1).mean()
                symbol_data['ma_10_ratio'] = symbol_data['close'] / symbol_data['ma_10']
            else:
                symbol_data['ma_10'] = symbol_data['close']
                symbol_data['ma_10_ratio'] = 1.0
            
            # Volatility indicators
            symbol_data['price_volatility_5d'] = symbol_data['daily_return'].rolling(window=5, min_periods=1).std()
            symbol_data['volume_ma_5'] = symbol_data['volume'].rolling(window=5, min_periods=1).mean()
            symbol_data['volume_ratio'] = symbol_data['volume'] / symbol_data['volume_ma_5']
            
            # RSI (if we have enough data)
            if len(symbol_data) >= 14:
                symbol_data['rsi'] = self.calculate_rsi(symbol_data['close'], period=14)
            else:
                symbol_data['rsi'] = 50.0  # Neutral RSI for insufficient data
            
            # Price momentum
            if len(symbol_data) >= 3:
                symbol_data['momentum_3d'] = ((symbol_data['close'] / symbol_data['close'].shift(2)) - 1) * 100
            else:
                symbol_data['momentum_3d'] = 0.0
            
            enhanced_data.append(symbol_data)
            print(f"market_data_processor.MarketDataProcessor.calculate_technical_indicators: Calculated indicators for {symbol}")
        
        if not enhanced_data:
            raise ValueError("market_data_processor.MarketDataProcessor.calculate_technical_indicators: No technical indicators could be calculated")
        
        # Combine all symbols
        enhanced_df = pd.concat(enhanced_data, ignore_index=True)
        
        # Fill any remaining NaN values
        enhanced_df.fillna(method='ffill', inplace=True)
        enhanced_df.fillna(method='bfill', inplace=True)
        enhanced_df.fillna(0, inplace=True)
        
        print(f"market_data_processor.MarketDataProcessor.calculate_technical_indicators: Technical indicators calculated for {len(enhanced_df)} records")
        return enhanced_df
    
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI (Relative Strength Index)."""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def pivot_to_wide_format(self, enhanced_df: pd.DataFrame) -> pd.DataFrame:
        """Convert from long format (symbol per row) to wide format (features as columns)."""
        print("market_data_processor.MarketDataProcessor.pivot_to_wide_format: Converting to wide format")
        
        # Features to include in the wide format
        feature_columns = [
            'close', 'daily_return', 'daily_high_low_pct', 'daily_open_close_pct',
            'ma_5_ratio', 'ma_10_ratio', 'price_volatility_5d', 'volume_ratio',
            'rsi', 'momentum_3d', 'volume'
        ]
        
        # Ensure all feature columns exist
        for col in feature_columns:
            if col not in enhanced_df.columns:
                enhanced_df[col] = 0.0
                print(f"market_data_processor.MarketDataProcessor.pivot_to_wide_format: Added missing column {col} with default value 0.0")
        
        # Pivot the data
        wide_data_frames = []
        
        for feature in feature_columns:
            # Pivot each feature separately
            pivot_df = enhanced_df.pivot(index='date', columns='symbol', values=feature)
            
            # Rename columns to include feature name
            pivot_df.columns = [f"{col}_{feature}" for col in pivot_df.columns]
            
            wide_data_frames.append(pivot_df)
        
        # Combine all features
        wide_df = pd.concat(wide_data_frames, axis=1)
        
        # Fill missing values (in case some symbols have missing days)
        wide_df.fillna(method='ffill', inplace=True)
        wide_df.fillna(method='bfill', inplace=True)
        wide_df.fillna(0, inplace=True)
        
        # Reset index to make date a column
        wide_df.reset_index(inplace=True)
        
        print(f"market_data_processor.MarketDataProcessor.pivot_to_wide_format: Created wide format with {len(wide_df)} rows and {len(wide_df.columns)} columns")
        return wide_df
    
    def process_intraday_to_features(self, start_date: str = None, end_date: str = None, output_filename: str = None) -> str:
        """Complete processing pipeline: load intraday data -> daily aggregation -> technical indicators -> wide format."""
        print("market_data_processor.MarketDataProcessor.process_intraday_to_features: Starting complete processing pipeline")
        
        try:
            # Step 1: Load intraday CSV files
            intraday_df = self.load_intraday_csv_files(start_date, end_date)
            
            # Step 2: Aggregate to daily
            daily_df = self.aggregate_to_daily(intraday_df)
            
            # Step 3: Calculate technical indicators
            enhanced_df = self.calculate_technical_indicators(daily_df)
            
            # Step 4: Convert to wide format
            wide_df = self.pivot_to_wide_format(enhanced_df)
            
            # Step 5: Save to CSV
            if output_filename is None:
                output_filename = 'intraday_features.csv'
            
            output_path = os.path.join(self.processed_data_dir, output_filename)
            wide_df.to_csv(output_path, index=False)
            
            print(f"market_data_processor.MarketDataProcessor.process_intraday_to_features: ✅ SUCCESS - Processed {len(wide_df)} days of market data")
            print(f"market_data_processor.MarketDataProcessor.process_intraday_to_features: Features saved to {output_path}")
            
            return output_path
            
        except Exception as e:
            print(f"market_data_processor.MarketDataProcessor.process_intraday_to_features: ❌ ERROR - {str(e)}")
            raise
    
    def get_available_date_range(self) -> tuple:
        """Get the date range of available intraday data."""
        print("market_data_processor.MarketDataProcessor.get_available_date_range: Checking available date range")
        
        try:
            csv_files = [f for f in os.listdir(self.intraday_data_dir) if f.startswith('intraday_') and f.endswith('.csv')]
            
            if not csv_files:
                return None, None
            
            dates = []
            for filename in csv_files:
                try:
                    date_str = filename.replace('intraday_', '').replace('.csv', '')
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    dates.append(date_obj)
                except ValueError:
                    continue
            
            if not dates:
                return None, None
            
            dates.sort()
            start_date = dates[0].strftime('%Y-%m-%d')
            end_date = dates[-1].strftime('%Y-%m-%d')
            
            print(f"market_data_processor.MarketDataProcessor.get_available_date_range: Available data from {start_date} to {end_date}")
            return start_date, end_date
            
        except Exception as e:
            print(f"market_data_processor.MarketDataProcessor.get_available_date_range: Error checking date range: {e}")
            return None, None

def main():
    """Example usage of the MarketDataProcessor."""
    print(f"market_data_processor.main: Starting market data processing at {datetime.now()}")
    
    try:
        # Create processor
        processor = MarketDataProcessor()
        
        # Check available data range
        start_date, end_date = processor.get_available_date_range()
        
        if start_date is None:
            print("market_data_processor.main: No intraday data found. Please run intraday_fetcher.py first.")
            return
        
        print(f"market_data_processor.main: Processing data from {start_date} to {end_date}")
        
        # Process all available data
        output_path = processor.process_intraday_to_features()
        
        print(f"market_data_processor.main: ✅ SUCCESS - Market data features saved to {output_path}")
        
    except Exception as e:
        print(f"market_data_processor.main: ❌ ERROR - {str(e)}")
        return 1

if __name__ == "__main__":
    main()

# File: ml/services/market_data_processor.py - Character count: 15847