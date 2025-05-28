import sys
import json

def extract(text):
    # Mock extraction logic: split text into words and group them
    words = text.split()
    return {
        "keywords": words[:3],
        "inclusionTerms": words[3:5],
        "exclusionTerms": words[5:7]
    }

if __name__ == "__main__":
    input_text = sys.stdin.read()
    result = extract(input_text)
    print(json.dumps(result))
