# File: ml/scripts/daily_fetcher.py
# Script to fetch daily market analysis from OpenAI and save to data/raw

import os
import sys
import json
from datetime import datetime
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.append(PROJECT_ROOT)

from ml.services.openai_client import OpenAIClient
from ml.services.json_processor import JSONProcessor

class DailyMarketFetcher:
    """Handles daily market analysis fetching from OpenAI."""
    
    def __init__(self):
        """Initialize the fetcher with required services."""
        print("daily_fetcher.DailyMarketFetcher.__init__: Initializing daily fetcher")
        
        self.openai_client = OpenAIClient()
        self.json_processor = JSONProcessor()
        
        # Set up paths
        self.project_root = PROJECT_ROOT
        self.data_raw_dir = os.path.join(self.project_root, 'data', 'raw')
        
        # Ensure data/raw directory exists
        os.makedirs(self.data_raw_dir, exist_ok=True)
        
        print("daily_fetcher.DailyMarketFetcher.__init__: Fetcher initialized successfully")
    
    def build_market_analysis_prompt(self, tickers: list, date: str) -> str:
        """Build the comprehensive market analysis prompt following v2.1 schema."""
        print("daily_fetcher.DailyMarketFetcher.build_market_analysis_prompt: Building comprehensive analysis prompt")
        
        prompt = f"""
        You are a financial market analyst. You must research ACTUAL current market data for {date} and generate a comprehensive analysis.

        CRITICAL REQUIREMENTS:
        1. Research REAL market data - no fake or placeholder prices
        2. Use ACTUAL closing prices from financial data providers
        3. Reference REAL news articles and events that happened
        4. Provide working URLs to real sources
        5. Calculate actual percentage changes from real data

        EXAMPLE OF REQUIRED OUTPUT FORMAT (use this EXACT structure but with real {date} data):
        
        {{
            "schema_version": "2.1",
            "date": "2025-08-29",
            "asof": "2025-08-29T15:05:00-05:00",
            "verdict": "Neutral",
            "tldr": "A choppy Friday into the long weekend: SPY slipped while VIX jumped after Core PCE landed near expectations, pointing to a mild risk‑off finish. OKLO reversed Thursday's pop with a >5% pullback; RKLB eased ~1% but retained most weekly gains. For the next trading day (Tue, Sep 2), base case is range‑bound to slightly positive if headlines stay quiet—VIX spikes before long weekends often mean‑revert and breadth remains adequate.",
            "tickers": {{
                "OKLO": {{
                    "close": 73.57,
                    "pct_change": -5.55,
                    "streak": 1,
                    "call": "Positive",
                    "confidence": 2,
                    "actual_move": "Down",
                    "correct": null,
                    "predicted_next_day_pct": 0.7,
                    "expected_degree": "Small",
                    "action": "Buy",
                    "dip_onset_prob": 35,
                    "dip_exhaustion_prob": 55
                }},
                "RKLB": {{
                    "close": 47.37,
                    "pct_change": -1.13,
                    "streak": 1,
                    "call": "Neutral",
                    "confidence": 2,
                    "actual_move": "Down",
                    "correct": null,
                    "predicted_next_day_pct": 0.4,
                    "expected_degree": "Small",
                    "action": "Hold",
                    "dip_onset_prob": 40,
                    "dip_exhaustion_prob": 45
                }}
            }},
            "benchmarks": {{
                "SPY": {{ "close": 644.74, "predicted_next_day_pct": 0.2 }},
                "VIXY": {{ "close": 34.68 }},
                "VIXM": {{ "close": 16.28 }},
                "VIX": 15.60
            }},
            "prices": {{
                "OKLO": {{ "open": 77.67, "high": 78.50, "low": 72.78, "close": 73.57, "volume": 7783043 }},
                "RKLB": {{ "open": 47.85, "high": 48.80, "low": 46.02, "close": 47.37, "volume": 10472026 }},
                "SPY": {{ "open": 647.47, "high": 647.84, "low": 643.14, "close": 644.74, "volume": 43244731 }},
                "VIXY": {{ "open": 34.51, "high": 34.71, "low": 34.34, "close": 34.68, "volume": 282816 }},
                "VIXM": {{ "open": 16.18, "high": 16.38, "low": 16.18, "close": 16.28, "volume": 12649 }},
                "VIX": {{ "open": 14.31, "high": 15.97, "low": 14.31, "close": 15.60 }}
            }},
            "macro_watch": [
                {{ "event": "Core PCE Price Index (YoY, Jul)", "publisher": "Investing.com", "link": "https://www.investing.com/economic-calendar/core-pce-price-index-905", "next_release_hint": "Next PCE release Fri, Sep 26" }},
                {{ "event": "Employment Situation (NFP)", "publisher": "BLS", "link": "https://www.bls.gov/schedule/news_release/empsit.htm", "next_release_hint": "Fri, Sep 5 @ 08:30 ET" }}
            ],
            "sources": [
                {{
                    "id": "px_oklo_yf_2025-08-29",
                    "type": "price",
                    "ticker": "OKLO",
                    "publisher": "Yahoo Finance",
                    "title": "Oklo Inc (OKLO) Historical Data",
                    "url": "https://finance.yahoo.com/quote/OKLO/history/",
                    "date_accessed": "2025-08-29",
                    "excerpt": "Aug 29, 2025: O 77.67 H 78.50 L 72.78 C 73.57; Aug 28 close 77.89."
                }}
            ],
            "labels": {{
                "prediction_for_next_day": {{
                    "OKLO": {{ "direction": "Up", "magnitude_bucket": "Small", "reason": "Single‑day oversold after prior rally; bounce odds improve absent new headlines." }},
                    "RKLB": {{ "direction": "Up", "magnitude_bucket": "Small", "reason": "Constructive cadence (LC‑3 milestone) supports mild continuation despite higher VIX." }}
                }}
            }},
            "totals": {{ "correct": 0, "incorrect": 0, "success_rate": 0.0 }},
            "notes": "Regular session today; markets closed Mon (Labor Day). Technical stats to populate as a 20‑day history accrues in the tracker."
        }}

        NOW CREATE THE SAME STRUCTURE FOR {date}:
        
        RESEARCH STEPS YOU MUST FOLLOW:
        1. Look up ACTUAL closing prices for OKLO, RKLB, SPY, VIX, VIXY, VIXM on {date}
        2. Calculate REAL percentage changes from previous day
        3. Find ACTUAL recent news about OKLO and RKLB companies
        4. Check REAL macro economic calendar for upcoming events
        5. Generate realistic predictions based on ACTUAL market conditions
        
        DATA SOURCES TO USE:
        - Yahoo Finance: https://finance.yahoo.com/quote/[TICKER]/history/
        - Investing.com: https://www.investing.com/economic-calendar/
        - Company news from Business Wire, MarketWatch, Reuters
        - Economic calendar from BLS, Fed, Commerce Dept
        
        DO NOT GENERATE FAKE DATA. Research actual current market information.
        Return ONLY valid JSON in the exact schema format shown above.
        """
        
        return prompt
    
    def fetch_daily_analysis(self, tickers: list = None, date: str = None) -> dict:
        """Fetch daily market analysis from OpenAI with web search."""
        print("daily_fetcher.DailyMarketFetcher.fetch_daily_analysis: Starting daily analysis fetch")
        
        # Default tickers if none provided
        if tickers is None:
            tickers = ["OKLO", "RKLB", "SPY"]
        
        # Use today's date if none provided
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        # Build the prompt - now much simpler since web search will get real data
        input_text = f"""
        You are a financial market analyst with web search access. Research and analyze the market for {date}.

        CRITICAL: Use web search to get REAL current market data, not fake data.

        TASKS:
        1. Search for current stock prices for OKLO, RKLB, SPY, VIX, VIXY, VIXM on {date}
        2. Search for recent news about OKLO and RKLB companies
        3. Search for upcoming economic calendar events
        4. Generate analysis based on REAL data you find

        Output your analysis as a JSON object matching this exact schema:
        {{
            "schema_version": "2.1",
            "date": "{date}",
            "asof": "{date}T15:05:00-05:00",
            "verdict": "Risk-on|Neutral|Risk-off",
            "tldr": "300-word market summary with actual data and next-day predictions",
            "tickers": {{
                "OKLO": {{
                    "close": [ACTUAL_PRICE],
                    "pct_change": [ACTUAL_PERCENTAGE],
                    "streak": 1,
                    "call": "Positive|Neutral|Negative",
                    "confidence": 2,
                    "actual_move": "Up|Down|Flat",
                    "correct": null,
                    "predicted_next_day_pct": [YOUR_PREDICTION],
                    "expected_degree": "Small|Moderate|Large",
                    "action": "Buy|Hold|Sell",
                    "dip_onset_prob": 35,
                    "dip_exhaustion_prob": 55
                }},
                "RKLB": {{
                    "close": [ACTUAL_PRICE],
                    "pct_change": [ACTUAL_PERCENTAGE],
                    "streak": 1,
                    "call": "Positive|Neutral|Negative",
                    "confidence": 2,
                    "actual_move": "Up|Down|Flat",
                    "correct": null,
                    "predicted_next_day_pct": [YOUR_PREDICTION],
                    "expected_degree": "Small|Moderate|Large",
                    "action": "Buy|Hold|Sell",
                    "dip_onset_prob": 35,
                    "dip_exhaustion_prob": 55
                }}
            }},
            "benchmarks": {{
                "SPY": {{ "close": [ACTUAL_PRICE], "predicted_next_day_pct": [YOUR_PREDICTION] }},
                "VIXY": {{ "close": [ACTUAL_PRICE] }},
                "VIXM": {{ "close": [ACTUAL_PRICE] }},
                "VIX": [ACTUAL_LEVEL]
            }},
            "prices": {{
                "OKLO": {{ "open": [ACTUAL], "high": [ACTUAL], "low": [ACTUAL], "close": [ACTUAL], "volume": [ACTUAL] }},
                "RKLB": {{ "open": [ACTUAL], "high": [ACTUAL], "low": [ACTUAL], "close": [ACTUAL], "volume": [ACTUAL] }},
                "SPY": {{ "open": [ACTUAL], "high": [ACTUAL], "low": [ACTUAL], "close": [ACTUAL], "volume": [ACTUAL] }},
                "VIXY": {{ "open": [ACTUAL], "high": [ACTUAL], "low": [ACTUAL], "close": [ACTUAL], "volume": [ACTUAL] }},
                "VIXM": {{ "open": [ACTUAL], "high": [ACTUAL], "low": [ACTUAL], "close": [ACTUAL], "volume": [ACTUAL] }},
                "VIX": {{ "open": [ACTUAL], "high": [ACTUAL], "low": [ACTUAL], "close": [ACTUAL] }}
            }},
            "macro_watch": [
                {{ "event": "ACTUAL_EVENT_NAME", "publisher": "ACTUAL_PUBLISHER", "link": "ACTUAL_URL", "next_release_hint": "ACTUAL_DATE" }}
            ],
            "sources": [
                {{
                    "id": "unique_source_id",
                    "type": "price",
                    "ticker": "OKLO",
                    "publisher": "ACTUAL_SOURCE",
                    "title": "ACTUAL_TITLE",
                    "url": "ACTUAL_URL",
                    "date_accessed": "{date}",
                    "excerpt": "ACTUAL_EXCERPT_FROM_SOURCE"
                }}
            ],
            "labels": {{
                "prediction_for_next_day": {{
                    "OKLO": {{ "direction": "Up|Down|Flat", "magnitude_bucket": "Small|Moderate|Large", "reason": "Based on actual data analysis" }},
                    "RKLB": {{ "direction": "Up|Down|Flat", "magnitude_bucket": "Small|Moderate|Large", "reason": "Based on actual data analysis" }}
                }}
            }},
            "totals": {{ "correct": 0, "incorrect": 0, "success_rate": 0.0 }},
            "notes": "Analysis based on real market data found via web search"
        }}

        Use web search to find all the [ACTUAL] values above. Return ONLY the JSON object.
        """
        
        # Make API call with web search
        print("daily_fetcher.DailyMarketFetcher.fetch_daily_analysis: Making OpenAI Responses API call with web search")
        raw_response = self.openai_client.responses_with_web_search(input_text)
        
        # Clean and parse JSON
        print("daily_fetcher.DailyMarketFetcher.fetch_daily_analysis: Processing JSON response")
        analysis_data = self.json_processor.clean_and_parse(raw_response)
        
        print("daily_fetcher.DailyMarketFetcher.fetch_daily_analysis: Daily analysis fetched successfully")
        return analysis_data
    
    def save_to_raw_data(self, analysis_data: dict, date: str = None) -> str:
        """Save analysis data to the data/raw directory."""
        print("daily_fetcher.DailyMarketFetcher.save_to_raw_data: Saving analysis to raw data")
        
        # Use today's date if none provided
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        # Create filename
        filename = f"{date}.json"
        filepath = os.path.join(self.data_raw_dir, filename)
        
        # Save to file
        with open(filepath, 'w') as f:
            json.dump(analysis_data, f, indent=2)
        
        print(f"daily_fetcher.DailyMarketFetcher.save_to_raw_data: Analysis saved to {filepath}")
        return filepath
    
    def run_daily_fetch(self, tickers: list = None, date: str = None) -> str:
        """Complete daily fetch workflow."""
        print("daily_fetcher.DailyMarketFetcher.run_daily_fetch: Starting complete daily fetch workflow")
        
        try:
            # Fetch analysis directly (no test connection to save costs)
            analysis_data = self.fetch_daily_analysis(tickers, date)
            
            # Save to raw data
            filepath = self.save_to_raw_data(analysis_data, date)
            
            print("daily_fetcher.DailyMarketFetcher.run_daily_fetch: Daily fetch completed successfully")
            return filepath
            
        except Exception as e:
            print(f"daily_fetcher.DailyMarketFetcher.run_daily_fetch: ERROR - {str(e)}")
            raise

def main():
    """Main function to run daily fetch."""
    print(f"daily_fetcher.main: Starting daily market analysis fetch at {datetime.now()}")
    
    try:
        # Create fetcher
        fetcher = DailyMarketFetcher()
        
        # Run daily fetch
        filepath = fetcher.run_daily_fetch()
        
        print(f"daily_fetcher.main: ✅ SUCCESS - Daily analysis saved to {filepath}")
        
    except Exception as e:
        print(f"daily_fetcher.main: ❌ ERROR - {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

# File: ml/scripts/daily_fetcher.py - Character count: 6359