"""Curriculum registry and helpers.

Content is organised into curricula (e.g. Financial Literacy, Money Masters &
Entrepreneurship). Schools are enabled for one or more curricula; content items
carry a `curricula` tag (a content item can belong to several). Delivery to a
school's users is scoped to the curricula that school has enabled. Non-school
(D2C) users and unauthenticated callers see the default (Financial Literacy).
"""

CURRICULA = [
    {"id": "financial_literacy", "name": "Financial Literacy"},
    {"id": "money_entrepreneurship", "name": "Money Masters & Entrepreneurship"},
]
CURRICULUM_IDS = [c["id"] for c in CURRICULA]
DEFAULT_CURRICULUM = "financial_literacy"


def normalize_curricula(value):
    """Coerce an incoming curricula value into a clean list of valid ids.
    Falls back to [DEFAULT_CURRICULUM] when empty/invalid."""
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, (list, tuple)):
        return [DEFAULT_CURRICULUM]
    cleaned = [c for c in value if c in CURRICULUM_IDS]
    return cleaned or [DEFAULT_CURRICULUM]


async def get_school_curricula(school_id, db):
    """Enabled curricula for a school (defaults to Financial Literacy)."""
    if not school_id:
        return [DEFAULT_CURRICULUM]
    school = await db.schools.find_one({"school_id": school_id}, {"_id": 0, "curricula": 1})
    cur = (school or {}).get("curricula")
    return cur if cur else [DEFAULT_CURRICULUM]


async def get_active_curricula(user, db):
    """Curricula the given user should see.

    Returns None for admins (no curriculum scoping — they manage everything).
    School-linked users get their school's enabled curricula; everyone else
    (D2C parents/children, anonymous) gets the default.
    """
    if not user:
        return [DEFAULT_CURRICULUM]
    if user.get("role") == "admin":
        return None
    school_id = user.get("school_id")
    if school_id:
        return await get_school_curricula(school_id, db)
    return [DEFAULT_CURRICULUM]


def content_curricula_clause(active_curricula):
    """MongoDB clause matching content items in the active curricula.

    Legacy/untagged docs (missing/empty `curricula`) are treated as belonging to
    the DEFAULT curriculum only — so they surface for schools that include
    Financial Literacy but never leak into a curriculum-specific school (e.g. an
    entrepreneurship-only school). Returns {} when active is None (admin)."""
    if active_curricula is None:
        return {}
    ors = [{"curricula": {"$in": active_curricula}}]
    if DEFAULT_CURRICULUM in active_curricula:
        ors += [
            {"curricula": {"$exists": False}},
            {"curricula": None},
            {"curricula": []},
        ]
    return {"$or": ors}
