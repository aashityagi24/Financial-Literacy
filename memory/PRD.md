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

### Recent Updates (February 5, 2026)

**Session 10 - Quest Data Isolation & Shopping List & Admin Store Bug Fixes:**

1. **Quest Filtering Bug Fixed** ✅ (P0 BUG FIX)
   - **Issue**: New children were seeing quests and chores from other parents/teachers not linked to them
   - **Root Cause**: The query used `is_active: True` which returned ALL active quests without proper filtering
   - **Backend Fix** (`/app/backend/routes/child.py` lines 881-960):
     - **Admin quests**: Now filtered by `min_grade`/`max_grade` matching child's grade
     - **Teacher quests**: Now filtered by `classroom_id` in child's enrolled classrooms (via `classroom_students` collection)
     - **Parent chores**: Now filtered by `child_id` matching the current user (via `parent_child_links` collection)
   - **Result**: Children now only see quests meant for them:
     - Admin quests for their grade range
     - Teacher quests from classrooms they're enrolled in
     - Parent chores assigned specifically to them
   - **Data Isolation**: New children without parent links or classroom enrollments no longer see unrelated content

2. **Parent Shopping List Bug Fixed** ✅ (P0 BUG FIX)
   - **Issue**: Parents could add items from store but: (1) List wasn't visible, (2) Chores weren't visible to children
   - **Root Causes**:
     - POST `/shopping-list` wasn't saving item details (item_name, price, image_url)
     - GET `/shopping-list` returned flat array instead of grouped by child
     - `/create-chore` saved to wrong collection (`parent_chores` instead of `new_quests`)
   - **Backend Fix** (`/app/backend/routes/parent.py` lines 538-690):
     - POST now fetches full item details from `admin_store_items` collection
     - GET now returns `[{child_id, items: [...]}]` grouped structure
     - create-chore now saves to `new_quests` collection with `child_id` for visibility
   - **Result**: Full shopping list workflow now works:
     - Parents can add items and see them in the list
     - Parents can create chores from selected items
     - Children see shopping chores in their Quest Board

3. **Admin Store Management Bug Fixed** ✅ (P0 BUG FIX)
   - **Issue**: Items uploaded by admin weren't shown in Admin Store Management page; random old items displayed instead
   - **Root Cause**: Admin endpoints used `store_items` collection but store page used `admin_store_items` collection
   - **Backend Fix** (`/app/backend/routes/admin.py` lines 451-504):
     - Changed all CRUD operations from `store_items` to `admin_store_items`
     - GET, POST, PUT, DELETE now all use correct collection
   - **Result**: Admin Store Management now shows correct items that match what children see in the store

### Recent Updates (January 31, 2026)

**Session 9 - Video Walkthrough Feature:**

1. **Video Walkthrough Section Implemented** ✅ (P0 NEW FEATURE)
   - **Landing Page Enhancement**: Added a new video section between "Features" and "Grade Levels" sections
   - **Conditional Rendering**: Video section only appears when an admin has uploaded a walkthrough video
   - **Backend Changes** (`/app/backend/routes/admin.py`):
     - GET `/api/admin/settings/walkthrough-video` - Public endpoint to fetch video settings
     - PUT `/api/admin/settings/walkthrough-video` - Admin-only endpoint to update video URL, title, and description
     - DELETE `/api/admin/settings/walkthrough-video` - Admin-only endpoint to remove video
   - **Backend Changes** (`/app/backend/routes/uploads.py`):
     - POST `/api/upload/walkthrough-video` - Handles video file upload (MP4, WebM, MOV, max 100MB)
   - **Frontend AdminVideoManagement.jsx (NEW)**:
     - Video preview section with playback controls
     - File upload with drag-and-drop style interface
     - Title and description editing
     - Save settings and delete video functionality
   - **Frontend AdminPage.jsx**:
     - Added "Walkthrough Video" management card in the admin dashboard grid
   - **Frontend LandingPage.jsx**:
     - Conditional video section with responsive design
     - Video highlight badges (Interactive Demos, Real Features, Fun Learning)
   - **Database**: Uses `site_settings` collection with key `walkthrough_video`

### Recent Updates (January 29, 2026)

**Session 8 - Expired Quest Logic & Streak Rewards:**

1. **Expired Quest Logic Implemented** ✅ (P0 NEW FEATURE)
   - Quests past their due date (11:59 PM IST) are now automatically marked as "expired"
   - **Backend Changes** (`/app/backend/routes/child.py`):
     - Added `is_quest_expired()` function using IST timezone (Asia/Kolkata)
     - Quests get `user_status='expired'` and `is_expired=true` when due_date has passed
     - Fixed sorting bug with mixed datetime/string `created_at` fields
   - **Frontend QuestsPage Changes**:
     - Expired quests shown with gray background, grayscale filter, `cursor-not-allowed`
     - "EXPIRED" badge with XCircle icon displayed
     - Shows "(Missed)" next to reward amount
     - Shows "Expired [date]" instead of "days left"
     - Quest order: Active → Expired → Completed
   - **Frontend Dashboard Changes**:
     - Expired quests filtered out of "Active Quests" section
   - **Child Behavior**: Cannot click/access expired quests, no reward given

2. **Daily Streak Rewards Fixed** ✅ (BUG FIX)
   - **Issue**: Streak counting was working but rewards were not being given correctly
   - **Fixed Logic** (`/app/backend/routes/achievements.py`):
     - Daily login: ₹5 reward
     - Every 5th day (5, 10, 15, 20...): ₹10 instead of ₹5
     - **Max reward capped at ₹20**
   - **Backend Changes**:
     - Fixed response field from `bonus` to `reward` (frontend expected `reward`)
     - Added transaction recording for streak rewards (appears in wallet recent activity)
     - Added descriptive message for 5-day bonus milestones
   - **Frontend Dashboard Changes**:
     - Enhanced streak modal with special styling for 5-day milestones
     - Shows "5-Day Milestone Bonus!" message with 🎉 emoji on special days

3. **Dashboard Header Balance Fixed** ✅ (BUG FIX)
   - **Issue**: Wallet icon in header showed ₹0 even when jars had balance
   - **Root Cause**: Backend returned `total_available` but frontend used `total_balance`
   - **Fix**: Backend now returns `total_balance` field with sum of all available (unallocated) balances

4. **Badge System Implemented** ✅ (NEW FEATURE)
   - Created 13 cute "First Time" achievement badges:
     - 🛒 First Shopper (first store purchase)
     - 🔄 Money Mover (first jar transfer)
     - ⭐ Quest Champion (first quest completion)
     - 💝 Generous Heart (first gift given)
     - 🎁 Gift Getter (first gift received)
     - 📈 Stock Star (first stock investment)
     - 🌱 Green Thumb (first garden planting)
     - 💰 Profit Pro (first stock profit)
     - 🌻 Harvest Hero (first garden profit)
     - 📚 Learning Starter (first activity completed)
     - 🎯 Goal Setter (first savings goal created)
     - 🐷 Saver Starter (first savings contribution)
     - 🏆 Dream Achiever (first savings goal achieved)
   - Dashboard "My Badges" section now shows 8 badges (4x2 grid)
   - Earned badges shown in color, unearned badges grayed out
   - Hover shows badge name and description
   - Badge awarding integrated into all relevant routes
   - Each badge awards bonus coins (₹5-20) when earned

**Session 7 - Onboarding & UX Improvements:**

1. **First-Time User Onboarding Tour** ✅ (NEW FEATURE)
   - Guided walkthrough for first-time **child and parent** users
   - **Child Tour (7 steps)**: Welcome, Money Jars, Quests, Store, Investments, Achievements, Learning
   - **Parent Tour (6 steps)**: Welcome, Connect with Child, Chores & Rewards, Allowances, Give Money, Track Progress
   - Colorful animated modals with progress dots and navigation
   - Skip or complete to mark onboarding done (stored in user document)
   - Does NOT show for teachers, admins, or school roles

2. **School Dashboard - Teachers Table Enhanced** ✅
   - Added **Class** and **Grade** columns to Teachers tab
   - Shows teacher's assigned classroom name and grade level

3. **Stock Market - Market Hours Updated** ✅
   - Changed to **7:00 AM - 5:00 PM IST** (was 9:15 AM - 3:30 PM)
   - Children can now trade before/after school
   - Money Garden already had correct hours

4. **Avatar Fixes** ✅
   - Fixed broken placeholder images across Classmates, Dashboard, Parent Shopping List
   - Now shows user initials with colored background when no picture available

5. **Dashboard Active Quests Fixed** ✅
   - Dashboard now correctly fetches from `/child/quests-new` endpoint
   - Active quests now display properly on home dashboard

### Recent Updates (January 28, 2026)

**Session 6 - Recent Activity & Wallet Clarity Enhancements:**

1. **Child Wallet Page - Recent Activity Fixed** ✅ (P0 BUG FIX)
   - Transactions now sorted **newest first** (Jan 28 before Jan 27)
   - Fixed by adding frontend JavaScript sorting to handle mixed date formats in database
   - Added **pagination** (15 items per page)
   - Added **date filters** (All, Today, Week, Month)
   - Each transaction now shows date AND time

2. **Wallet Balance Clarity - Available vs Allocated** ✅ (UX IMPROVEMENT)
   - **Dashboard**: Shows only "Available" balance for Savings & Investing jars with label
   - **Wallet Page**: Shows full breakdown:
     - Savings: "Available" (unallocated) + "In Goals" (allocated to savings goals)
     - Investing: "Available" (cash ready to invest) + "Invested" (portfolio value)
   - Spending & Gifting jars: Show regular balance (no allocation concept)
   - Backend calculates: savings_allocated from goals, investing_allocated from holdings

3. **Total Balance Logic Fixed** ✅ (BUG FIX)
   - Changed from "Total Balance" to **"Money You Can Spend"**
   - Now shows only sum of **available balances** across all jars
   - Prevents children from thinking they have more money than they can actually use
   - Example: Spending ₹49 + Savings available ₹0 + Investing available ₹0 + Gifting ₹0 = ₹49

4. **Child-Friendly Font Sizes** ✅ (UX IMPROVEMENT)
   - Increased font sizes for Savings/Investing jar details
   - Labels: text-lg (larger), Amounts: text-2xl (extra large)
   - Easy for children to read Available/Allocated breakdown

5. **Parent Dashboard - Child Insights Modal Enhanced** ✅
   - Quick view now shows exactly **7 transactions** (was 5)
   - Added "View All" button to open full transactions modal
   - Transactions sorted newest first

6. **Full Transactions Modal (NEW)** ✅
   - Pagination with **15 transactions per page**
   - **Date Filters**: All Time, Today, This Week, This Month

**Session 5 - Stock Market & Notifications Complete:**

1. **Stock/Investment System Fully Working** ✅
   - Wallet Transfer: Fixed default values for `transaction_type` and `description`
   - Stock Detail: Fixed to look in `investment_stocks` first, then `admin_stocks`
   - Buy/Sell: Correctly updates investing account balance
   - Admin: Create/update/delete stocks, categories, and news all working
   - Market Hours: 9AM-4PM IST enforced
   - Daily Fluctuation: Scheduled at 7:15 AM, 12 PM, 4:30 PM IST

2. **Notifications System Enhanced** ✅
   - Polling reduced from 30s to 10s for more real-time feel
   - Added notifications for chore creation
   - Added notifications for chore approval
   - Existing notifications for quests, announcements, rewards, penalties all working

3. **Child Dashboard** ✅
   - Shows 2 active quests (live and not completed)
   - Quest filtering working correctly

### Previous Session Updates (January 27, 2026)

**Session 4 Bug Fixes:**

1. **Stock Market Page Fixed for Grade 3+ Users** ✅ (P0 BUG FIX)
   - Root Cause: Frontend data structure mismatch - StockMarketPage.jsx expected `portfolio.summary.total_invested` but API returns `portfolio.total_invested`
   - Fixed portfolio state initialization and data access in StockMarketPage.jsx
   - Stock Market now loads correctly showing 20 stocks with trading balance, risk levels, and buy buttons
   - Grade 3-5 users can now access the full stock market experience

**Session 3 Bug Fixes & Feature Enhancements:**

1. **Join Classroom Fixed** ✅
   - Fixed ObjectId serialization error
   - Fixed join_code/invite_code mismatch
   - Returns teacher info in response

2. **Single Classroom Constraint** ✅
   - Children can only be enrolled in ONE classroom

3. **Quest Answer Feedback** ✅ (NEW)
   - Correct answers: Green checkmark with "Amazing! +₹X" and "Great job! 🎉"
   - Incorrect answers: Red X with "Not quite right" and "Keep learning! 📚"
   - Shows correct answer in green, user's wrong answer in light red
   - MCQ shows radio buttons, multi-select shows checkboxes with highlighting

4. **Quest Filter Tabs Fixed** ✅ (NEW)
   - All, Admin, Teacher, Chores tabs now work
   - Backend filters by `creator_type` (admin/teacher/parent)
   - Source parameter in GET /api/child/quests-new

5. **Wallet Recent Activities** ✅ (NEW)
   - Shows all transaction types: quest_reward, chore_reward, lesson_reward, allowance, gifts, penalties
   - Icons: 🏆 (quest), ✅ (chore), 📚 (lesson), 💵 (allowance), 💝 (gift sent), 🎁 (gift received), ⚠️ (penalty)

6. **User Deletion (Admin)** ✅ (NEW)
   - Complete cascading delete from 20+ collections
   - Removes: users, wallets, transactions, notifications, sessions, achievements, investments, etc.
   - Role-specific cleanup (teacher classrooms, parent chores)

7. **Quest & Announcement Notifications** ✅
   - Admin/teacher quests send notifications to children
   - Teacher announcements send notifications to classroom students

8. **Default Avatars** ✅
   - Role-based SVG avatars (Child=Yellow, Parent=Green, Teacher=Blue)

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

### Site Settings
- GET /api/admin/settings/walkthrough-video - Public endpoint for landing page video
- PUT /api/admin/settings/walkthrough-video - Admin-only update video settings  
- DELETE /api/admin/settings/walkthrough-video - Admin-only delete video

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

### P0 - Completed
- [x] Video Walkthrough Section ✅ (Completed Jan 31, 2026)

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
