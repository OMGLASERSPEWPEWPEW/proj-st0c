# File: test_openai_connection.py - OpenAI API test connection
# Test script to verify OpenAI API connectivity and basic functionality

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI

def test_openai_connection():
    """Test OpenAI API connection and basic functionality."""
    print("test_openai_connection.test_openai_connection: Starting API connection test")
    
    # Load environment variables
    load_dotenv()
    api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        print("test_openai_connection.test_openai_connection: ERROR - OPENAI_API_KEY not found in environment")
        return False
    
    try:
        # Initialize OpenAI client
        client = OpenAI(api_key=api_key)
        print("test_openai_connection.test_openai_connection: OpenAI client initialized")
        
        # Test basic connectivity with a simple request
        print("test_openai_connection.test_openai_connection: Testing basic API call...")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using cost-effective model for testing
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that responds in JSON format."
                },
                {
                    "role": "user", 
                    "content": "Return a simple JSON object with 'status': 'success' and 'timestamp': current timestamp"
                }
            ],
            max_tokens=100,
            temperature=0.1
        )
        
        # Extract response
        response_content = response.choices[0].message.content
        print(f"test_openai_connection.test_openai_connection: Raw response: {response_content}")
        
        # Try to parse as JSON
        try:
            response_json = json.loads(response_content)
            print("test_openai_connection.test_openai_connection: ✅ SUCCESS - API is working and returning JSON")
            print(f"test_openai_connection.test_openai_connection: Response: {response_json}")
            return True
        except json.JSONDecodeError:
            print("test_openai_connection.test_openai_connection: ⚠️  WARNING - API working but response not valid JSON")
            print(f"test_openai_connection.test_openai_connection: Response: {response_content}")
            return True
            
    except Exception as e:
        print(f"test_openai_connection.test_openai_connection: ❌ ERROR - {str(e)}")
        return False

def test_financial_prompt():
    """Test with a sample financial analysis prompt similar to your use case."""
    print("test_openai_connection.test_financial_prompt: Testing financial analysis prompt")
    
    load_dotenv()
    api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        print("test_openai_connection.test_financial_prompt: ERROR - OPENAI_API_KEY not found")
        return False
        
    try:
        client = OpenAI(api_key=api_key)
        
        # Sample prompt similar to your financial use case
        sample_prompt = """
        Generate a financial market analysis report in JSON format for testing purposes.
        Include these fields:
        - date: today's date
        - verdict: "Positive", "Negative", or "Neutral"  
        - tickers: object with AAPL and TSLA, each having close price and pct_change
        - tldr: brief market summary
        
        Make this realistic but clearly mark it as test data.
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a financial analyst. Always return valid JSON. Mark test data clearly."
                },
                {
                    "role": "user",
                    "content": sample_prompt
                }
            ],
            max_tokens=500,
            temperature=0.3
        )
        
        response_content = response.choices[0].message.content
        print(f"test_openai_connection.test_financial_prompt: Financial analysis response received")
        
        # Try to parse financial JSON
        try:
            financial_json = json.loads(response_content)
            print("test_openai_connection.test_financial_prompt: ✅ SUCCESS - Financial JSON generated")
            print(f"test_openai_connection.test_financial_prompt: Sample output keys: {list(financial_json.keys())}")
            
            # Pretty print for review
            print("test_openai_connection.test_financial_prompt: Sample financial analysis:")
            print(json.dumps(financial_json, indent=2))
            return True
            
        except json.JSONDecodeError as e:
            print(f"test_openai_connection.test_financial_prompt: ❌ ERROR - Invalid JSON: {e}")
            print(f"test_openai_connection.test_financial_prompt: Raw response: {response_content}")
            return False
            
    except Exception as e:
        print(f"test_openai_connection.test_financial_prompt: ❌ ERROR - {str(e)}")
        return False

if __name__ == "__main__":
    print(f"test_openai_connection.main: Starting OpenAI API tests at {datetime.now()}")
    print("test_openai_connection.main: " + "="*60)
    
    # Test 1: Basic connectivity
    print("\ntest_openai_connection.main: TEST 1 - Basic API connectivity")
    basic_success = test_openai_connection()
    
    # Test 2: Financial analysis
    if basic_success:
        print("\ntest_openai_connection.main: TEST 2 - Financial analysis prompt")
        financial_success = test_financial_prompt()
    else:
        print("\ntest_openai_connection.main: Skipping financial test due to basic connectivity failure")
        financial_success = False
    
    # Summary
    print("\ntest_openai_connection.main: " + "="*60)
    print("test_openai_connection.main: TEST SUMMARY:")
    print(f"test_openai_connection.main: Basic connectivity: {'✅ PASS' if basic_success else '❌ FAIL'}")
    print(f"test_openai_connection.main: Financial analysis: {'✅ PASS' if financial_success else '❌ FAIL'}")
    
    if basic_success and financial_success:
        print("test_openai_connection.main: 🎉 All tests passed! Ready for daily automation.")
    else:
        print("test_openai_connection.main: 🔧 Issues found. Check API key and network connectivity.")

# File: test_openai_connection.py - Character count: 5449