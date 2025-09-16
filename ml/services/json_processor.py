# File: ml/services/json_processor.py
# Handles JSON cleaning and parsing for OpenAI responses

import json
import re
from typing import Dict, Any

class JSONProcessor:
    """Handles cleaning and parsing JSON responses from LLMs."""
    
    @staticmethod
    def clean_llm_response(response_content: str) -> str:
        """Clean markdown formatting and extra text from LLM response to extract pure JSON."""
        print("json_processor.JSONProcessor.clean_llm_response: Cleaning response content")
        
        cleaned = response_content.strip()
        
        # Remove markdown code blocks
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
            
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        
        # Remove any trailing notes or comments
        if '(Note:' in cleaned:
            cleaned = cleaned.split('(Note:')[0]
        
        # Remove common LLM chattiness
        if 'Here is' in cleaned or 'Here\'s' in cleaned:
            # Find the first { and take everything from there
            bracket_start = cleaned.find('{')
            if bracket_start != -1:
                cleaned = cleaned[bracket_start:]
        
        # NEW: Extract only the JSON object from { to }
        if '{' in cleaned:
            start = cleaned.find('{')
            brace_count = 0
            end = start
            
            for i, char in enumerate(cleaned[start:], start):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
            
            cleaned = cleaned[start:end]
        
        # Remove any leading/trailing whitespace
        cleaned = cleaned.strip()
        
        print("json_processor.JSONProcessor.clean_llm_response: Response cleaned")
        return cleaned
    
    @staticmethod
    def parse_json_safely(json_string: str) -> Dict[str, Any]:
        """Parse JSON string with error handling and debugging info."""
        print("json_processor.JSONProcessor.parse_json_safely: Attempting to parse JSON")
        
        try:
            parsed_data = json.loads(json_string)
            print("json_processor.JSONProcessor.parse_json_safely: JSON parsed successfully")
            return parsed_data
            
        except json.JSONDecodeError as e:
            print(f"json_processor.JSONProcessor.parse_json_safely: JSON parsing error: {e}")
            print(f"json_processor.JSONProcessor.parse_json_safely: Problematic JSON (first 200 chars): {json_string[:200]}")
            
            # Try to fix common JSON issues
            fixed_json = JSONProcessor._attempt_json_fix(json_string)
            if fixed_json != json_string:
                print("json_processor.JSONProcessor.parse_json_safely: Attempting to parse fixed JSON")
                try:
                    parsed_data = json.loads(fixed_json)
                    print("json_processor.JSONProcessor.parse_json_safely: Fixed JSON parsed successfully")
                    return parsed_data
                except json.JSONDecodeError:
                    print("json_processor.JSONProcessor.parse_json_safely: Fixed JSON still failed to parse")
            
            raise ValueError(f"Could not parse JSON: {e}\nContent: {json_string[:500]}")
    
    @staticmethod
    def _attempt_json_fix(json_string: str) -> str:
        """Attempt to fix common JSON formatting issues."""
        print("json_processor.JSONProcessor._attempt_json_fix: Attempting to fix JSON issues")
        
        fixed = json_string
        
        # Fix trailing commas (common LLM issue)
        fixed = re.sub(r',(\s*[}\]])', r'\1', fixed)
        
        # Fix single quotes to double quotes
        fixed = re.sub(r"'([^']*)':", r'"\1":', fixed)
        
        # Fix unquoted keys
        fixed = re.sub(r'(\w+):', r'"\1":', fixed)
        
        print("json_processor.JSONProcessor._attempt_json_fix: JSON fix attempted")
        return fixed

    @staticmethod
    def clean_and_parse(raw_response: str) -> Dict[str, Any]:
        """Complete workflow: clean LLM response and parse to JSON."""
        print("json_processor.JSONProcessor.clean_and_parse: Starting complete JSON processing")
        
        # Step 1: Clean the response
        cleaned = JSONProcessor.clean_llm_response(raw_response)
        
        # Step 2: Parse the JSON
        parsed = JSONProcessor.parse_json_safely(cleaned)
        
        print("json_processor.JSONProcessor.clean_and_parse: JSON processing completed successfully")
        return parsed

# File: ml/services/json_processor.py - Character count: 3247