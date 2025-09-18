# File: ml/services/alpha_vantage_client.py
# AlphaVantage API client for real-time and intraday stock data collection

import os
import time
import requests
from typing import Dict, Optional, List
from datetime import datetime
from dotenv import load_dotenv
from tenacity import retry, wait_exponential, stop_after_attempt

class AlphaVantageClient:
    """Client for AlphaVantage free stock data API with rate limiting."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the AlphaVantage client."""
        print("alpha_vantage_client.AlphaVantageClient.__init__: Initializing AlphaVantage client")
        
        # Load environment variables
        load_dotenv()
        
        # Use provided key or get from environment
        self.api_key = api_key or os.getenv('ALPHA_VANTAGE_API_KEY')
        
        if not self.api_key:
            raise ValueError("alpha_vantage_client.AlphaVantageClient.__init__: ALPHA_VANTAGE_API_KEY not found in environment")
        
        self.base_url = "https://www.alphavantage.co/query"
        
        # Rate limiting: Free tier allows 5 API calls per minute, 500 per day
        self.calls_per_minute = 5
        self.last_call_times = []
        
        print("alpha_vantage_client.AlphaVantageClient.__init__: Client initialized successfully")
    
    def _enforce_rate_limit(self):
        """Enforce 5 calls per minute rate limit for free tier."""
        current_time = time.time()
        
        # Remove calls older than 1 minute
        self.last_call_times = [t for t in self.last_call_times if current_time - t < 60]
        
        # If we've made 5 calls in the last minute, wait
        if len(self.last_call_times) >= self.calls_per_minute:
            wait_time = 60 - (current_time - self.last_call_times[0]) + 1
            if wait_time > 0:
                print(f"alpha_vantage_client.AlphaVantageClient._enforce_rate_limit: Rate limit reached, waiting {wait_time:.1f} seconds")
                time.sleep(wait_time)
        
        # Record this call
        self.last_call_times.append(current_time)
    
    @retry(wait=wait_exponential(multiplier=1, min=4, max=60), stop=stop_after_attempt(3))
    def _make_request(self, params: Dict) -> Dict:
        """Make API request with rate limiting and retry logic."""
        print(f"alpha_vantage_client.AlphaVantageClient._make_request: Making API call for {params.get('symbol', 'unknown')}")
        
        # Enforce rate limiting
        self._enforce_rate_limit()
        
        # Add API key to parameters
        params['apikey'] = self.api_key
        
        try:
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for API errors
            if "Error Message" in data:
                raise ValueError(f"alpha_vantage_client.AlphaVantageClient._make_request: API Error: {data['Error Message']}")
            
            if "Note" in data:
                raise ValueError(f"alpha_vantage_client.AlphaVantageClient._make_request: Rate limit hit: {data['Note']}")
            
            print(f"alpha_vantage_client.AlphaVantageClient._make_request: API call successful for {params.get('symbol', 'unknown')}")
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"alpha_vantage_client.AlphaVantageClient._make_request: Request failed: {e}")
            raise
        except Exception as e:
            print(f"alpha_vantage_client.AlphaVantageClient._make_request: Unexpected error: {e}")
            raise
    
    def get_intraday_data(self, symbol: str, interval: str = "5min") -> Dict:
        """
        Get intraday time series data for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., 'OKLO', 'SPY')
            interval: Time interval ('1min', '5min', '15min', '30min', '60min')
        
        Returns:
            Dict containing intraday data with OHLCV values
        """
        print(f"alpha_vantage_client.AlphaVantageClient.get_intraday_data: Fetching {interval} data for {symbol}")
        
        params = {
            'function': 'TIME_SERIES_INTRADAY',
            'symbol': symbol,
            'interval': interval,
            'outputsize': 'compact',  # Latest 100 data points
            'datatype': 'json'
        }
        
        data = self._make_request(params)
        
        # Extract the time series data
        series_key = f"Time Series ({interval})"
        if series_key not in data:
            raise ValueError(f"alpha_vantage_client.AlphaVantageClient.get_intraday_data: No time series data found for {symbol}")
        
        # Add metadata for easier processing
        result = {
            'symbol': symbol,
            'interval': interval,
            'last_refreshed': data.get('Meta Data', {}).get('3. Last Refreshed', ''),
            'timezone': data.get('Meta Data', {}).get('6. Time Zone', 'US/Eastern'),
            'data': data[series_key],
            'fetched_at': datetime.now().isoformat()
        }
        
        print(f"alpha_vantage_client.AlphaVantageClient.get_intraday_data: Successfully fetched data for {symbol}")
        return result
    
    def get_daily_data(self, symbol: str) -> Dict:
        """
        Get daily time series data for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., 'OKLO', 'SPY')
        
        Returns:
            Dict containing daily OHLCV data
        """
        print(f"alpha_vantage_client.AlphaVantageClient.get_daily_data: Fetching daily data for {symbol}")
        
        params = {
            'function': 'TIME_SERIES_DAILY',
            'symbol': symbol,
            'outputsize': 'compact',  # Latest 100 data points
            'datatype': 'json'
        }
        
        data = self._make_request(params)
        
        # Extract the time series data
        series_key = "Time Series (Daily)"
        if series_key not in data:
            raise ValueError(f"alpha_vantage_client.AlphaVantageClient.get_daily_data: No daily data found for {symbol}")
        
        # Add metadata
        result = {
            'symbol': symbol,
            'last_refreshed': data.get('Meta Data', {}).get('3. Last Refreshed', ''),
            'timezone': data.get('Meta Data', {}).get('5. Time Zone', 'US/Eastern'),
            'data': data[series_key],
            'fetched_at': datetime.now().isoformat()
        }
        
        print(f"alpha_vantage_client.AlphaVantageClient.get_daily_data: Successfully fetched daily data for {symbol}")
        return result
    
    def get_quote(self, symbol: str) -> Dict:
        """
        Get real-time quote for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., 'OKLO', 'SPY')
        
        Returns:
            Dict containing current quote data
        """
        print(f"alpha_vantage_client.AlphaVantageClient.get_quote: Fetching quote for {symbol}")
        
        params = {
            'function': 'GLOBAL_QUOTE',
            'symbol': symbol,
            'datatype': 'json'
        }
        
        data = self._make_request(params)
        
        # Extract quote data
        quote_key = "Global Quote"
        if quote_key not in data:
            raise ValueError(f"alpha_vantage_client.AlphaVantageClient.get_quote: No quote data found for {symbol}")
        
        # Simplify the quote data keys
        quote_data = data[quote_key]
        result = {
            'symbol': quote_data.get('01. symbol', symbol),
            'price': float(quote_data.get('05. price', 0)),
            'change': float(quote_data.get('09. change', 0)),
            'change_percent': quote_data.get('10. change percent', '0%').replace('%', ''),
            'volume': int(quote_data.get('06. volume', 0)),
            'latest_trading_day': quote_data.get('07. latest trading day', ''),
            'previous_close': float(quote_data.get('08. previous close', 0)),
            'fetched_at': datetime.now().isoformat()
        }
        
        print(f"alpha_vantage_client.AlphaVantageClient.get_quote: Successfully fetched quote for {symbol}")
        return result
    
    def get_multiple_quotes(self, symbols: List[str]) -> Dict[str, Dict]:
        """
        Get quotes for multiple symbols with rate limiting.
        
        Args:
            symbols: List of stock symbols
        
        Returns:
            Dict mapping symbol to quote data
        """
        print(f"alpha_vantage_client.AlphaVantageClient.get_multiple_quotes: Fetching quotes for {len(symbols)} symbols")
        
        results = {}
        
        for symbol in symbols:
            try:
                quote_data = self.get_quote(symbol)
                results[symbol] = quote_data
            except Exception as e:
                print(f"alpha_vantage_client.AlphaVantageClient.get_multiple_quotes: Failed to get quote for {symbol}: {e}")
                results[symbol] = {
                    'symbol': symbol,
                    'error': str(e),
                    'fetched_at': datetime.now().isoformat()
                }
        
        print(f"alpha_vantage_client.AlphaVantageClient.get_multiple_quotes: Fetched quotes for {len(results)} symbols")
        return results
    
    def test_connection(self) -> bool:
        """Test the API connection with a simple quote request."""
        print("alpha_vantage_client.AlphaVantageClient.test_connection: Testing API connection")
        
        try:
            # Test with SPY (always active)
            quote = self.get_quote('SPY')
            print("alpha_vantage_client.AlphaVantageClient.test_connection: ✅ Connection test successful")
            return True
        except Exception as e:
            print(f"alpha_vantage_client.AlphaVantageClient.test_connection: ❌ Connection test failed: {e}")
            return False

# File: ml/services/alpha_vantage_client.py - Character count: 8847