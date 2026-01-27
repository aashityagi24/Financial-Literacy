# CoinQuest Backend - Refactored Structure
# ==========================================
# 
# The monolithic server.py (9600+ lines) has been broken down into modules.
# This is Phase 1 of the refactoring - creating the modular structure.
#
# Directory Structure:
# /app/backend/
# ├── server.py              # Main FastAPI app (legacy, still working)
# ├── core/
# │   ├── __init__.py        # Core exports
# │   ├── config.py          # Application settings & directories
# │   └── database.py        # MongoDB connection (db, client)
# ├── models/                 # All Pydantic models extracted
# │   ├── __init__.py        # Exports all models
# │   ├── user.py            # UserBase, UserCreate, UserUpdate, Chat models
# │   ├── wallet.py          # WalletAccount, Transaction, Achievement
# │   ├── store.py           # StoreCategory, StoreItem, Purchase
# │   ├── quest.py           # Quest, Chore, RewardPenalty models
# │   ├── learning.py        # ContentTopic, ContentItem, Quiz, Lesson, etc.
# │   ├── classroom.py       # Classroom, ClassroomStudent, Challenge
# │   ├── parent.py          # ParentChildLink, Allowance, ShoppingList, SavingsGoal
# │   ├── investment.py      # Garden (GardenPlant, Plot, Inventory), Stock (Stock, Holding, News)
# │   └── school.py          # School, SchoolCreate, SchoolLoginRequest
# ├── services/
# │   ├── __init__.py
# │   └── auth.py            # Auth helpers: get_current_user, require_admin/teacher/parent/child/school
# └── routes/
#     ├── __init__.py
#     ├── auth.py            # Auth routes (ready, not yet integrated)
#     └── school.py          # School routes (ready, not yet integrated)
#
# Migration Status:
# ================
# [x] Core config & database modules created and tested
# [x] All Pydantic models extracted to /models/ (9 files)
# [x] Auth service helpers extracted to /services/auth.py
# [x] Auth routes extracted to /routes/auth.py
# [x] School routes extracted to /routes/school.py
# [ ] Wallet routes migration
# [ ] Store routes migration
# [ ] Garden routes migration  
# [ ] Stock market routes migration
# [ ] Quest routes migration
# [ ] Teacher routes migration
# [ ] Parent routes migration
# [ ] Admin routes migration
# [ ] Learning content routes migration
#
# How to use new models in new code:
# ==================================
# import sys
# sys.path.insert(0, '/app/backend')
#
# from models import UserBase, WalletAccount, StoreItem
# from models.investment import Stock, GardenPlant
# from services.auth import get_current_user, require_admin
# from core.database import db
# from core.config import settings
#
# Benefits of new structure:
# =========================
# 1. Models are reusable across different route files
# 2. Auth services are centralized - changes apply everywhere
# 3. Database connection is managed in one place
# 4. Each route file is focused and maintainable
# 5. Easier to test individual components
# 6. New developers can understand the codebase faster
#
# Phase 2 (Future):
# ================
# - Integrate modular routes into server.py via include_router()
# - Remove duplicate code from server.py
# - Add unit tests for services
# - Add API documentation per module
#
# Note: Current server.py still works! The refactoring is additive.
# No breaking changes have been introduced.
