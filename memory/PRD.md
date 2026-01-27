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

**Session 3 Bug Fixes & Feature Enhancements:**

1. **Join Classroom Fixed** ✅
   - Fixed ObjectId serialization error by adding `{'_id': 0}` projection
   - Fixed join_code/invite_code mismatch (backend now uses `join_code` consistently)
   - Returns teacher info (name, email, picture) in response
   - Updated existing classrooms via migration script to have join_code

2. **Teacher Name Display** ✅
   - Profile page shows "Teacher: [name]" for each enrolled classroom
   - GET /api/student/classrooms now returns teacher object with name

3. **Default Avatars** ✅
   - Created `/app/frontend/src/utils/avatars.js` with `getDefaultAvatar` utility
   - Generates SVG data URLs with role-based colors:
     - Child: Yellow (#FFD23F)
     - Parent: Green (#06D6A0)
     - Teacher: Blue (#3D5A80)
     - Admin: Orange (#EE6C4D)
     - School: Dark Blue (#1D3557)
   - Applied to Dashboard and ProfilePage

4. **School User Creation Enhanced** ✅
   - Schools can add existing users (without school_id) to their school
   - Individual user creation with automatic relationships:
     - Teachers: Optional grade and class_name (creates classroom automatically)
     - Children: Optional teacher_email or classroom_code (enrolls automatically)
     - Parents: Optional child_email (links to child automatically)

5. **Bulk Upload Enhanced** ✅
   - Teachers CSV: name, email, grade (optional), class_name (optional)
   - Students CSV: name, email, grade, teacher_email (optional - links to teacher's classroom)
   - Parents CSV: name, email, child_email (optional - links to child)
   - Returns created count + relationship links count

**Session 2 Bug Fixes & Feature Enhancements:**

1. **Google OAuth Sign-In Fixed** ✅
   - Corrected Emergent auth validation endpoint (was using wrong URL)
   - Now uses `GET https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with `X-Session-ID` header
   - Session token stored in localStorage as backup

2. **Parent Chore Approval Workflow** ✅
   - When child marks chore as completed, it goes to "pending_approval" status
   - Parent sees pending chores in dashboard
   - Parent can approve (coins awarded to child) or reject (with reason)
   - Rejected chores remain active for resubmission
   - Notifications sent to both parent and child at each step

3. **Store Items Fixed** ✅
   - Changed to use `admin_store_items` collection instead of `store_items`
   - Filters by active categories only (`is_active: true`)
   - Fixed frontend to parse object response format

4. **Teacher Compare All Enhanced** ✅
   - Returns all fields: spending/savings/gifting/investing (balance + spent)
   - Includes lessons, quests, chores completed
   - Shows garden P/L (grades 1-2) and stock P/L (grades 3-5)
   - Displays gifts received/sent, badges, streak

5. **Student Insights Fixed** ✅
   - Restructured backend response to match frontend expectations
   - Nested structure: wallet, learning, transactions, chores, quests, achievements, gifts, garden, stocks
   - Grade-based investment display (K=none, 1-2=garden, 3-5=stocks)

6. **Child Classmates Enhanced** ✅
   - Returns streak, balance, investment performance, lessons completed, badges
   - Sorted by lessons completed
   - Includes classroom info

7. **Quest Submission Improved** ✅
   - Prevents re-attempts (returns 400 if already completed)
   - Returns correct answers after submission for review
   - Shows if passed (60% threshold)

8. **Parent Shopping List Fixed** ✅
   - Correctly parses store items from object response format

---

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

**Backend Refactoring Phase 4 (January 27, 2026):**
- Migrated 52 additional routes from server.py to modular files
- Created new `uploads.py` module (8 endpoints for file uploads)
- Integrated `stocks.py` module (10 endpoints for stock market)
- Enhanced `admin.py` with comprehensive stats and cascading user deletion
- Enhanced `child.py` with max 2 parents limit and better validation
- Enhanced `learning.py` with progress tracking per topic and activity completion status
- Server.py reduced from 163 to 111 active routes (50% complete)
- Total modular routes: 111 across 16 route files

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
- `/app/backend/server.py` - FastAPI backend (REFACTORING COMPLETE - 98% migrated)
- `/app/backend/routes/` - 19 modular route files:
  - `auth.py`, `school.py`, `wallet.py`, `store.py`, `garden.py`
  - `investments.py`, `achievements.py`, `quests.py`, `notifications.py`
  - `teacher.py`, `parent.py`, `admin.py`, `child.py`, `learning.py`
  - `uploads.py`, `stocks.py`, `content.py`, `student.py`
- `/app/backend/models/` - 9 Pydantic model files
- `/app/backend/services/auth.py` - Authentication helpers
- `/app/frontend/src/pages/` - React page components

## Pending/Backlog

### P1 - High Priority
- [x] School User Role System ✅ (Completed Jan 27, 2026)
- [ ] Streak Bonuses (7-day, 30-day milestones)
- [ ] Leaderboards
- [ ] Spending limits & parent approval for large transactions

### P2 - Medium Priority
- [x] Backend refactor (COMPLETE - 98% migrated to 19 modules)
- [ ] Teacher/Parent collaboration portal
- [ ] Collaborative & seasonal events
- [ ] Email notifications
- [ ] Tutorial system

### Technical Debt
- `/app/backend/server.py` - **REFACTORING COMPLETE**: 217 of 222 endpoints (98%) migrated to 19 modular files. Only 5 utility routes remain (root, AI, seed).
- `/app/frontend/src/pages/ContentManagement.jsx` - Over 1500 lines, needs component decomposition
