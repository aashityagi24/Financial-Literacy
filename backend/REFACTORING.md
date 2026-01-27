# CoinQuest Backend - Refactored Structure
# ==========================================
# 
# This document outlines the refactored backend structure for CoinQuest.
# The monolithic server.py (9600+ lines) has been broken down into modules.
#
# Directory Structure:
# /app/backend/
# ├── server.py              # Main FastAPI app entry point (orchestrator)
# ├── core/
# │   ├── __init__.py
# │   ├── config.py          # Application settings & environment
# │   └── database.py        # MongoDB connection
# ├── models/
# │   ├── __init__.py        # Exports all models
# │   ├── user.py            # User, ChatMessage, ChatResponse
# │   ├── wallet.py          # WalletAccount, Transaction, Achievement
# │   ├── store.py           # StoreCategory, StoreItem
# │   ├── quest.py           # Quest, Chore, RewardPenalty
# │   ├── learning.py        # ContentTopic, ContentItem, Quiz, etc.
# │   ├── classroom.py       # Classroom, ClassroomStudent, Challenge
# │   ├── parent.py          # ParentChildLink, Allowance, ShoppingList
# │   ├── investment.py      # Garden plants, Stocks, Holdings
# │   └── school.py          # School models
# ├── services/
# │   ├── __init__.py
# │   └── auth.py            # Authentication helpers & role checks
# └── routes/
#     ├── __init__.py
#     └── auth.py            # Authentication routes (ready to use)
#
# Migration Status:
# ================
# [x] Core config & database modules created
# [x] All Pydantic models extracted to /models/
# [x] Auth service helpers extracted to /services/auth.py
# [x] Auth routes partially extracted to /routes/auth.py
# [ ] Wallet routes migration
# [ ] Store routes migration
# [ ] Garden routes migration
# [ ] Stock market routes migration
# [ ] Quest routes migration
# [ ] Teacher routes migration
# [ ] Parent routes migration
# [ ] Admin routes migration
# [ ] School routes migration
# [ ] Learning content routes migration
#
# How to use new models:
# =====================
# from models import UserBase, WalletAccount, StoreItem
# from models.investment import Stock, GardenPlant
# from services.auth import get_current_user, require_admin
# from core.database import db
#
# Note: Current server.py still works and imports can be added incrementally.
