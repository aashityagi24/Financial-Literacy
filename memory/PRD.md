# CoinQuest - Financial Literacy Learning App for Children

## Original Problem Statement
A gamified financial literacy learning application for children (K-5) with distinct user roles (Teacher, Parent, Child, Admin). Features include a digital wallet, virtual store, gamified investment modules (Money Garden & Stock Market), dynamic quests, achievements, and hierarchical content system. Currency: Indian Rupees (₹).

## What's Been Implemented

### Core MVP ✅
- User authentication (Custom Google OAuth + Admin login + School login)
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
- **Grade visibility controls** for plants (Admin can set min/max grade per plant)
- **All sections on one page**: My Money Jar, The Market, My Garden, My Shop
- **Malli the Gardener** - floating mascot (bottom-right) with contextual tips
- **First-time intro** - Malli introduces himself and explains each section in simple language
- **Whole numbers only** - no decimals, percentages, or fractions
- **Child-friendly terminology** - "earnings" instead of "profit"

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

### Recent Updates (February 20, 2026)

**Session 17 - Teacher Repository & Quest Answer Bugs:**

1. **MCQ Answer Validation Bug Fixed** ✅ (P0 BUG FIX)
   - **Issue**: Child's correct MCQ answer marked wrong - user submits option text (e.g., "Wallet") but correct_answer stored as letter (e.g., "C")
   - **Root Cause**: Direct string comparison `user_answer == correct_answer` failed because formats differ
   - **Fix Applied** (`/app/backend/routes/quests.py` lines 319-371):
     - Added `is_answer_correct()` helper function that handles all question types:
       - **MCQ**: Converts letter (A,B,C,D) to option index, compares with user's option text
       - **Multi-select**: Converts letter array to option texts array, compares sorted lists
       - **True/False**: Case-insensitive string comparison
       - **Number Entry**: Float comparison with string fallback
   - **Testing**: 8/8 question type validation tests pass
   - **Result**: All answer types now validate correctly

2. **Repository Grade Filtering for Teachers** ✅ (P0 BUG FIX)
   - **Issue**: Teachers saw all repository resources regardless of classroom grade
   - **Root Cause**: Frontend wasn't passing grade parameter to API
   - **Fix Applied** (`/app/frontend/src/pages/TeacherDashboard.jsx`):
     - Modified `fetchRepository()` to include `grade=${classroomDetails.classroom.grade_level}`
   - **Result**: Teachers only see resources tagged for their current classroom's grade

3. **Create Quest UX Improvements** ✅
   - Removed classroom dropdown (auto-selected based on current classroom)
   - Shows info banner: "Creating quest for: [Classroom Name] ([Grade])"
   - Fixed due date validation to give clearer error messages

4. **Teacher Repository Upload Bug Fixed** ✅ (P0 BUG FIX)
   - Admin "Invalid doc type" error when uploading - fixed with extension-based validation
   - MongoDB ObjectId serialization error - fixed by removing `_id` before response

5. **Teacher Repository Picker Click Bug Fixed** ✅ (P0 BUG FIX)
   - Repository picker clicks being intercepted by Radix Dialog - fixed using React Portal

**Files Modified:**
- `/app/backend/routes/quests.py` (added is_answer_correct() helper function)
- `/app/backend/routes/repository.py` (upload validation fix)
- `/app/frontend/src/pages/TeacherDashboard.jsx` (repository picker, grade filtering, quest form improvements)
- `/app/backend/tests/test_mcq_answer_validation.py` (new - comprehensive test file)

**Session 16 - Money Garden UI Refinements:**

1. **Removed % from Growth Stage** ✅
   - Simplified stage display from "Stage: Seed (0%)" to just "Stage: Seed"
   - Cleaner and less confusing for young children

2. **Swapped Layout Positions** ✅
   - The Market moved to bottom-left
   - My Shop moved to bottom-right
   - Better workflow: Buy seeds (left) → Plant → Harvest → Sell (right)

3. **Expanded Recent Activity Section** ✅
   - Now uses flex-1 to fill remaining wallet section space
   - Displays up to 8 transactions (was 4)
   - Larger text and better spacing for readability

**Files Modified:**
- `/app/frontend/src/pages/MoneyGardenPage.jsx` (layout swap, activity expansion, stage text)

**Session 15 - Money Garden Major Enhancement:**

1. **Gardener Mascot Added** ✅
   - Added friendly gardener character with contextual speech bubbles
   - Messages change based on active section and garden state
   - Guides children through the Money Garden experience

2. **Four-Section Layout** ✅
   - **My Wallet**: View balances and transfer money to Farming jar
   - **My Shop**: Display and sell harvested crops (renamed from "Harvest Basket")
   - **My Garden**: Plant and water seeds, harvest ready crops
   - **The Market**: Browse and buy seeds to plant

3. **Removed "Profit" Terminology** ✅
   - Replaced all instances of "profit" with "earnings" or "can earn"
   - Updated achievement descriptions to be child-friendly
   - No financial jargon that kids might not understand

4. **Admin Grade Visibility for Plants** ✅
   - Plants now have `min_grade` and `max_grade` fields
   - Admin can configure which grades see which plants
   - Backend filters seeds based on child's grade

5. **Whole Numbers Only** ✅
   - All prices, costs, and earnings display as whole numbers
   - No decimals, percentages, or fractions shown
   - Using `Math.round()` throughout the UI

**Files Modified:**
- `/app/frontend/src/pages/MoneyGardenPage.jsx` (complete rewrite)
- `/app/frontend/src/pages/AdminGardenManagement.jsx` (added grade controls)
- `/app/backend/routes/garden.py` (grade filtering, ObjectId fix)
- `/app/backend/routes/admin.py` (updated plant management)
- `/app/backend/routes/achievements.py` (removed "profit" from descriptions)

### Recent Updates (February 19, 2026)

**Session 14 - Profile School Name Display & Content Modal ExternalLink Fixes:**

1. **School Name Display on Child Profile Fixed** ✅ (P1 BUG FIX)
   - **Issue**: Child's "My Connections" section showed classroom and teacher info, but not the school name
   - **Root Cause**: The `GET /api/student/classrooms` endpoint didn't include school lookup
   - **Backend Fix** (`/app/backend/routes/student.py` lines 100-113):
     - Added teacher `school_id` to the query projection
     - Added school lookup when teacher has `school_id`
     - Response now includes `school_name` and `school_id` fields
   - **Frontend Fix** (`/app/frontend/src/pages/ProfilePage.jsx` lines 335-338):
     - Added conditional display of school name with School icon when `classroom.school_name` exists
   - **Testing**: Verified by testing agent (iteration_51) with test data creation

2. **Open in New Tab Icon for Teachers/Parents Fixed** ✅ (P2 BUG FIX)
   - **Issue**: "Open in new tab" (ExternalLink) icon was missing for parents/teachers when viewing worksheets/workbooks with PDF
   - **Root Cause**: Only activities and books had the ExternalLink button; worksheets/workbooks only had Download
   - **Frontend Fix** (`/app/frontend/src/pages/TopicPage.jsx` lines 458-469):
     - Added ExternalLink icon for worksheets/workbooks with PDF
     - Conditionally rendered only for non-child users (`user?.role !== 'child'`)
     - Download icon still available for all users
   - **Testing**: Verified by testing agent (iteration_51)
   - **Result**: Teachers and parents can now open PDFs in a new tab; children still see only download

3. **Google OAuth Redirect Path Bug Fixed** ✅ (P0 BUG FIX)
   - **Issue**: After Google sign-in, users were redirected to `/login/auth/callback` instead of `/auth/callback`, causing a blank screen
   - **Root Cause**: The `state` parameter in Google OAuth stored the full referer URL including the `/login` path, which was then appended to when constructing the callback redirect
   - **Backend Fix** (`/app/backend/routes/auth.py` lines 254-259, 401-407):
     - Fixed state encoding to only use the URL origin (scheme + host), not the full path
     - Added URL parsing in callback handler to extract only the origin from state
   - **Testing**: Verified with screenshot tests - OAuth now correctly redirects to `/auth/callback`
   - **Result**: All Google SSO sign-ins now work correctly for all user types

### Recent Updates (February 16, 2026)

**Session 13 - Grade Filtering Bug Fix & Word Bank/Glossary Feature:**

1. **Grade Filtering Bug Fixed** ✅ (P0 BUG FIX - RECURRING)
   - **Issue**: When teachers/parents selected a specific grade to view learning content, the grade filter was lost when navigating to subtopics
   - **Root Cause**: `TopicPage.jsx` line 264 was not passing the `gradeFilter` query parameter when creating the Link to subtopics
   - **Fix Applied**: Changed `to={/learn/topic/${subtopic.topic_id}}` to `to={/learn/topic/${subtopic.topic_id}${gradeFilter ? ?grade=${gradeFilter} : }}`
   - **Testing**: All 8 backend tests and frontend UI flows verified by testing agent (iteration_49)
   - **Result**: Grade filter now properly preserved throughout the entire navigation flow

2. **Word Bank/Glossary Feature** ✅ (P0 NEW FEATURE)
   - **Description**: A searchable glossary of financial literacy terms for all users
   - **Backend APIs** (`/app/backend/routes/glossary.py`):
     - GET `/api/glossary/words` - List all words with search, letter, category, grade filters
     - GET `/api/glossary/words/{word_id}` - Get single word
     - GET `/api/glossary/word-of-day` - Random word of the day based on user's grade
     - POST `/api/admin/glossary/words` - Create word (admin only)
     - PUT `/api/admin/glossary/words/{word_id}` - Update word (admin only)
     - DELETE `/api/admin/glossary/words/{word_id}` - Delete word (admin only)
     - POST `/api/admin/glossary/bulk-import` - Bulk import words from JSON
   - **Frontend Pages**:
     - `/app/frontend/src/pages/AdminGlossaryManagement.jsx` - Admin CRUD interface
     - `/app/frontend/src/pages/GlossaryPage.jsx` - User-facing glossary with alphabet navigation
   - **Features**:
     - Word of the Day section with daily rotating term
     - Alphabetical navigation (clickable letter buttons)
     - Category filtering (saving, spending, earning, investing, etc.)
     - Search functionality
     - Grade-level filtering
     - Expandable word cards with examples
   - **Navigation**: Added "Words" nav item to child dashboard, "Word Bank/Glossary" card to admin dashboard
   - **Testing**: All 19 backend tests and frontend UI flows verified by testing agent (iteration_50)
   - **Database Collection**: `glossary_words` with fields: word_id, term, first_letter, meaning, description, examples[], image_url, category, min_grade, max_grade, created_at, updated_at

### Recent Updates (February 9, 2026)

**Session 11 - Lending & Borrowing Feature Complete:**

1. **Parent Dashboard Lending Section Complete** ✅ (P0 FEATURE)
   - **Description**: Parents can now manage loan requests from their children (grades 4-5)
   - **Features Implemented**:
     - Loan Request Display: Shows incoming loan requests with borrower info, amount, interest, purpose, return date
     - Accept Action: Parent can approve loan - money transferred from wallet to child's spending jar
     - Reject Action: Parent can decline loan with optional reason - child notified
     - Counter-Offer Action: Parent can propose different terms (amount, interest, return date)
   - **Frontend Changes** (`/app/frontend/src/pages/ParentDashboard.jsx`):
     - Added Loan Response Dialog with three action modes (accept, reject, counter)
     - Dialog shows loan details summary, borrower credit score
     - Accept shows money transfer confirmation
     - Counter-offer form with validation
   - **Bug Fixed** (`/app/backend/routes/lending.py`):
     - Fixed datetime comparison bug for date-only return_date format
     - Return dates can now be stored as "YYYY-MM-DD" or full ISO datetime
   - **Result**: Complete parent-child lending loop is now functional

2. **Lending Feature Summary** ✅
   - **Backend APIs** (`/app/backend/routes/lending.py`):
     - POST `/api/lending/request` - Create loan request to parents/classmates
     - POST `/api/lending/requests/{id}/respond` - Accept/Reject/Counter
     - GET `/api/lending/requests/received` - Get incoming requests
     - GET `/api/lending/loans/borrowing` - Child's borrowed loans with days_until_due
     - GET `/api/lending/parent/child-loans/{id}` - Parent views child's loan activity
   - **Credit Score System**: 0-100 score based on on-time payments, late payments, defaults
   - **Grade Restriction**: Feature only for grades 4-5 (locked for K-3)
   - **Loan Limits**: ₹2000 from parents, ₹500 from classmates
   - **Notifications**: In-app alerts for loan events (request, approval, due dates, overdue)

### Recent Updates (February 5, 2026)

**Session 10 - Quest Data Isolation, Shopping List, Admin Store & Shopping Chore Enhancement Fixes:**

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

4. **Shopping Chore Checklist & Purchase History Feature** ✅ (P0 ENHANCEMENT)
   - **Issue**: Shopping chore items weren't shown as a checklist in child's store; no way for parents to see purchase history
   - **Backend Enhancements**:
     - `create-chore` now adds `is_shopping_chore: true` flag and `shopping_item_details` array with full item info
     - Added `GET /api/parent/children-purchases` - Returns grouped purchase history for all linked children
     - Store purchase auto-marks shopping items as purchased in ALL matching chores (bug fix by testing agent)
     - Added `store_purchases` collection to track purchases with `from_shopping_chore` flag
   - **Frontend Enhancements**:
     - Child's store shows "Your Shopping List" checklist section with items from active shopping chores
     - Items auto-check off when purchased
     - Parent dashboard now has "Children's Purchases" button and dialog showing purchase history grouped by child
     - Purchases from shopping chores highlighted with "From Chore" badge
   - **Result**: Complete shopping workflow visibility for both children and parents

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
- [x] Grade Filtering Bug Fix ✅ (Completed Feb 16, 2026)
- [x] Word Bank/Glossary Feature ✅ (Completed Feb 16, 2026)

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

### Session 11 Updates (February 8, 2026)

**Google OAuth Bug Fix** ✅

1. **Custom Google OAuth Flow Fixed** (P0 BUG FIX)
   - **Issue**: The primary authentication method (Google Sign-In) was non-functional after implementing custom OAuth
   - **Root Cause**: Frontend had an incorrect `/auth/google/callback` route that was intercepting backend OAuth callbacks
   - **Fix Applied**:
     - Removed incorrect `/auth/google/callback` frontend route from `App.js`
     - Simplified `AuthCallback.jsx` to only handle `session` query parameter from backend
     - Backend flow confirmed working: `/api/auth/google/login` → Google → `/api/auth/google/callback` → `/auth/callback?session=TOKEN`
   - **Testing**: All endpoints verified working by testing agent (iteration_47)
   - **User Action Required**: Register redirect URI in Google Cloud Console (see below)

**Google Cloud Console Configuration**:
To complete the OAuth setup, add these redirect URIs to your Google Cloud Console OAuth 2.0 credentials:
- For Preview: `https://coin-quest-preview.preview.emergentagent.com/api/auth/google/callback`
- For Production: `https://coinquest.co.in/api/auth/google/callback`

### Session 12 Updates (February 9, 2026)

**Lending & Borrowing Feature** ✅ (Grade 4-5 Only)

A comprehensive peer-to-peer and parent-to-child lending system for financial literacy education.

**Core Features:**
1. **Loan Request System**
   - Children can request loans from parents (max ₹2000) or classmates (max ₹500)
   - Specify: amount, purpose, return date, interest offered
   - Can send same request to multiple recipients for comparison

2. **Response Options**
   - Accept: Send money immediately
   - Reject: Decline the request  
   - Counter-offer: Propose different terms

3. **Credit Score (0-100)**
   - Calculated based on repayment history
   - On-time payments increase score
   - Late payments and defaults decrease score
   - Visible to potential lenders before decision

4. **Loan Limits**
   - Max 5 ongoing debts at a time
   - No limit on requests or past loans
   - Amounts capped by recipient type

5. **Bad Debt Handling**
   - Loans overdue 7+ days marked as bad debt
   - Credit score impact
   - Parent notification

**Dashboard Integration:**
- Lending Center banner replaces AI Buddy for grades 4-5
- Navigation shows "Lending" instead of "AI Buddy" for grades 4-5
- Landing page features section updated

**Files Created/Modified:**
- `/app/backend/routes/lending.py` - New file (850+ lines)
- `/app/frontend/src/pages/LendingBorrowingPage.jsx` - New file (700+ lines)
- `/app/frontend/src/App.js` - Added route
- `/app/frontend/src/pages/Dashboard.jsx` - Conditional Lending banner
- `/app/frontend/src/pages/LandingPage.jsx` - Added Lending feature card

**API Endpoints:**
- GET /api/lending/eligibility
- GET /api/lending/credit-score
- GET /api/lending/limits
- GET /api/lending/summary
- POST /api/lending/request
- GET /api/lending/requests/sent
- GET /api/lending/requests/received
- POST /api/lending/requests/{id}/respond
- POST /api/lending/requests/{id}/accept-counter
- POST /api/lending/requests/{id}/withdraw
- GET /api/lending/loans/borrowing
- GET /api/lending/loans/lending
- POST /api/lending/loans/{id}/repay
- GET /api/lending/classmates
- GET /api/lending/parents
- GET /api/lending/parent/child-loans/{child_id}

### Session 18 Updates (February 21, 2026)

**Glossary Search Fix Verified** ✅

1. **Glossary Search - Title Only** ✅ (P0 FIX VERIFICATION)
   - **Requirement**: User requested that glossary search only query the term/title field, not the meaning or description
   - **Implementation**: Modified MongoDB query in `/app/backend/routes/glossary.py` to use `{"term": {"$regex": search, "$options": "i"}}` instead of `$or` with meaning
   - **Verification Tests Passed**:
     - ✅ Search "Budget" → Found 1 word (term match)
     - ✅ Search "wealth" → Found 0 words (only in description, correctly excluded)
     - ✅ Search "valuable" → Found 0 words (only in meaning of "Asset", correctly excluded)
     - ✅ Search "Savings" → Found 1 word (term match)
     - ✅ Search "sav" → Found 1 word (partial term match works)
   - **Result**: Search now correctly queries only the term field as requested

**Files Verified:**
- `/app/backend/routes/glossary.py` - Search logic confirmed working (line 40)

**Known Issue (User Action Required):**
- **Badge Images Missing**: User-uploaded badge images were lost in a previous session. Admin must manually re-upload images via Admin Panel → Badge Management.

**Grade Selection Hidden (3rd-5th Grade)** ✅
- **Requirement**: Hide grades 3-5 from user-facing pages
- **Changes Made**:
  1. **LandingPage.jsx**: Reduced grade tabs from 6 (K-5) to 3 (K-2)
  2. **LandingPage.jsx**: Updated hero text from "K-5 kids" to "K-2 kids"
  3. **ProfilePage.jsx**: Reduced grade selection dropdown from 6 options to 3 (K, 1st, 2nd)
- **Result**: Users can only see and select Kindergarten, 1st Grade, or 2nd Grade

### Session Update (February 2026 - Fork)

#### Fixed: equation-relation-quiz.html
- User had broken their HTML activity file by pasting agent instructions (including raw English text) inside JavaScript code
- Created corrected version at `/app/equation-relation-quiz-fixed.html`
- Properly integrated `postMessage` score reporting at the end of `finishQuiz()` function
- Removed the placeholder script with hardcoded values and non-existent `submitBtn`

#### Bugfix: Score Display & Completion UX (March 16, 2026)
- Changed ChildActivityScore badge from percentage (20%) to actual score format (2/10)
- Fixed "Completed! +₹undefined" → `response.data.coins_awarded` (was `response.data.reward`)
- Fixed `selectedContent.completed` → `selectedContent.is_completed` (property name mismatch)
- Consolidated double toast into single combined toast on activity completion

### Session Update (March 17, 2026 - Fork)

#### Feature: My Jobs - Complete Implementation ✅ (P0)
- **Child UI** (`MyJobsPage.jsx`): Children can view, add, and delete family jobs (unpaid) and payday jobs (paid), max 3 each. Jobs show status badges (Approved, Waiting, Not Approved) and payment amounts. Guide button shows admin-configurable guidebook.
- **Parent UI** (`ParentDashboard.jsx`): New "Children's Jobs" section shows pending jobs requiring approval and active approved jobs. Parents can:
  - Approve family jobs with one click
  - Set payment details (amount, digital/cash, review day) for payday jobs via dialog
  - Reject jobs (sends notification to child)
  - Pay weekly for approved payday jobs (digital transfers to child's wallet)
- **Admin UI** (`AdminPage.jsx`): New "Jobs Guide" tab with textarea editors for child and parent guidebook content.
- **Backend** (`jobs.py`): Complete API with child CRUD, parent approve/reject/pay, admin guidebook, and teacher view endpoints. Payment creates wallet transactions and notifications.
- **Testing**: 14/14 backend tests passed, all frontend UI verified.

**Files Modified:**
- `/app/backend/routes/jobs.py` - Added reject endpoint, allow deleting rejected jobs
- `/app/frontend/src/pages/MyJobsPage.jsx` - Added rejected status badge/delete support
- `/app/frontend/src/pages/ParentDashboard.jsx` - Added complete jobs management section
- `/app/frontend/src/pages/AdminPage.jsx` - Added guidebook management tab

#### Bugfix: Repository Access Control - Frontend Enforcement ✅ (P0, March 17, 2026)
- **Issue**: "Select from Repository" buttons were always visible to teachers in the quest creation form, even when their school's repository access was disabled by admin.
- **Fix** (`TeacherDashboard.jsx`):
  - Added `hasRepoAccess` state variable (default `false`)
  - Added API call to `/api/teacher/repository/access-check` on component mount
  - Wrapped both "Select from Repository" buttons (image & PDF) in `{hasRepoAccess && (...)}` conditional renders
- **Result**: Teachers at schools without repository access no longer see the repository buttons in the quest creation form.

**Files Modified:**
- `/app/frontend/src/pages/TeacherDashboard.jsx` - Added repository access check and conditional rendering

#### Feature: Razorpay Subscription System ✅ (P0, March 17, 2026)
- **Backend** (`/app/backend/routes/subscriptions.py`):
  - Plan pricing API: configurable plans (Single Parent / Two Parents) x 4 durations (1 Day, 1 Month, 6 Months, 1 Year)
  - Razorpay order creation with amount calculation (base + per-child pricing)
  - Payment signature verification and subscription activation
  - Email-based subscription access check
  - Admin: list subscriptions, update plan pricing, toggle subscription active status
- **Frontend**:
  - `PricingSection.jsx`: Interactive pricing cards on homepage with plan type toggle, children selector (1-5), duration cards, checkout dialog with Razorpay integration
  - `AdminSubscriptionManagement.jsx`: Admin page for viewing subscriptions (search, stats, toggle), configuring plan pricing
  - Subscription access gate in `ProtectedRoute` — users without active subscription redirected to pricing
- **Pricing defaults**: Single Parent ₹500/month base, Two Parents ₹700/month base, +₹200/additional child
- **Testing**: 13/13 backend tests passed, all frontend UI verified
- **Razorpay keys**: Test mode configured (rzp_test_SSGIAk3wJBTtJl)

**Files Created/Modified:**
- `/app/backend/routes/subscriptions.py` (NEW) - All subscription + payment endpoints
- `/app/frontend/src/components/PricingSection.jsx` (NEW) - Homepage pricing section
- `/app/frontend/src/pages/AdminSubscriptionManagement.jsx` (NEW) - Admin subscription management
- `/app/backend/server.py` - Registered subscription routes
- `/app/backend/.env` - Added RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
- `/app/frontend/.env` - Added REACT_APP_RAZORPAY_KEY_ID
- `/app/frontend/src/App.js` - Added subscription route, subscription check in ProtectedRoute
- `/app/frontend/src/pages/LandingPage.jsx` - Added PricingSection, updated CTAs
- `/app/frontend/src/pages/AdminPage.jsx` - Added Subscriptions management card
- `/app/backend/routes/auth.py` - Added subscription_status to /auth/me response

#### Feature: Chunked File Upload System ✅ (P0, March 18, 2026)
- **Problem**: Large file uploads (videos, PDFs, images) failed on production server (`coinquest.co.in`) due to proxy/ingress body size limits (~1MB).
- **Solution**: Implemented chunked upload system that splits files into 512KB chunks on the client and reassembles on the server.
- **Backend** (`/app/backend/routes/uploads.py`):
  - `POST /api/upload/chunked/init` - Initialize upload session
  - `POST /api/upload/chunked/part` - Upload individual chunks
  - `POST /api/upload/chunked/complete` - Assemble chunks into final file
  - DEST_MAP routes files to correct subdirectories (video, image, thumbnail, pdf, badge, quest, repository, store, glossary, investment, goal)
- **Frontend** (`/app/frontend/src/utils/chunkedUpload.js`):
  - `uploadFile(file, destType, directEndpoint, onProgress)` utility
  - Files < 512KB use direct upload; larger files use chunked upload
  - Progress callback support for UI feedback
- **Refactored ALL frontend upload points** to use `uploadFile`:
  - AdminStoreManagement.jsx, AdminInvestmentManagement.jsx, AdminGlossaryManagement.jsx
  - AdminBadgeManagement.jsx, AdminVideoManagement.jsx, AdminQuestsPage.jsx
  - AdminTeacherRepository.jsx, ContentManagement.jsx, TeacherDashboard.jsx
  - ProfilePage.jsx, SavingsGoalsPage.jsx
- **Testing**: 20/20 backend tests passed, all frontend pages verified. Test file: `/app/backend/tests/test_chunked_upload.py`

## Pending Issues
- **P1**: Payment failure on live site (coinquest.co.in) - VERIFIED WORKING in preview. Production needs redeployment with latest code and correct .env variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET).
- **P2**: Badge images missing - requires manual re-upload by admin

## Recently Completed
- **Scroll-to-completed content fix** (April 1, 2026)
  - After a child marks an activity/book as done, the viewer closes and the content list scrolls to the just-completed item (using `scrollIntoView` with `block: 'center'`). Previously scrolled to top, forcing child to scroll down to find where they stopped.
  - Added `data-content-id` attributes to content item cards and `lastCompletedRef` to track the last completed content ID.

- **Smoother Activity Completion & Reward Messaging** (April 1, 2026)
  - Silent background refresh after activity score capture: `fetchTopicData(true)` skips the loading spinner, so the content list updates seamlessly without a jarring full-page reload.
  - When child clicks "Done" after reward was already given via score capture: shows "Done! Reward already added to your wallet" instead of confusing "+₹0".
  - Footer shows "✓ Reward in wallet" for already-completed items instead of "+₹X".
  - "Done" button text changes to "Mark Done" for incomplete and "Done" for already-completed items.

- **Subscription Gating & Pricing Popup** (April 1, 2026)
  - **Signup/Login 403 → Pricing Popup**: Instead of just a toast error, the AuthPage now shows a full PricingSection popup when a user tries to sign up or log in without an active subscription. Users can purchase right there without page shuffling.
  - **No Registration Without Subscription**: Fixed Google OAuth gap where user records were created BEFORE subscription check. Now subscription is verified first; user is only created if subscription exists.
  - **Second OAuth Handler Fixed**: The alternative Google OAuth handler had NO subscription check at all — added subscription gating for both new and existing users.
  - Testing: 9/9 backend + all frontend tests passed (iteration_63)

- **Content Move Fix + Gifting→Giving Rename** (April 1, 2026)
  - **Content Move Bug**: The `/admin/content/items/{id}/move` endpoint was commented out in `server.py` with `# MOVED` but never added to `routes/content.py`. Added the endpoint. Content can now be moved between subtopics.
  - **Subtopic Move Bug**: Same issue — `/admin/content/subtopics/{id}/move` endpoint was also missing from `routes/content.py`. Added it. Subtopics can now be moved between parent topics.
  - **Gifting→Giving Rename**: Renamed all user-facing "Gifting" display text to "Giving" across 10+ files. Backend `account_type` key remains `'gifting'` (data model unchanged).

- **HTML Zip Book Rendering Fix for Children** (March 31, 2026)
  - Root cause: Mac OS X `__MACOSX` resource fork files in uploaded zips were being served to children via the `activity-files` endpoint. Admin viewed content via direct URL (bypassing the endpoint), so it worked for them.
  - Fix: (1) Filtered `__MACOSX` and `._` files from `activity-files` endpoint in both server.py locations, (2) Filtered during zip extraction in `uploads.py` and `server.py`, (3) Cleaned up existing `__MACOSX` folders from activities directory.

- **Learn Section Bug Fixes** (March 30, 2026)
  - **Progressive Unlock on Subtopics Page**: Fixed subtopics showing all unlocked on detail page. Backend `get_topic_detail` now computes `is_unlocked`, `is_completed`, `completed_count`, `content_count` for subtopics AND `is_unlocked` for content items. First item always unlocked, rest depend on previous completion.
  - **Fraction Display Removed**: Removed "2/20 Done" badge and "0/6" fraction from topic cards, quick access badges, and subtopic cards. Now shows only clean counts: "3 Subtopics", "20 Items", "6 items".
  - Testing: 9/9 backend + all frontend tests passed (iteration_62)

- **Admin Notifications for System Events** (March 30, 2026)
  - Admins receive real-time notifications for 3 key events:
    1. **New Subscription** (`new_subscription`) - triggered on payment verification, shows plan type, duration, child count, amount
    2. **New Checkout Lead** (`new_checkout_lead`) - triggered when a new lead is captured (not on updates), shows name, plan, children
    3. **New School Enquiry** (`new_school_enquiry`) - triggered on enquiry submission, shows school name, contact person, city
  - `notify_admins` helper function in `backend/routes/notifications.py` sends to all admin users
  - NotificationCenter bell added to Admin Dashboard header with unread count badge
  - Custom icons: CreditCard (subscription), ShoppingCart (lead), School (enquiry)
  - Testing: 11/11 backend + all frontend tests passed (iteration_61)

- **Tiered Child Pricing** (March 20, 2026)
  - Replaced flat per_child_price with tiered child_prices array [2nd, 3rd, 4th, 5th child] — each additional child gets cheaper
  - Pricing cards now show individual child price badges matching the user's design
  - Checkout dialog has children selector (1-5) with itemized breakdown showing each child's price
  - Admin pricing config updated with 4 individual child price inputs + extra_child_per_day rate
  - Backend: Updated DEFAULT_PLANS, calculate_total, get_plan_pricing, create-order, admin plan-config endpoints
  - Testing: 19/19 backend + all frontend tests passed (iteration_60)

- **Linked Users & Renewal Tracking** (March 19, 2026)
  - Eye button on each subscription row opens dialog showing all linked parent and child accounts
  - Backend enriches `/api/subscriptions/admin/list` with `linked_users` array (parent + nested children) and `is_renewal` boolean
  - `is_renewal=true` when subscriber email has >1 completed subscription
  - Amber "Renewed" badge displayed next to "Admin Granted" badge for repeat subscribers
  - Dialog shows Parent (blue badge) and Child (green badge) with names and emails
  - Testing: 10/10 backend + all frontend tests passed
- **School Subscription Enquiry System** (March 19, 2026)
  - "Looking for a School Plan?" CTA banner below pricing cards with "Enquire Now" button
  - Full enquiry form: School Name*, City, Contact Person*, Designation, Phone*, Email*, Grades (K/1/2) - optional fields marked
  - All enquiries stored in `school_enquiries` collection with date and status
  - Admin "Enquiries" tab showing all leads with status tracking (New/Contacted/Converted/Closed)
  - Backend endpoints: `POST /api/admin/school-enquiry` (public), `GET /api/admin/school-enquiries`, `PUT /api/admin/school-enquiries/{id}/status`
- **Checkout Lead Capture** (March 19, 2026)
  - Captures user details when they fill the Buy Now form, even if they don't complete payment
  - Three lead statuses: "Form Closed" (abandoned dialog), "Form Submitted" (clicked Pay but didn't complete), "Converted" (payment success)
  - Converted leads excluded from leads list (shown in subscriptions instead)
  - Status only upgrades, never downgrades (form_closed → form_submitted → converted)
  - Admin "Checkout Leads" tab in Subscription Management
  - Backend endpoints: `POST /api/subscriptions/capture-lead`, `GET /api/subscriptions/admin/checkout-leads`
- **Admin Filters** (March 19, 2026)
  - Subscription Management: Status filter (All/Active/Inactive/Expired/Pending) + date range calendar filter
  - User Management: Date range calendar filter (From/To) alongside existing Role/Grade/School filters
  - Clear Filters button resets all filters at once
- **Multi-User Selection & Bulk Delete** (March 18, 2026)
  - Checkbox selection in admin user management table with select-all
  - "Delete X Selected" button appears when users are selected
  - Safety: prevents admin from deleting their own account
  - Selected rows highlighted with blue background
- **Admin Subscription Management** (March 18, 2026)
  - Admin can view subscription status (Active/Inactive) for all parent/child users in user management table
  - Admin can activate subscriptions with durations: 1 Day, 1 Week, 1 Month
  - Admin can renew or deactivate existing subscriptions
  - Backend endpoint: `PUT /api/admin/users/{user_id}/subscription`
  - Admin-granted subscriptions stored with `granted_by_admin: true` flag
  - CSV bulk upload (students + parents) now supports `subscription` and `subscription_duration` columns for school tie-ups

## Upcoming Tasks
- **P1**: Streak Bonuses & Leaderboards
- **P1**: Safety Guardrails (spending limits, parent approval)
- **P2**: Teacher/Parent Collaboration Portal
- **P2**: Collaborative & Seasonal Events
- **P2**: Email notifications for loan events
- **P2**: Tutorial System for new users
