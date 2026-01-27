# CoinQuest - Financial Literacy Learning App for Children

## Original Problem Statement
A gamified financial literacy learning application for children (K-5) with distinct user roles (Teacher, Parent, Child, Admin). Features include a digital wallet, virtual store, gamified investment modules (Money Garden & Stock Market), dynamic quests, achievements, and hierarchical content system. Currency: Indian Rupees (₹).

## What's Been Implemented

### Core MVP ✅
- User authentication (Google OAuth + Admin login)
- Role-based dashboards (Admin, Teacher, Parent, Child)
- Content management system with drag-and-drop reordering
- Virtual store with categories and items
- Wallet system (Spending, Savings, Gifting jars)
- User connections (Parent-Child, Teacher-Classroom)
- Dynamic quest system (Admin, Teacher, Parent chores)
- Shopping list system for parents
- Notification center with navigation

### Money Garden System (Grade 1-2) ✅
- Farm-based investment simulation for younger children
- 2x2 starting grid (expandable at ₹20/plot)
- Plant seeds, watering system, growth stages
- Market system with daily price fluctuations
- Market hours: 7 AM - 5 PM IST
- Harvest and sell produce at market

### Stock Market System (Grade 3-5) ✅
- Complete trading system with buy/sell during market hours
- Industry categories (Tech, Healthcare, Food, etc.)
- Stocks with ticker symbols, volatility, risk levels
- News & Events system affecting prices
- Portfolio with P/L tracking
- Transfer funds between accounts

### Content Management ✅
- Hierarchical content (Topics → Subtopics → Content Items)
- Drag-and-drop reordering using @dnd-kit
- Move subtopics/content between categories
- Grade-level filtering
- Role-based visibility (Child, Parent, Teacher)
- Progressive unlock system for children

### Recent Updates (January 27, 2026)

**School User Role System (NEW):**
- **School Login Page** (`/school-login`): Dedicated login for schools with username/password authentication
- **School Dashboard** (`/school-dashboard`): Comprehensive dashboard for school administrators:
  - Overview tab with teachers/students cards
  - Teachers tab with search and list view
  - Students tab with search and grade filtering
  - Performance tab with student comparison (sortable by name, grade, balance, lessons, quests, streak)
  - Stats cards showing total teachers, students, and classrooms
- **Admin School Management**: New "Schools" tab in Admin dashboard:
  - Create schools with name, username, password, address, contact email
  - View all schools with teacher/student counts
  - Delete schools (unlinks associated users)
- **CSV Bulk Upload**: Schools can bulk upload teachers, students, and parents via CSV files
- **Landing Page**: Added "School" login button in navigation

**Backend School APIs:**
- POST /api/auth/school-login - School authentication
- GET /api/school/dashboard - School dashboard data
- GET /api/school/students/comparison - Student performance comparison
- POST /api/school/upload/teachers - Bulk upload teachers
- POST /api/school/upload/students - Bulk upload students  
- POST /api/school/upload/parents - Bulk upload parents
- POST /api/admin/schools - Create school (admin)
- GET /api/admin/schools - List schools (admin)
- DELETE /api/admin/schools/{id} - Delete school (admin)

**Teacher Dashboard Enhancements:**
- **Comprehensive Student Insights Modal**: Teachers can view detailed data for each student:
  - Money Jars breakdown (all account balances)
  - Total earnings vs spending
  - Parent chores (assigned, completed, pending, rejected)
  - Teacher quests completion rate
  - Gift activity (received/sent)
  - Money Garden performance (invested, earned, P/L)
  - Stock Market performance (portfolio value, realized/unrealized gains)
  - Learning progress (lessons completed, percentage)
  - Badges earned
  
- **Student Comparison Table**: New "Compare All" button shows all students side-by-side with:
  - All financial metrics
  - Chores/quests completed
  - Learning progress
  - Investment P/L
  - Gift activity
  - Badges and streaks
  - Top performer highlighted with crown

- **Grade-Filtered Learning Content**: Learning content link moved inside classroom, filtered by classroom grade

**Bug Fixes:**
- Dashboard "Active Quests" now correctly hides completed quests
- Notification center navigation and "Mark all as read" fixed
- Chore completion properly sets `is_completed: true`

## API Endpoints

### Money Garden (Child)
- GET /api/garden/farm - Get farm with plots, seeds, inventory
- POST /api/garden/buy-plot - Buy additional plot (₹20)
- POST /api/garden/plant - Plant a seed
- POST /api/garden/water/{plot_id} - Water plant
- POST /api/garden/sell - Sell produce at market

### Stock Market (Child)
- GET /api/stocks - Get all stocks with market info
- GET /api/stocks/market-info - Get market status (open/closed)
- POST /api/stocks/buy - Buy stocks
- POST /api/stocks/sell - Sell stocks
- GET /api/stocks/portfolio - Get user's portfolio

### Content Management (Admin)
- GET /api/content/topics - Get all topics
- POST /api/admin/content/topics - Create topic
- POST /api/admin/content/subtopics/{id}/move - Move subtopic
- POST /api/admin/content/items/{id}/move - Move content item
- PUT /api/admin/content/topics/reorder - Reorder topics/subtopics

### Investment Access by Grade
- **Kindergarten (Grade 0):** No investments - focus on learning basics
- **Grade 1-2:** Money Garden only (farm-based simulation)
- **Grade 3-5:** Stock Market only (trading simulation)

### Parent Dashboard
- GET /api/parent/dashboard - Get parent overview with linked children
- GET /api/parent/children/{id}/insights - Comprehensive child insights
- GET /api/parent/children/{id}/progress - Basic child progress
- POST /api/parent/chores-new - Create chore for child
- POST /api/parent/reward-penalty - **NEW** Give instant reward or apply penalty
- GET /api/parent/reward-penalty - **NEW** Get reward/penalty history
- DELETE /api/parent/reward-penalty/{id} - **NEW** Delete record

### Teacher Dashboard
- GET /api/teacher/dashboard - Get teacher overview
- GET /api/teacher/classrooms/{id} - Get classroom details
- GET /api/teacher/classrooms/{id}/student/{student_id}/insights - **NEW** Comprehensive student insights
- GET /api/teacher/classrooms/{id}/comparison - **NEW** Compare all students in classroom
- POST /api/teacher/classrooms/{id}/reward - Give rewards to students

## Credentials
- **Admin:** admin@learnersplanet.com / finlit@2026
- **Test School:** springfield / test123 (Springfield Elementary)
- **Users:** Google Social Login

## Key Files
- `/app/backend/server.py` - FastAPI backend (modularized, routes integrated)
- `/app/backend/core/` - Database & config modules
- `/app/backend/models/` - All Pydantic models (9 files)
- `/app/backend/services/auth.py` - Authentication helpers
- `/app/backend/routes/auth.py` - Auth routes (INTEGRATED)
- `/app/backend/routes/school.py` - School routes (INTEGRATED)
- `/app/frontend/src/pages/Dashboard.jsx` - Child dashboard
- `/app/frontend/src/pages/StockMarketPage.jsx` - Stock trading UI
- `/app/frontend/src/pages/MoneyGardenPage.jsx` - Garden/farm UI
- `/app/frontend/src/pages/ContentManagement.jsx` - Admin content management
- `/app/frontend/src/pages/SchoolLogin.jsx` - School login page
- `/app/frontend/src/pages/SchoolDashboard.jsx` - School dashboard
- `/app/frontend/src/pages/AdminPage.jsx` - Admin dashboard with Schools tab
- `/app/frontend/src/components/NotificationCenter.jsx` - Notification dialog

## Pending/Backlog

### P1 - High Priority
- [x] School User Role System ✅ (Completed Jan 27, 2026)
- [ ] Streak Bonuses (7-day, 30-day milestones)
- [ ] Leaderboards
- [ ] Spending limits & parent approval for large transactions

### P2 - Medium Priority
- [ ] Backend refactor (split server.py into modules)
- [ ] Teacher/Parent collaboration portal
- [ ] Collaborative & seasonal events
- [ ] Email notifications
- [ ] Tutorial system

### Technical Debt
- `/app/backend/server.py` - **PHASE 2 COMPLETE**: Auth & School routes migrated. Remaining routes pending.
- `/app/frontend/src/pages/ContentManagement.jsx` - Over 1500 lines, needs component decomposition
- `/app/frontend/src/pages/TeacherDashboard.jsx` - Large file, student insights modal should be extracted
- `/app/frontend/src/pages/ParentDashboard.jsx` - Growing file, consider component extraction
