"""Wallet routes - Account management and transactions"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

# Database injection
_db = None

def init_db(database):
    global _db
    _db = database

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(tags=["wallet"])

class TransactionCreate(BaseModel):
    from_account: str = None
    to_account: str = None
    amount: float
    transaction_type: str = "transfer"
    description: str = "Account transfer"

@router.get("/wallet")
async def get_wallet(request: Request):
    """Get all wallet accounts for current user with available vs allocated breakdown"""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    accounts = await db.wallet_accounts.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(10)

    # Defensive: child users sometimes land here without ever having gone through
    # /auth/set-role (e.g. accounts created via admin/parent provisioning). Ensure
    # all five jar accounts exist (spending + savings + investing + gifting + my_wallet).
    if user.get("role") == "child":
        from datetime import datetime, timezone
        import uuid
        existing_types = {a.get("account_type") for a in accounts}
        required = ["spending", "savings", "investing", "gifting", "my_wallet"]
        missing = [t for t in required if t not in existing_types]
        if missing:
            now = datetime.now(timezone.utc).isoformat()
            for account_type in missing:
                await db.wallet_accounts.insert_one({
                    "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                    "user_id": user_id,
                    "account_type": account_type,
                    "balance": 0.0,
                    "created_at": now,
                })
            accounts = await db.wallet_accounts.find(
                {"user_id": user_id},
                {"_id": 0}
            ).to_list(10)
    
    # Calculate allocated amounts for savings (money committed to goals)
    savings_goals = await db.savings_goals.find(
        {"$or": [{"child_id": user_id}, {"user_id": user_id}]},
        {"_id": 0, "current_amount": 1}
    ).to_list(100)
    savings_allocated = sum(g.get("current_amount", 0) for g in savings_goals)
    
    # Calculate allocated amounts for investing (money in stocks/plants)
    # Stock holdings value
    stock_holdings = await db.user_stock_holdings.find(
        {"user_id": user_id},
        {"_id": 0, "stock_id": 1, "shares": 1}
    ).to_list(100)
    
    stocks_allocated = 0
    for holding in stock_holdings:
        stock = await db.investment_stocks.find_one(
            {"stock_id": holding.get("stock_id")},
            {"_id": 0, "current_price": 1}
        )
        if stock:
            stocks_allocated += holding.get("shares", 0) * stock.get("current_price", 0)
    
    # Garden plots value (for grades 1-2)
    garden_plots = await db.user_garden_plots.find(
        {"user_id": user_id},
        {"_id": 0, "purchase_price": 1, "plant_value": 1}
    ).to_list(100)
    garden_allocated = sum(p.get("plant_value", p.get("purchase_price", 0)) for p in garden_plots)
    
    investing_allocated = stocks_allocated + garden_allocated
    
    # Enrich accounts with available vs allocated
    enriched_accounts = []
    for acc in accounts:
        acc_type = acc.get("account_type")
        balance = acc.get("balance", 0)
        
        if acc_type == "savings":
            # Savings: The balance IS the available amount
            # Goals' current_amount comes from SPENDING account, not savings
            # So we just show balance as available, and goals as a separate info
            enriched_accounts.append({
                **acc,
                "available_balance": balance,  # All savings is available
                "allocated_balance": savings_allocated,  # Info: how much is in goals (from spending)
                "total_balance": balance
            })
        elif acc_type == "investing":
            # Investing: available = cash balance, allocated = portfolio value
            enriched_accounts.append({
                **acc,
                "available_balance": balance,  # Cash ready to invest
                "allocated_balance": investing_allocated,  # Value of investments
                "total_balance": balance + investing_allocated
            })
        else:
            # Spending, gifting - just show balance
            enriched_accounts.append({
                **acc,
                "available_balance": balance,
                "allocated_balance": 0,
                "total_balance": balance
            })
    
    # Total available = sum of all available_balance (money that can actually be spent/used)
    total_available = sum(acc.get("available_balance", 0) for acc in enriched_accounts)
    
    return {
        "accounts": enriched_accounts,
        "total_balance": total_available,  # For dashboard header display
        "total_available": total_available,  # Alias for clarity
        "savings_allocated": savings_allocated,
        "investing_allocated": investing_allocated
    }

@router.post("/wallet/transfer")
async def transfer_money(transaction: TransactionCreate, request: Request):
    """Transfer money between accounts"""
    from services.auth import get_current_user
    from routes.achievements import award_badge
    db = get_db()
    user = await get_current_user(request)
    
    if transaction.transaction_type == "transfer":
        if not transaction.from_account or not transaction.to_account:
            raise HTTPException(status_code=400, detail="Both from_account and to_account required for transfer")

        # Direction rules:
        #   * Piggy Bank (savings) is **outbound-restricted**: money goes in from My
        #     Wallet but can only LEAVE by contributing to a specific goal (handled in
        #     /savings-goals/{id}/contribute). General transfers out are not allowed.
        #   * Giving (gifting) can be funded from EITHER My Wallet (real money) OR
        #     CoinQuest/Spending (play coins). Money leaves by sending a gift.
        #   * Investing/Garden is a "play coins" jar — only funded from CoinQuest (spending).
        f, t = transaction.from_account, transaction.to_account
        PLAY_JARS = {"investing"}
        GIFTING_SOURCES = {"my_wallet", "spending"}

        # Piggy Bank cannot be a source for a transfer.
        if f == "savings":
            raise HTTPException(
                status_code=400,
                detail="Piggy Bank money can only be spent by contributing to a savings goal."
            )

        # Savings (Piggy Bank) can only be funded from My Wallet (real earnings)
        if t == "savings" and f != "my_wallet":
            raise HTTPException(
                status_code=400,
                detail="Piggy Bank can only be funded from your My Wallet (real earnings)."
            )
        # Giving Jar accepts both real and play money
        if t == "gifting" and f not in GIFTING_SOURCES:
            raise HTTPException(
                status_code=400,
                detail="Giving Jar can only be funded from My Wallet or your CoinQuest Wallet."
            )
        # Money cannot leave the Giving Jar via transfer (only via gifting to friends)
        if f == "gifting":
            raise HTTPException(
                status_code=400,
                detail="Giving money can only leave by sending a gift to a friend."
            )
        if t in PLAY_JARS and f != "spending":
            raise HTTPException(
                status_code=400,
                detail=f"{t.capitalize()} can only be funded from your CoinQuest Wallet (play coins)."
            )
        if f in PLAY_JARS and t != "spending":
            raise HTTPException(
                status_code=400,
                detail=f"{f.capitalize()} money can only move back to your CoinQuest Wallet."
            )

        from_acc = await db.wallet_accounts.find_one({
            "user_id": user["user_id"],
            "account_type": transaction.from_account
        })
        
        if not from_acc or from_acc.get("balance", 0) < transaction.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        # Deduct from source
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": transaction.from_account},
            {"$inc": {"balance": -transaction.amount}}
        )
        
        # Add to destination
        await db.wallet_accounts.update_one(
            {"user_id": user["user_id"], "account_type": transaction.to_account},
            {"$inc": {"balance": transaction.amount}}
        )
    
    # Record transaction
    trans_doc = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "from_account": transaction.from_account,
        "to_account": transaction.to_account,
        "amount": transaction.amount,
        "transaction_type": transaction.transaction_type,
        "description": transaction.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Real money leaving My Wallet toward Piggy Bank / Giving is part of the child's
    # money story — tag it so it auto-appears in the My Wallet ledger & chart.
    if transaction.from_account == "my_wallet" and transaction.to_account in ("savings", "gifting"):
        bucket = "save" if transaction.to_account == "savings" else "give"
        trans_doc["transaction_type"] = "wallet_save" if bucket == "save" else "wallet_give"
        trans_doc["wallet_source"] = "my_wallet"
        trans_doc["settlement_status"] = "paid"
        trans_doc["bucket"] = bucket
        trans_doc["amount"] = -abs(transaction.amount)
        trans_doc["category"] = "piggybank" if bucket == "save" else "giving"
        trans_doc["description"] = "Saved to Piggy Bank" if bucket == "save" else "Moved to Giving Jar"
    await db.transactions.insert_one(trans_doc)
    
    # Award "Money Mover" badge for first transfer
    badge = await award_badge(db, user["user_id"], "jar_transfer")
    
    return {"message": "Transfer successful", "transaction_id": trans_doc["transaction_id"], "badge_earned": badge}

@router.get("/wallet/transactions")
async def get_transactions(request: Request, limit: int = 20, source: str = None):
    """Get recent transactions for current user.

    Optional `source` query param filters by wallet_source ('coinquest' or 'my_wallet').
    Transactions without an explicit wallet_source are classified on-the-fly so legacy
    rows still get bucketed correctly.
    """
    from services.auth import get_current_user
    from services.wallet_sources import classify_source
    db = get_db()
    user = await get_current_user(request)
    
    query = {"user_id": user["user_id"]}
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    # Backfill wallet_source for any rows missing it (legacy data)
    for t in transactions:
        if not t.get("wallet_source"):
            t["wallet_source"] = classify_source(t.get("transaction_type", "") or t.get("type", ""))

    if source in ("coinquest", "my_wallet"):
        transactions = [t for t in transactions if t.get("wallet_source") == source]

    return transactions[:limit]


@router.get("/wallet/summary")
async def get_wallet_summary(request: Request):
    """Return both wallet balances for the current child.

    - coinquest_balance: spendable in-game balance (sum of spending + savings + investing + gifting accounts).
    - my_wallet_balance: actual spendable balance on the `my_wallet` account (money the child
      has earned from chores/jobs/rewards/gifts). It stays in the child's wallet regardless of
      whether the parent has handed over real cash yet — `my_wallet_pending_count` tracks
      that separately for UI nudges.
    """
    from services.auth import get_current_user
    from services.wallet_sources import classify_source
    db = get_db()
    user = await get_current_user(request)
    user_id = user["user_id"]

    accounts = await db.wallet_accounts.find(
        {"user_id": user_id},
        {"_id": 0, "account_type": 1, "balance": 1}
    ).to_list(10)
    my_wallet_balance = 0.0
    coinquest_balance = 0.0
    for a in accounts:
        bal = float(a.get("balance", 0) or 0)
        atype = a.get("account_type")
        if atype == "my_wallet":
            my_wallet_balance += bal
        elif atype == "spending":
            # CoinQuest Wallet card == the spending account specifically. Savings, gifting
            # and investing have their own jar tiles and are NOT bucketed here.
            coinquest_balance += bal

    # Pending count is purely informational ("parent hasn't handed over the cash yet").
    raw = await db.transactions.find(
        {"user_id": user_id, "wallet_source": "my_wallet"},
        {"_id": 0, "transaction_type": 1, "settlement_status": 1}
    ).to_list(5000)
    pending_count = sum(
        1 for t in raw
        if t.get("settlement_status") != "paid" and t.get("transaction_type") != "parent_settlement"
    )

    return {
        "coinquest_balance": coinquest_balance,
        "my_wallet_balance": my_wallet_balance,
        "my_wallet_pending_count": pending_count,
    }


class MyWalletEntryCreate(BaseModel):
    entry_type: str          # 'spend' | 'save' | 'give' | 'income'
    amount: float
    category: str = "other"
    note: str = ""
    goal_id: str | None = None   # optional: save straight into a specific goal


class MyWalletEntryUpdate(BaseModel):
    amount: float | None = None
    category: str | None = None
    note: str | None = None


# Which outflow bucket a transaction belongs to (spend / save / give).
_OUT_BUCKET_BY_TYPE = {
    "manual_spend": "spend",
    "wallet_save": "save",
    "wallet_give": "give",
}


def _friendly_label(t: dict) -> str:
    """Human-friendly title for a my_wallet transaction."""
    tt = t.get("transaction_type", "")
    labels = {
        "chore_reward": "Chore reward",
        "job_payment": "Job payment",
        "allowance": "Allowance",
        "gift_received": "Gift from family",
        "parent_gift": "Gift from parent",
        "parent_reward": "Reward",
        "parent_penalty": "Penalty",
        "parent_settlement": "Parent paid you in cash",
        "wallet_save": "Saved to Piggy Bank",
        "wallet_give": "Moved to Giving Jar",
        "savings_contribution": "Put toward a savings goal",
    }
    return t.get("description") or labels.get(tt, "Money entry")


async def _build_money_story(db, user_id: str, page: int = 1, page_size: int = 10) -> dict:
    """Assemble a child's real-money story: balance, in/out totals, a spend/save/give
    breakdown for the chart, and a paginated (newest-first) list of entries."""
    from services.wallet_sources import classify_source

    acc = await db.wallet_accounts.find_one(
        {"user_id": user_id, "account_type": "my_wallet"}, {"_id": 0, "balance": 1}
    )
    balance = float(acc.get("balance", 0) or 0) if acc else 0.0

    raw = await db.transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    all_entries = []
    total_in = total_out = month_in = month_out = 0.0
    pending_count = 0
    # breakdown[bucket] = {"total": x, "categories": {cat: amount}}
    breakdown = {b: {"total": 0.0, "categories": {}} for b in ("spend", "save", "give")}

    for t in raw:
        src = t.get("wallet_source") or classify_source(t.get("transaction_type", "") or t.get("type", ""))
        if src != "my_wallet":
            continue
        tt = t.get("transaction_type", "")
        amount = abs(float(t.get("amount", 0) or 0))
        created = t.get("created_at", "") or ""
        is_month = created.startswith(month_prefix)

        # Informational rows: don't affect balance / totals / breakdown.
        if tt in ("parent_settlement", "savings_contribution"):
            all_entries.append({
                "transaction_id": t.get("transaction_id"),
                "direction": "info",
                "bucket": "save" if tt == "savings_contribution" else "cash",
                "amount": amount,
                "transaction_type": tt,
                "category": t.get("category") or ("save" if tt == "savings_contribution" else "cash"),
                "title": _friendly_label(t),
                "created_at": created,
                "is_manual": False,
                "settlement_status": "paid",
            })
            continue

        bucket = t.get("bucket") or _OUT_BUCKET_BY_TYPE.get(tt)
        raw_amount = float(t.get("amount", 0) or 0)
        if bucket in ("spend", "save", "give"):
            direction = "out"
        else:
            direction = "in" if raw_amount >= 0 else "out"
            if direction == "out":
                bucket = "spend"

        if direction == "in":
            total_in += amount
            if is_month:
                month_in += amount
            if t.get("settlement_status") != "paid":
                pending_count += 1
            cat = "income"
        else:
            total_out += amount
            if is_month:
                month_out += amount
            cat = (t.get("category") or "other").lower()
            b = breakdown[bucket]
            b["total"] += amount
            b["categories"][cat] = b["categories"].get(cat, 0.0) + amount

        all_entries.append({
            "transaction_id": t.get("transaction_id"),
            "direction": direction,
            "bucket": bucket if direction == "out" else "income",
            "amount": amount,
            "transaction_type": tt,
            "category": (t.get("category") or ("income" if direction == "in" else "other")),
            "title": _friendly_label(t),
            "created_at": created,
            "is_manual": tt in ("manual_income", "manual_spend", "wallet_save", "wallet_give"),
            "settlement_status": t.get("settlement_status", "paid"),
        })

    # Shape breakdown into a chart-friendly list.
    breakdown_out = {}
    for b, data in breakdown.items():
        breakdown_out[b] = {
            "total": round(data["total"], 2),
            "categories": sorted(
                [{"category": c, "amount": round(a, 2)} for c, a in data["categories"].items()],
                key=lambda x: -x["amount"],
            ),
        }

    total_entries = len(all_entries)
    page = max(1, int(page or 1))
    page_size = max(1, int(page_size or 10))
    total_pages = max(1, (total_entries + page_size - 1) // page_size)
    start = (page - 1) * page_size
    page_entries = all_entries[start:start + page_size]

    return {
        "balance": balance,
        "total_in": round(total_in, 2),
        "total_out": round(total_out, 2),
        "month_in": round(month_in, 2),
        "month_out": round(month_out, 2),
        "pending_count": pending_count,
        "breakdown": breakdown_out,
        "entries": page_entries,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "total_entries": total_entries,
    }


@router.get("/wallet/my-wallet")
async def get_my_wallet(request: Request, page: int = 1, page_size: int = 10):
    """Full 'My Wallet' money story for the current child."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    user_id = user["user_id"]

    # Ensure the my_wallet account exists.
    acc = await db.wallet_accounts.find_one(
        {"user_id": user_id, "account_type": "my_wallet"}, {"_id": 0, "balance": 1}
    )
    if not acc:
        await db.wallet_accounts.insert_one({
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id, "account_type": "my_wallet", "balance": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return await _build_money_story(db, user_id, page, page_size)


@router.get("/parent/child/{child_id}/money-story")
async def get_child_money_story(child_id: str, request: Request, page: int = 1, page_size: int = 10):
    """Parent view of a linked child's real-money story (balance, breakdown, entries)."""
    from services.auth import require_parent
    db = get_db()
    parent = await require_parent(request)

    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"], "child_id": child_id, "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")

    child = await db.users.find_one({"user_id": child_id}, {"_id": 0, "name": 1, "username": 1})
    story = await _build_money_story(db, child_id, page, page_size)
    story["child_name"] = (child or {}).get("name") or (child or {}).get("username") or "Your child"
    return story


@router.post("/wallet/my-wallet/entry")
async def add_my_wallet_entry(body: MyWalletEntryCreate, request: Request):
    """Child logs how they USED their real money — Spend, Save or Give — or records
    money they GOT. Spend money is gone; Save moves it to the Piggy Bank; Give moves
    it to the Giving Jar; income increases the balance. All are settled (own money)."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can log wallet entries")
    user_id = user["user_id"]

    if body.entry_type not in ("spend", "save", "give", "income"):
        raise HTTPException(status_code=400, detail="entry_type must be spend, save, give or income")
    amount = round(float(body.amount or 0), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    acc = await db.wallet_accounts.find_one({"user_id": user_id, "account_type": "my_wallet"})
    balance = float(acc.get("balance", 0) or 0) if acc else 0.0

    if body.entry_type in ("spend", "save", "give") and amount > balance:
        raise HTTPException(status_code=400, detail="You don't have that much in your wallet")

    now = datetime.now(timezone.utc).isoformat()

    if body.entry_type == "income":
        await db.wallet_accounts.update_one(
            {"user_id": user_id, "account_type": "my_wallet"},
            {"$inc": {"balance": amount},
             "$setOnInsert": {"account_id": f"acc_{uuid.uuid4().hex[:12]}", "user_id": user_id, "account_type": "my_wallet"}},
            upsert=True,
        )
        tx = {
            "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
            "user_id": user_id, "amount": amount,
            "transaction_type": "manual_income", "wallet_source": "my_wallet",
            "settlement_status": "paid", "bucket": "income",
            "category": (body.category or "other").strip().lower(),
            "description": (body.note or "").strip() or "Money added", "created_at": now,
        }
        await db.transactions.insert_one(tx)
        return {"message": "Entry added", "transaction_id": tx["transaction_id"], "balance": balance + amount}

    # Outflow: spend / save / give. Always leaves my_wallet.
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "my_wallet"}, {"$inc": {"balance": -amount}}
    )

    goal_id = None
    category = (body.category or "other").strip().lower()
    tx_type = {"spend": "manual_spend", "save": "wallet_save", "give": "wallet_give"}[body.entry_type]
    default_desc = {"spend": "Money spent", "save": "Saved to Piggy Bank", "give": "Moved to Giving Jar"}[body.entry_type]

    if body.entry_type == "save" and body.goal_id:
        # Save straight into a specific goal (bypasses the general Piggy Bank).
        goal = await db.savings_goals.find_one({"goal_id": body.goal_id, "child_id": user_id})
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        new_amount = float(goal.get("current_amount", 0) or 0) + amount
        await db.savings_goals.update_one(
            {"goal_id": body.goal_id},
            {"$set": {"current_amount": new_amount, "completed": new_amount >= goal.get("target_amount", 0)}},
        )
        goal_id = body.goal_id
        category = "goal"
        default_desc = f"Saved to {goal.get('title', 'a goal')}"
    else:
        dest = {"save": "savings", "give": "gifting"}.get(body.entry_type)
        if dest:
            await db.wallet_accounts.update_one(
                {"user_id": user_id, "account_type": dest},
                {"$inc": {"balance": amount},
                 "$setOnInsert": {"account_id": f"acc_{uuid.uuid4().hex[:12]}", "user_id": user_id, "account_type": dest}},
                upsert=True,
            )

    tx = {
        "transaction_id": f"trans_{uuid.uuid4().hex[:12]}",
        "user_id": user_id, "amount": -amount,
        "transaction_type": tx_type, "wallet_source": "my_wallet",
        "settlement_status": "paid", "bucket": body.entry_type,
        "category": category,
        "goal_id": goal_id,
        "description": (body.note or "").strip() or default_desc, "created_at": now,
    }
    await db.transactions.insert_one(tx)
    return {"message": "Entry added", "transaction_id": tx["transaction_id"], "balance": balance - amount}


_EDITABLE_TYPES = ("manual_income", "manual_spend", "wallet_save", "wallet_give")


async def _reverse_entry_effect(db, user_id: str, tx: dict, amount: float):
    """Undo the money movement of a manual entry (used by delete & edit).
    Raises HTTPException if the money is no longer available to reverse."""
    tt = tx.get("transaction_type")
    if tt == "manual_income":
        acc = await db.wallet_accounts.find_one({"user_id": user_id, "account_type": "my_wallet"})
        if float((acc or {}).get("balance", 0) or 0) < amount:
            raise HTTPException(status_code=400, detail="You've already used this money, so it can't be undone")
        await db.wallet_accounts.update_one(
            {"user_id": user_id, "account_type": "my_wallet"}, {"$inc": {"balance": -amount}})
        return
    # Outflows: return the money to my_wallet and take it back from where it went.
    if tt == "wallet_save" and tx.get("goal_id"):
        goal = await db.savings_goals.find_one({"goal_id": tx["goal_id"], "child_id": user_id})
        if not goal or float(goal.get("current_amount", 0) or 0) < amount:
            raise HTTPException(status_code=400, detail="This saved money has already moved, so it can't be undone")
        new_amount = float(goal.get("current_amount", 0) or 0) - amount
        await db.savings_goals.update_one(
            {"goal_id": tx["goal_id"]},
            {"$set": {"current_amount": new_amount, "completed": new_amount >= goal.get("target_amount", 0)}})
    else:
        dest = {"wallet_save": "savings", "wallet_give": "gifting"}.get(tt)
        if dest:
            dacc = await db.wallet_accounts.find_one({"user_id": user_id, "account_type": dest})
            if float((dacc or {}).get("balance", 0) or 0) < amount:
                raise HTTPException(status_code=400, detail="That money has already been used, so it can't be undone")
            await db.wallet_accounts.update_one(
                {"user_id": user_id, "account_type": dest}, {"$inc": {"balance": -amount}})
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "my_wallet"}, {"$inc": {"balance": amount}})


@router.delete("/wallet/my-wallet/entry/{transaction_id}")
async def delete_my_wallet_entry(transaction_id: str, request: Request):
    """Undo a manual wallet entry the child logged, reversing its money movement."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can undo their entries")
    user_id = user["user_id"]

    tx = await db.transactions.find_one({"transaction_id": transaction_id, "user_id": user_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Entry not found")
    if tx.get("transaction_type") not in _EDITABLE_TYPES:
        raise HTTPException(status_code=400, detail="Only entries you added yourself can be undone")

    await _reverse_entry_effect(db, user_id, tx, abs(float(tx.get("amount", 0) or 0)))
    await db.transactions.delete_one({"transaction_id": transaction_id, "user_id": user_id})
    return {"message": "Entry removed"}


@router.put("/wallet/my-wallet/entry/{transaction_id}")
async def update_my_wallet_entry(transaction_id: str, body: MyWalletEntryUpdate, request: Request):
    """Fix a manual wallet entry: change its amount, category or note. The money
    movement is adjusted by the difference (same bucket / destination)."""
    from services.auth import get_current_user
    db = get_db()
    user = await get_current_user(request)
    if user.get("role") != "child":
        raise HTTPException(status_code=403, detail="Only children can fix their entries")
    user_id = user["user_id"]

    tx = await db.transactions.find_one({"transaction_id": transaction_id, "user_id": user_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Entry not found")
    tt = tx.get("transaction_type")
    if tt not in _EDITABLE_TYPES:
        raise HTTPException(status_code=400, detail="Only entries you added yourself can be fixed")

    old_amount = abs(float(tx.get("amount", 0) or 0))
    updates = {}

    if body.amount is not None:
        new_amount = round(float(body.amount), 2)
        if new_amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than zero")
        if new_amount != old_amount:
            # Reverse the old movement, then re-apply the new one.
            await _reverse_entry_effect(db, user_id, tx, old_amount)
            reapply = MyWalletEntryCreate(
                entry_type=tx.get("bucket") or ("income" if tt == "manual_income" else "spend"),
                amount=new_amount,
                category=tx.get("category", "other"),
                note=(body.note if body.note is not None else tx.get("description", "")),
                goal_id=tx.get("goal_id"),
            )
            # Apply new movement inline (mirror of add endpoint) without a new tx.
            acc = await db.wallet_accounts.find_one({"user_id": user_id, "account_type": "my_wallet"})
            bal = float((acc or {}).get("balance", 0) or 0)
            if reapply.entry_type == "income":
                await db.wallet_accounts.update_one(
                    {"user_id": user_id, "account_type": "my_wallet"}, {"$inc": {"balance": new_amount}})
            else:
                if new_amount > bal:
                    # roll back the reversal so nothing is lost
                    await _apply_entry_effect_raw(db, user_id, tt, old_amount, tx.get("goal_id"))
                    raise HTTPException(status_code=400, detail="You don't have that much in your wallet")
                await _apply_entry_effect_raw(db, user_id, tt, new_amount, tx.get("goal_id"))
            updates["amount"] = new_amount if tt == "manual_income" else -new_amount

    if body.category is not None:
        updates["category"] = body.category.strip().lower()
    if body.note is not None:
        updates["description"] = body.note.strip() or tx.get("description", "")

    if updates:
        await db.transactions.update_one({"transaction_id": transaction_id, "user_id": user_id}, {"$set": updates})
    return {"message": "Entry updated"}


async def _apply_entry_effect_raw(db, user_id: str, tt: str, amount: float, goal_id: str | None):
    """Apply a manual entry's money movement (used when re-applying an edit)."""
    if tt == "manual_income":
        await db.wallet_accounts.update_one(
            {"user_id": user_id, "account_type": "my_wallet"}, {"$inc": {"balance": amount}})
        return
    await db.wallet_accounts.update_one(
        {"user_id": user_id, "account_type": "my_wallet"}, {"$inc": {"balance": -amount}})
    if tt == "wallet_save" and goal_id:
        goal = await db.savings_goals.find_one({"goal_id": goal_id, "child_id": user_id})
        if goal:
            new_amount = float(goal.get("current_amount", 0) or 0) + amount
            await db.savings_goals.update_one(
                {"goal_id": goal_id},
                {"$set": {"current_amount": new_amount, "completed": new_amount >= goal.get("target_amount", 0)}})
    else:
        dest = {"wallet_save": "savings", "wallet_give": "gifting"}.get(tt)
        if dest:
            await db.wallet_accounts.update_one(
                {"user_id": user_id, "account_type": dest},
                {"$inc": {"balance": amount},
                 "$setOnInsert": {"account_id": f"acc_{uuid.uuid4().hex[:12]}", "user_id": user_id, "account_type": dest}},
                upsert=True)




class SettleRequest(BaseModel):
    child_id: str
    transaction_ids: list[str] | None = None  # If empty/None, settle ALL pending


@router.post("/parent/wallet/settle")
async def settle_my_wallet(body: SettleRequest, request: Request):
    """Parent marks pending My Wallet credits as paid in real life.

    If `transaction_ids` is provided, only those are marked paid; otherwise every
    unpaid my_wallet credit for this child is settled. A summary settlement record
    is appended so history shows when the parent paid.
    """
    from services.auth import require_parent
    from services.wallet_sources import classify_source
    db = get_db()
    parent = await require_parent(request)

    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": body.child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")

    match = {"user_id": body.child_id}
    if body.transaction_ids:
        match["transaction_id"] = {"$in": body.transaction_ids}

    candidates = await db.transactions.find(
        match,
        {"_id": 0, "transaction_id": 1, "amount": 1, "transaction_type": 1, "type": 1,
         "wallet_source": 1, "settlement_status": 1}
    ).to_list(5000)

    pending_ids = []
    total = 0.0
    for t in candidates:
        src = t.get("wallet_source") or classify_source(t.get("transaction_type", "") or t.get("type", ""))
        if src != "my_wallet":
            continue
        if t.get("settlement_status") == "paid":
            continue
        # Skip the settlement records themselves
        if t.get("transaction_type") == "parent_settlement":
            continue
        pending_ids.append(t["transaction_id"])
        total += float(t.get("amount", 0) or 0)

    if not pending_ids:
        return {"message": "No pending entries to settle", "settled_count": 0, "settled_amount": 0}

    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.update_many(
        {"transaction_id": {"$in": pending_ids}},
        {"$set": {
            "settlement_status": "paid",
            "settled_at": now,
            "settled_by": parent["user_id"],
            "wallet_source": "my_wallet"
        }}
    )

    # Append a parent settlement marker so the child sees a clear "Parent paid ₹X" entry.
    settlement_id = f"settle_{uuid.uuid4().hex[:12]}"
    await db.transactions.insert_one({
        "transaction_id": settlement_id,
        "user_id": body.child_id,
        "amount": -total,  # negative because pending balance now reduces by this much
        "transaction_type": "parent_settlement",
        "wallet_source": "my_wallet",
        "settlement_status": "paid",
        "settled_at": now,
        "settled_by": parent["user_id"],
        "description": f"{parent.get('name', 'Parent')} marked ₹{total:.0f} as paid",
        "created_at": now,
    })

    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": body.child_id,
        "type": "parent_settlement",
        "message": f"{parent.get('name', 'Parent')} paid you ₹{total:.0f} for pending earnings.",
        "is_read": False,
        "created_at": now,
    })

    return {
        "message": f"Settled ₹{total:.0f} across {len(pending_ids)} entries",
        "settled_count": len(pending_ids),
        "settled_amount": total,
        "settlement_id": settlement_id,
    }


@router.get("/parent/wallet/pending/{child_id}")
async def get_child_pending(child_id: str, request: Request):
    """Return all unsettled My Wallet items the parent owes this child."""
    from services.auth import require_parent
    from services.wallet_sources import classify_source
    db = get_db()
    parent = await require_parent(request)

    link = await db.parent_child_links.find_one({
        "parent_id": parent["user_id"],
        "child_id": child_id,
        "status": "active"
    })
    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this child")

    raw = await db.transactions.find(
        {"user_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(2000)

    pending = []
    total = 0.0
    for t in raw:
        src = t.get("wallet_source") or classify_source(t.get("transaction_type", "") or t.get("type", ""))
        if src != "my_wallet":
            continue
        if t.get("settlement_status") == "paid":
            continue
        if t.get("transaction_type") == "parent_settlement":
            continue
        pending.append(t)
        total += float(t.get("amount", 0) or 0)

    return {"pending": pending, "pending_total": total, "pending_count": len(pending)}


@router.post("/admin/wallet/migrate-sources")
async def migrate_wallet_sources(request: Request):
    """One-time admin task: backfill `wallet_source` on every existing transaction
    based on its transaction_type/type. Idempotent — only writes when field is missing."""
    from services.auth import require_admin
    from services.wallet_sources import classify_source
    db = get_db()
    await require_admin(request)

    cursor = db.transactions.find(
        {"wallet_source": {"$exists": False}},
        {"_id": 0, "transaction_id": 1, "transaction_type": 1, "type": 1}
    )
    coinquest = 0
    my_wallet = 0
    async for t in cursor:
        tt = t.get("transaction_type") or t.get("type") or ""
        src = classify_source(tt)
        update = {"wallet_source": src}
        # Parent-originated credits are pending until parent settles
        if src == "my_wallet" and tt != "parent_settlement":
            update["settlement_status"] = "pending"
        await db.transactions.update_one(
            {"transaction_id": t["transaction_id"]},
            {"$set": update}
        )
        if src == "my_wallet":
            my_wallet += 1
        else:
            coinquest += 1

    return {"migrated_coinquest": coinquest, "migrated_my_wallet": my_wallet}


@router.post("/admin/wallet/promote-my-wallet")
async def promote_my_wallet(request: Request):
    """One-time admin task: promote My Wallet from a tracking ledger to a real spendable
    balance. For every child user:
      1. Ensure a `my_wallet` wallet_account exists (balance 0).
      2. Move any pending unsettled `my_wallet` ledger entries that were created
         *before this rollout* into a settled state (their money is already in the
         child's spending balance from the pre-feature behaviour, so we don't want
         to double-credit it).
    Idempotent — safe to re-run."""
    from services.auth import require_admin
    from datetime import datetime, timezone
    import uuid
    db = get_db()
    await require_admin(request)

    now = datetime.now(timezone.utc).isoformat()
    accounts_created = 0
    settled = 0

    async for u in db.users.find({"role": "child"}, {"_id": 0, "user_id": 1}):
        uid = u["user_id"]
        existing = await db.wallet_accounts.find_one({"user_id": uid, "account_type": "my_wallet"})
        if not existing:
            await db.wallet_accounts.insert_one({
                "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                "user_id": uid,
                "account_type": "my_wallet",
                "balance": 0.0,
                "created_at": now,
            })
            accounts_created += 1

        # Sweep legacy pending my_wallet entries to 'paid' so they don't appear as owed.
        res = await db.transactions.update_many(
            {
                "user_id": uid,
                "wallet_source": "my_wallet",
                "settlement_status": "pending",
                "transaction_id": {"$not": {"$regex": "^demo_"}},  # keep demo seeds intact
            },
            {"$set": {
                "settlement_status": "paid",
                "settled_at": now,
                "settled_by": "system_migration",
                "settlement_note": "Auto-settled by My Wallet promotion (legacy ledger)",
            }}
        )
        settled += res.modified_count

    return {"my_wallet_accounts_created": accounts_created, "legacy_pending_settled": settled}

