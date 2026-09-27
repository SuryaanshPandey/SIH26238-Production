from __future__ import annotations

from difflib import SequenceMatcher
import re


def similarity_ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def token_similarity(left: str, right: str) -> float:
    left_tokens = {token for token in re.split(r"\s+", left) if token}
    right_tokens = {token for token in re.split(r"\s+", right) if token}
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    jaccard = intersection / union if union else 0.0
    return (jaccard + similarity_ratio(" ".join(sorted(left_tokens)), " ".join(sorted(right_tokens)))) / 2


def name_similarity(left: str, right: str) -> float:
    direct = similarity_ratio(left, right)
    tokens = token_similarity(left, right)
    compact_left = re.sub(r"[^\w]", "", left)
    compact_right = re.sub(r"[^\w]", "", right)
    compact = similarity_ratio(compact_left, compact_right)
    return max(direct, tokens, compact)
