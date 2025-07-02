#!/usr/bin/env python3
import json
import sys
import csv
from pathlib import Path

import spacy
from scispacy.linking import EntityLinker
from gliner import GLiNER

BASE_DIR = Path(__file__).resolve().parent.parent
CATEGORIES_PATH = BASE_DIR / "data" / "categories.json"
MAPPING_PATH    = BASE_DIR / "data" / "mappings.tsv"

def load_vocabulary_hierarchy() -> tuple[
    dict[str, tuple[str, str, str]],
    dict[str, tuple[str, str, str]]
]:
    """
    Build two maps from categories.json:
      1. vocab_hierarchy: vocabulary_id -> (category_id, subcategory_id, term_id)
      2. vocab_label_hierarchy: vocabulary_id -> (category_label, subcategory_label, term_label)
    """
    with CATEGORIES_PATH.open(encoding="utf-8") as f:
        cats = json.load(f)

    vocab_hierarchy: dict[str, tuple[str, str, str]] = {}
    vocab_label_hierarchy: dict[str, tuple[str, str, str]] = {}

    for cat in cats:
        cat_id    = cat["id"]
        cat_label = cat["label"]
        vocab_hierarchy[cat_id]       = (cat_id, "", "")
        vocab_label_hierarchy[cat_id] = (cat_label, "", "")
        for sub in cat.get("children", []):
            sub_id    = sub["id"]
            sub_label = sub["label"]
            vocab_hierarchy[sub_id]       = (cat_id, sub_id, "")
            vocab_label_hierarchy[sub_id] = (cat_label, sub_label, "")
            for term in sub.get("children", []):
                term_id    = term["id"]
                term_label = term["label"]
                vocab_hierarchy[term_id]       = (cat_id, sub_id, term_id)
                vocab_label_hierarchy[term_id] = (cat_label, sub_label, term_label)

    return vocab_hierarchy, vocab_label_hierarchy

# Load once at import
vocab_hierarchy, vocab_label_hierarchy = load_vocabulary_hierarchy()

def load_mesh_map() -> dict[str, str]:
    """
    Load TSV mapping of MeSH CUIs -> vocabulary IDs.
    Columns: vocabulary_term, vocabulary_id, mesh_term, mesh_id
    """
    mesh_map: dict[str, str] = {}
    with MAPPING_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            mesh_id  = row["mesh_id"]        # e.g. "D012345"
            vocab_id = row["vocabulary_id"]  # e.g. "ONVOC:0000123"
            mesh_map[mesh_id] = vocab_id
    return mesh_map

# Load once at import
mesh_map = load_mesh_map()

def extract_annotation_gliner(text: str) -> list[dict]:
    """
    Use GLiNER to extract spans for any vocabulary term defined in categories.json,
    and include human-readable labels for category, subcategory, and term.
    """
    labels, label_to_id = [], {}
    for vid, (cat_lbl, sub_lbl, term_lbl) in vocab_label_hierarchy.items():
        if sub_lbl == "" and term_lbl == "":
            labels.append(cat_lbl);   label_to_id[cat_lbl] = vid
        elif sub_lbl and term_lbl == "":
            labels.append(sub_lbl);   label_to_id[sub_lbl] = vid
    seen = set()
    labels = [l for l in labels if not (l in seen or seen.add(l))]

    model = GLiNER.from_pretrained("urchade/gliner_large_bio-v0.1")
    ents  = model.predict_entities(text, labels, threshold=0.5)

    results = []
    for ent in ents:
        human_lbl = ent["label"]
        vid       = label_to_id.get(human_lbl)
        if not vid:
            continue

        cat_id, sub_id, term_id         = vocab_hierarchy.get(vid, ("", "", ""))
        cat_lbl, sub_lbl, term_lbl      = vocab_label_hierarchy.get(vid, ("", "", ""))

        results.append({
            "text":          ent["text"],
            "vocabulary_id": vid,
            "category":      cat_lbl,
            "subcategory":   sub_lbl,
            "term":          term_lbl,
            "score":         ent["score"],
            "keyword":       ent.get("keyword", False),
            "inclusion":     ent.get("inclusion", False),
            "exclusion":     ent.get("exclusion", False),
        })
    return results


def extract_annotation_mesh(text: str) -> list[dict]:
    """
    Use SciSpacy + MeSH linker to extract MeSH entities by CUI,
    map them back to your vocab IDs and hierarchy,
    and include human-readable labels for category, subcategory, and term.
    """
    nlp = spacy.load("en_core_sci_lg")
    nlp.add_pipe("scispacy_linker",
                 config={"resolve_abbreviations": True, "linker_name": "mesh"})
    linker = nlp.get_pipe("scispacy_linker")

    doc = nlp(text)
    results: list[dict] = []

    for ent in doc.ents:
        if not ent._.kb_ents:
            continue
        mesh_cui, score = ent._.kb_ents[0]
        vocab_id = mesh_map.get(mesh_cui)
        if not vocab_id:
            continue

        cat_id, sub_id, term_id = vocab_hierarchy.get(vocab_id, ("", "", ""))
        cat_label, sub_label, term_label = vocab_label_hierarchy.get(vocab_id, ("", "", ""))

        results.append({
            "text":          ent.text,
            "mesh_id":       mesh_cui,
            "vocabulary_id": vocab_id,
            "category":      cat_label,
            "subcategory":   sub_label,
            "term":          term_label,
            "score":         score,
            "keyword":       False,
            "inclusion":     False,
            "exclusion":     False,
        })

    return results

def extract_annotations(text: str) -> list[dict]:
    """
    Run both the GLiNER-based vocabulary annotator and the MeSH-based annotator.
    """
    return extract_annotation_gliner(text) + extract_annotation_mesh(text)

def main():
    payload = json.load(sys.stdin)
    text = payload.get("text", "")

    result = extract_annotations(text)
    json.dump({"result": result}, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()

if __name__ == "__main__":
    main()
