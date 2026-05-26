"""Wallet source classification & helpers for CoinQuest (play) vs My Wallet (real, owed by parent).

Two ledgers coexist:
  * CoinQuest Wallet — actual spendable balance held on `wallet_accounts` (spending/gifting/...).
    Credited by lesson completion, streaks, badges, garden, stocks, admin/teacher quests, etc.
  * My Wallet      — ledger-only. Tracks money owed by a parent to their child (rewards,
    penalties, gifts, allowance, parent-assigned chores, jobs). NEVER touches the wallet
    balance — only stores transactions tagged with wallet_source='my_wallet' and
    settlement_status='pending' until the parent marks them paid.
"""

# Authoritative classification map. Anything not listed defaults to 'coinquest'.
MY_WALLET_TX_TYPES = {
    "parent_reward",
    "parent_penalty",
    "parent_gift",
    "gift_received",   # parent → child (give-money endpoint uses this type)
    "allowance",
    "chore_reward",    # parent-assigned chores
    "job_payment",     # parent-assigned jobs
    "parent_settlement",  # the settlement record itself stays on my_wallet ledger
}


def classify_source(transaction_type: str) -> str:
    """Return 'my_wallet' for any parent-originated transaction type, else 'coinquest'."""
    return "my_wallet" if transaction_type in MY_WALLET_TX_TYPES else "coinquest"
