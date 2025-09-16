# File: ml/services/openai_client.py
# Simple OpenAI API client wrapper - handles only API calls

import os
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI
from tenacity import retry, wait_exponential, stop_after_attempt

class OpenAIClient:
    """Simple wrapper around OpenAI API for making chat completion calls."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the OpenAI client."""
        print("openai_client.OpenAIClient.__init__: Initializing OpenAI client")
        
        # Load environment variables
        load_dotenv()
        
        # Use provided key or get from environment
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError("openai_client.OpenAIClient.__init__: OPENAI_API_KEY not found in environment or parameters")
        
        # Initialize OpenAI client
        self.client = OpenAI(api_key=self.api_key)
        self.model = "gpt-4o"  # Responses API requires gpt-4o or better
        
        print("openai_client.OpenAIClient.__init__: Client initialized successfully")
    
    def responses_with_web_search(self, input_text: str, temperature: float = 0.1) -> str:
        """Make a Responses API call with web search capability."""
        print("openai_client.OpenAIClient.responses_with_web_search: Making Responses API call with web search")
        
        try:
            response = self.client.responses.create(
                model=self.model,
                input=input_text,
                tools=[{"type": "web_search"}],
                temperature=temperature
            )
            
            # Extract the final text response
            content = response.output[-1].content[0].text
            print("openai_client.OpenAIClient.responses_with_web_search: API request successful")
            return content
            
        except Exception as e:
            print(f"openai_client.OpenAIClient.responses_with_web_search: API request failed: {e}")
            raise
    
    @retry(wait=wait_exponential(multiplier=1, min=4, max=60), stop=stop_after_attempt(3))
    def chat_completion(self, messages: list, temperature: float = 0.3, response_format: dict = None) -> str:
        """Make a chat completion API call with retry logic."""
        print("openai_client.OpenAIClient.chat_completion: Making API request")
        
        try:
            # Build request parameters
            request_params = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature
            }
            
            # Add response_format if provided
            if response_format:
                request_params["response_format"] = response_format
                print(f"openai_client.OpenAIClient.chat_completion: Using response_format: {response_format}")
            
            response = self.client.chat.completions.create(**request_params)
            
            content = response.choices[0].message.content
            print("openai_client.OpenAIClient.chat_completion: API request successful")
            return content
            
        except Exception as e:
            print(f"openai_client.OpenAIClient.chat_completion: API request failed: {e}")
            raise

# File: ml/services/openai_client.py - Character count: 7247