"""Shared MongoDB query builders for grade-scoped, child-visible content."""


def child_visible_content_query(grade: int) -> dict:
    """MongoDB filter matching content items a child of the given grade would
    actually see on their Learn page. Mirrors `content.py`'s user-facing filter:

      - is_published != False (missing flag counts as published — legacy items)
      - min_grade <= grade <= max_grade
      - visible_to includes 'child', OR the field is missing / empty / None
        (older content docs don't have a visible_to at all).

    Used by insights endpoints to keep parent/teacher totals aligned with what
    the child actually experiences (kindergarten kid → only K content).
    """
    return {
        "is_published": {"$ne": False},
        "min_grade": {"$lte": grade},
        "max_grade": {"$gte": grade},
        "$or": [
            {"visible_to": {"$in": ["child"]}},
            {"visible_to": {"$exists": False}},
            {"visible_to": []},
            {"visible_to": None},
        ],
    }
