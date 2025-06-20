#!/usr/bin/env python3
import json
import random
import sys
import re
from typing import List, Dict, Any

# Paths to your data JSON files
CATEGORY_PATH = 'data/categories.json'
DATASET_PATH = 'data/datasets.json'

def load_tree(category_path: str, dataset_path: str) -> List[Dict[str, Any]]:
    """
    Load the category tree from JSON and attach the actual dataset objects
    based on datasetIds.
    """
    with open(category_path, 'r') as f:
        categories = json.load(f)
    with open(dataset_path, 'r') as f:
        datasets = json.load(f)

    def attach(node: Dict[str, Any]) -> Dict[str, Any]:
        # find any datasets whose id is listed on this node
        attached = {
            'id': node['id'],
            'label': node.get('label', node['id']),
            'datasets': [
                d for d in datasets
                if d.get('id') in node.get('datasetIds', [])
            ]
        }
        # recurse into children
        if 'children' in node and node['children']:
            attached['children'] = [attach(child) for child in node['children']]
        return attached

    return [attach(n) for n in categories]

def build_levels(tree: List[Dict[str, Any]]) -> (List[str], Dict[str, List[str]]):
    """
    Extract second-level labels (subcategories) and map each to its
    third-level children (term labels).
    Returns:
      - level2_labels: list of all subcategory labels
      - sub_to_terms: dict mapping subcategory label -> list of term labels
    """
    level2_labels: List[str] = []
    sub_to_terms: Dict[str, List[str]] = {}

    for cat in tree:
        for sub in cat.get('children', []):
            sub_label = sub['label']
            level2_labels.append(sub_label)
            # take the labels of any deeper children as "terms"
            child_terms = [term['label'] for term in sub.get('children', [])]
            sub_to_terms[sub_label] = child_terms

    return level2_labels, sub_to_terms

def extract_annotations(
    text: str,
    subs: List[str],
    sub_to_terms: Dict[str, List[str]]
) -> List[Dict[str, Any]]:
    """
    Split the input text into tokens and for each:
      - pick a random subcategory from subs
      - pick a random term under that subcategory (if any)
      - assign random boolean flags for keyword/inclusion/exclusion
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
            'exclusion': random.choice([True, False])
        })

    return results

def main():
    # Expect JSON of the form {"text": "..."} on stdin
    payload = json.load(sys.stdin)
    text = payload.get('text', '')

    # Load and merge our split-out data files
    tree = load_tree(CATEGORY_PATH, DATASET_PATH)
    level2_labels, sub_to_terms = build_levels(tree)

    # Run the annotation extraction
    annotated = extract_annotations(text, level2_labels, sub_to_terms)

    # Emit as JSON on stdout
    json.dump({'result': annotated}, sys.stdout)

if __name__ == '__main__':
    main()
