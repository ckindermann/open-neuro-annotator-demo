#!/usr/bin/env python3
import json
import random
import sys
import re
from typing import List, Dict, Any

# Path to your sample data JSON (adjust if necessary)
DATA_PATH = 'data/sampleData.json'

def load_tree(data_path: str) -> List[Dict[str, Any]]:
    """
    Load the full category tree from JSON.
    """
    with open(data_path, 'r') as f:
        return json.load(f)

def build_levels(tree: List[Dict[str, Any]]) -> (List[str], Dict[str, List[str]]):
    """
    Extract second-level labels (subcategories) and map each to its third-level children (terms).
    Returns:
      - level2_labels: all subcategory labels
      - sub_to_terms: mapping from subcategory to its term labels
    """
    level2_labels: List[str] = []
    sub_to_terms: Dict[str, List[str]] = {}

    for cat in tree:
        for sub in cat.get('children', []):
            sub_label = sub['label']
            level2_labels.append(sub_label)
            # Collect term labels under this subcategory
            child_terms = [term['label'] for term in sub.get('children', [])]
            sub_to_terms[sub_label] = child_terms

    return level2_labels, sub_to_terms

def extract_annotations(
    text: str,
    subs: List[str],
    sub_to_terms: Dict[str, List[str]]
) -> List[Dict[str, Any]]:
    """
    Split text into word tokens and assign:
      - subcategory: random second-level label
      - term: random third-level label under that subcategory
      - keyword/inclusion/exclusion: random booleans
    """
    tokens = re.findall(r'\b\w+\b', text)
    results: List[Dict[str, Any]] = []

    for token in tokens:
        sub = random.choice(subs)
        terms = sub_to_terms.get(sub, [])
        term = random.choice(terms) if terms else sub

        results.append({
            'text': token,
            'subcategory': sub,
            'term': term,
            'keyword': random.choice([True, False]),
            'inclusion': random.choice([True, False]),
            'exclusion': random.choice([True, False]),
        })

    return results

def main():
    # Expect {"text": "..."} on stdin
    payload = json.load(sys.stdin)
    text = payload.get('text', '')

    # Load tree and build our subcategory/term maps
    tree = load_tree(DATA_PATH)
    level2_labels, sub_to_terms = build_levels(tree)

    # Perform extraction
    annotated = extract_annotations(text, level2_labels, sub_to_terms)

    # Output JSON
    json.dump({'result': annotated}, sys.stdout)

if __name__ == '__main__':
    main()
