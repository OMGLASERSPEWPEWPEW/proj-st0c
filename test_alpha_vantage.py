# File: test_alpha_vantage.py
# Quick test script to verify AlphaVantage API connection works locally

import os
import sys

# Add project root to path for imports
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__)))
sys.path.append(PROJECT_ROOT)

from ml.services.alpha_vantage_client import AlphaVantageClient

def main():
    """Test AlphaVantage API connection and basic functionality."""
    print("test_alpha_vantage.main: Testing AlphaVantage API connection...")
    
    try:
        # Create client
        client = AlphaVantageClient()
        
        # Test connection
        print("test_alpha_vantage.main: Testing connection with SPY quote...")
        if client.test_connection():
            print("✅ SUCCESS: AlphaVantage API connection works!")
            
            # Get sample quote
            print("\ntest_alpha_vantage.main: Getting sample quotes for your tickers...")
            tickers = ['SPY', 'OKLO', 'RKLB']
            quotes = client.get_multiple_quotes(tickers)
            
            for symbol, data in quotes.items():
                if 'error' not in data:
                    print(f"✅ {symbol}: ${data.get('price', 'N/A')} (Change: {data.get('change_percent', 'N/A')}%)")
                else:
                    print(f"❌ {symbol}: {data['error']}")
            
            print("\n🎉 AlphaVantage integration is ready to use!")
            return True
            
        else:
            print("❌ FAILED: Could not connect to AlphaVantage API")
            print("Check your API key in .env file")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)

# File: test_alpha_vantage.py - Character count: 1396