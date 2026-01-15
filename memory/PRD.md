# MoneyHeros - Financial Literacy Learning App for Children

## Original Problem Statement
A gamified financial literacy learning application for children (K-5) with distinct user roles (Teacher, Parent, Child, Admin). Features include virtual store, investment simulations, quests, achievements, and avatar customization.

## Core Requirements
- **User Roles:** Teacher (manage class), Parent (manage chores/shopping lists), Child (digital wallet, store, investments), Admin (content management)
- **Content System:** Hierarchical content structure (Topic -> Subtopic -> Content Item)
- **Authentication:** Emergent-managed Google OAuth for users, email/password for Admin
- **Currency:** Indian Rupees (₹)
- **UI/UX:** Child-friendly, visually appealing

## Tech Stack
- **Backend:** FastAPI (Python), MongoDB
- **Frontend:** React, Tailwind CSS, Shadcn UI
- **Authentication:** Emergent-managed Google Auth, JWT for Admin
- **AI Integration:** Claude Sonnet 4.5 via Emergent LLM Key
- **Background Jobs:** APScheduler

## What's Been Implemented

### Phase 1: Core MVP ✅
- User authentication (Google OAuth + Admin login)
- Role-based dashboards (Admin, Teacher, Parent, Child)
- Content management system
- Virtual store with categories and items
- Investment system (Plants for K-2, Stocks for 3-5)
- Wallet system (Spending, Savings, Gifting jars)
- User connections (Parent-Child, Teacher-Classroom)

### Phase 2: Quest System Overhaul ✅
- **Admin Quests:** Complex quests with MCQ, Multi-select, True/False, Value Entry questions
- **Teacher Quests:** Classroom-specific quests with file uploads
- **Parent Chores:** Recurring chores (daily/weekly) with validation flow
- **Child Quest Interface:** Filtering by creator, sorting options
- **Interactive Question UI:** Radio buttons for MCQ/T-F, Checkboxes for Multi-select
- **Quest Reminders:** Automated scheduler for due date notifications

### Phase 3: Shopping List System ✅ (January 15, 2026)
- Parents can create shopping lists for children
- Custom reward amounts set by parents
- Shopping chores created from list items
- Parents cannot purchase directly from store (403 blocked)
- Chore validation flow (child completes -> parent approves -> reward credited)

### Phase 4: UX Improvements ✅ (January 15, 2026)
- Added proper field labels across all forms
- All input fields now show clear descriptions
- Parent dashboard forms fully labeled
- Admin/Teacher quest forms fully labeled
- Shopping list chore form with clear instructions

## API Endpoints

### Authentication
- POST /api/auth/admin-login
- POST /api/auth/logout
- GET /api/auth/session

### Admin
- /api/admin/quests - CRUD for admin quests
- /api/admin/store/* - Store management
- /api/admin/investments/* - Investment management

### Teacher
- GET/POST /api/teacher/quests - Quest management
- PUT /api/teacher/quests/{quest_id} - Edit quest
- DELETE /api/teacher/quests/{quest_id} - Delete quest

### Parent
- POST /api/parent/chores-new - Create chore
- GET /api/parent/chores-new - List chores
- POST /api/parent/shopping-list - Add to shopping list
- GET /api/parent/shopping-list - Get shopping list
- DELETE /api/parent/shopping-list/{list_id} - Remove item
- POST /api/parent/shopping-list/create-chore - Create chore from list

### Child
- GET /api/child/quests-new - Get all quests
- POST /api/child/quests/{quest_id}/submit - Submit answers
- POST /api/child/chores/{chore_id}/request-complete - Request chore completion

## Database Collections
- users, sessions
- new_quests, quest_completions
- shopping_lists
- wallet_accounts, transactions
- admin_store_items, store_categories
- classroom_students, parent_child_links
- notifications

## Credentials
- **Admin:** admin@learnersplanet.com / finlit@2026
- **Users:** Google Social Login

## Pending/Backlog

### P1 - High Priority
- [ ] Daily Login Rewards & Streak Bonuses
- [ ] Leaderboards
- [ ] Spending limits & parent approval for large transactions

### P2 - Medium Priority
- [ ] Teacher/Parent collaboration portal
- [ ] Collaborative & seasonal events
- [ ] Avatar customization
- [ ] Email notifications
- [ ] Tutorial system for new users
- [ ] Backend refactor (split server.py into modular structure)

## Known Issues
- None currently

## Files Structure
```
/app/
├── backend/
│   ├── server.py (monolithic - needs refactoring)
│   └── uploads/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminQuestsPage.jsx
│   │   │   ├── TeacherDashboard.jsx
│   │   │   ├── ParentDashboard.jsx
│   │   │   ├── ParentShoppingList.jsx (New)
│   │   │   ├── QuestsPage.jsx
│   │   │   └── ...
│   │   └── App.js
└── memory/
    └── PRD.md
```
