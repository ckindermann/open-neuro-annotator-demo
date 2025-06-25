#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from gliner import GLiNER

# Determine project root and data paths
BASE_DIR = Path(__file__).resolve().parent.parent
CATEGORIES_PATH = BASE_DIR / "data" / "categories.json"

def load_hierarchy(categories_path: Path):
    """
    Load categories.json and return:
      - labels: a flat list of all category & subcategory labels
      - label_map: mapping each label -> (category_label, subcategory_label)
    """
    with categories_path.open(encoding="utf-8") as f:
        cats = json.load(f)

    labels: list[str] = []
    label_map: dict[str, tuple[str, str]] = {}

    for cat in cats:
        cat_lbl = cat["label"]
        labels.append(cat_lbl)
        label_map[cat_lbl] = (cat_lbl, "")      # top‐level category

        for sub in cat.get("children", []):
            sub_lbl = sub["label"]
            labels.append(sub_lbl)
            label_map[sub_lbl] = (cat_lbl, sub_lbl)

    return labels, label_map

def extract_annotations(
    text: str,
    model_name: str = "urchade/gliner_large_bio-v0.1",
    threshold: float = 0.5
) -> list[dict]:
    """
    Use GLiNER to predict category/subcategory spans in `text`.
    Returns a list of annotation dicts with pre‐populated category/subcategory.
    """
    labels, label_map = load_hierarchy(CATEGORIES_PATH)
    model = GLiNER.from_pretrained(model_name)
    ents = model.predict_entities(text, labels, threshold=threshold)

    annotations: list[dict] = []
    for ent in ents:
        lbl = ent.get("label", "")
        cat, sub = label_map.get(lbl, ("", ""))
        annotations.append({
            "text":        ent.get("text", ""),
            "category":    cat,
            "subcategory": sub,
            "term":        "",
            "keyword":     False,
            "inclusion":   False,
            "exclusion":   False
        })
    return annotations

def main():
    """
    Reads JSON {'text': "..."} from stdin,
    writes JSON {'result': [...]} to stdout.
    """
    payload = json.load(sys.stdin)
    text = payload.get("text", "")

    result = extract_annotations(text)
    json.dump({"result": result}, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()

if __name__ == "__main__":
    main()
