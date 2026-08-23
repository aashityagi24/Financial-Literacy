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


async def get_d2c_subscribed_curricula(user, db):
    """Curricula a D2C (non-school) user has personally paid for, derived
    from their own or their parent's active subscriptions:
      - any active base plan (single_parent/two_parents/admin_granted) grants
        Financial Literacy.
      - an active "money_masters" batch subscription grants Money Masters &
        Entrepreneurship (standalone — no base plan required).
    Returns [] when the user has no active subscription at all."""
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    user_id = user.get("user_id")
    email = (user.get("email") or "").lower()
    candidates = []
    if user_id:
        candidates.append({"child_user_ids": user_id})
    if email:
        candidates.append({"parent_emails": email})
    # Base-plan subscriptions (single_parent/two_parents/admin_granted) are
    # keyed only by the buying parent's email — they never populate
    # child_user_ids. A child logging in directly must therefore also be
    # matched via their linked parent's email, or they'd appear to have no
    # subscription at all (and, once a money_masters sub *does* set their
    # child_user_ids, would incorrectly lose Financial Literacy entirely).
    if user.get("role") == "child" and user_id:
        links = await db.parent_child_links.find(
            {"child_id": user_id, "status": "active"}, {"_id": 0, "parent_id": 1}
        ).to_list(10)
        if links:
            parents = await db.users.find(
                {"user_id": {"$in": [l["parent_id"] for l in links]}}, {"_id": 0, "email": 1}
            ).to_list(10)
            for p in parents:
                parent_email = (p.get("email") or "").lower()
                if parent_email:
                    candidates.append({"parent_emails": parent_email})
    if not candidates:
        return []
    subs = await db.subscriptions.find({
        "$or": candidates,
        "payment_status": "completed",
        "is_active": True,
        "end_date": {"$gt": now_iso},
    }, {"_id": 0, "plan_type": 1}).to_list(20)
    curricula = set()
    for s in subs:
        if s.get("plan_type") == "money_masters":
            curricula.add("money_entrepreneurship")
        else:
            curricula.add(DEFAULT_CURRICULUM)
    return list(curricula)


async def get_active_curricula(user, db):
    """Curricula the given user should see.

    Returns None for admins (no curriculum scoping — they manage everything).
    School-linked users get their school's enabled curricula. D2C users get
    whichever curricula their own active subscriptions unlock (Financial
    Literacy via the base plan, Money Masters & Entrepreneurship via a batch
    subscription — either or both). Falls back to the default when there is
    no subscription context (e.g. anonymous browsing).
    """
    if not user:
        return [DEFAULT_CURRICULUM]
    if user.get("role") == "admin":
        return None
    school_id = user.get("school_id")
    if school_id:
        return await get_school_curricula(school_id, db)
    subscribed = await get_d2c_subscribed_curricula(user, db)
    return subscribed or [DEFAULT_CURRICULUM]


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
