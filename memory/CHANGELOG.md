# CoinQuest — Changelog

Chronological implementation log. See PRD.md for the static problem statement and ROADMAP.md for pending work.

### Recent Updates (August 24, 2026, hero image)

**Landing page hero — added right-side image** ✅
- `LandingPage.jsx`: hero header restructured to a two-column flex layout (text left, image right on desktop; stacked on mobile). Uses a user-supplied PNG (already background-removed with true alpha transparency) of a girl selling handmade crafts/succulents and counting coins she earned — blends naturally into the gradient hero, no card frame or CSS mask needed.
- Follow-up: cropped the hero PNG's built-in transparent padding (bounding-box crop via PIL, saved to `frontend/public/hero-earner.png`, served as a static asset) — the source file had ~390px of empty transparent margin above the subject, which was making the image (and hero section) far taller than the text content. Also repositioned a decorative floating dot that started overlapping the trust row once the section shrank.
- Follow-up 2 (Aug 24): attempted logo crop to close the nav-to-heading gap, but user found it looked odd — reverted to the original logo asset/sizing (`h-72 -mt-12`). Not pursuing further for now.
- Self-tested via screenshot (desktop + mobile) — hero section is now compact, image height matches the heading/description/button block instead of towering over it.

### Recent Updates (August 24, 2026, bug fix)

**Production-only CSS bug: CTA/card backgrounds not applying on deployed build** ✅ FIXED
- Root cause: `.card-playful`, `.btn-primary/secondary/accent`, `.panel-cyan`, `.input-playful`, `.account-*`, `.progress-bar/fill`, `.nav-item-active` in `index.css` were plain global rules positioned after `@tailwind utilities;` but not wrapped in `@layer components`. In production builds (`yarn build`), all CSS concatenates in literal source order, so these rules landed AFTER Tailwind's generated utilities — at equal specificity, the LATER rule wins, so e.g. `.card-playful`'s hardcoded `background-color: white` silently beat `bg-[#5B21B6]` on any element using both classes. Dev server (`yarn start`) injects CSS via separate `<style>` tags with different ordering, so this never showed in preview — only on real production builds (which is why the user's externally-hosted coinquest.co.in deployment showed a white CTA card with invisible white-on-white text, while preview looked fine).
- Fix: wrapped all the above classes in `@layer components { ... }` in `index.css` so Tailwind hoists them before the utilities layer regardless of file position.
- Verified: testing_agent iteration_104 — ran a real `yarn build`, served it, and confirmed via computed styles that the CTA now shows correct purple bg/white text/yellow icon/button. Zero regressions across dev preview (landing cards, dashboard gradient cards, wallet/savings pages, store buttons) and prod build.
- Note (code review, not urgent): moving these into `@layer components` means Tailwind now purges any of them not referenced as literal strings in JSX. `.btn-accent`, `.panel-cyan`, `.input-playful`, `.account-*`, `.progress-bar/fill`, `.nav-item-active` are currently unused (verified harmless) — if any of these get reintroduced via a dynamically-composed className (e.g. template string), add them to the Tailwind safelist first.

### Recent Updates (August 24, 2026, later)

**Teen trial booking + real curriculum content for all 3 tracks** ✅
- `EntrepreneurshipWorkshopPage.jsx`: "Book a Free Trial" grade dropdown extended from Grade 1-5 to Kindergarten–Grade 9 (also fixes a pre-existing off-by-one where the array was 0-indexed to "Grade 1" instead of true K=0 semantics — batch grade matching/display in "Open Batches by Grade" is now correctly aligned with the platform-wide scale).
- Seeded real curriculum content for all 3 Entrepreneurship Workshop tracks (topics + subtopics, tagged `curricula: money_entrepreneurship`): Kidpreneur (grades 1-3) — "Where Money Comes From", "My First Business Idea"; Youngpreneur (grades 4-6) — "Smart Money Habits", "Running a Mini Venture"; Teenpreneur (grades 7-9) — "Founder Mindset", "Managing Venture Finances", "Money Habits for Life". All 7 topics/17 subtopics now render live in each track's Lessons tab via the public-curriculum endpoint.
- Verified via curl + screenshot (small scoped change, self-tested, no testing_agent needed): all 3 tracks' Lessons tabs show correct scoped content, trial-enquiry accepts grade up to 9.

### Recent Updates (August 24, 2026)

**Entrepreneurship Workshop — Age Tracks (Kidpreneur/Youngpreneur/Teenpreneur) + platform grade scale extended to 0-9** ✅
- New "Choose Your Child's Track" section on `/entrepreneurship-workshop`: 3 age-track tabs — Kidpreneur (Ages 6-8, grades 1-3), Youngpreneur (Ages 9-11, grades 4-6), Teenpreneur (Ages 12-15, grades 7-9). Each track has Overview (description + 4 generic program tiles: Group Sessions/Teacher-Led Sessions/60 Minutes Per Session/Small Batch Sizes) and Lessons (live-fetched topics+subtopics from new public `GET /api/subscriptions/money-masters/public-curriculum?min_grade=&max_grade=`, scoped to `curricula=money_entrepreneurship`; graceful "coming soon" empty state until admin tags content).
- Platform grade scale extended 0-5 → 0-9 to support Teenpreneur: `live_classes.py` `_parse_grade` cap, Money Masters batch grade validators, `call-request`/`trial-enquiry` child_grade validators (`subscriptions.py`), and admin UI grade dropdowns in `ContentManagement.jsx`, `LiveClassesAdmin.jsx`, `AdminSubscriptionManagement.jsx` (content_topics themselves had no prior server-side grade cap, only UI dropdowns were limited).
- Fixed mobile (390px) horizontal page overflow caused by the new track tab strip (now wrapped in its own `overflow-x-auto` container).
- Verified: testing_agent iteration_103 — 21/21 backend pytest, 95%→100% after fix frontend (only defect found was the mobile overflow, now fixed). Pre-existing off-by-one quirk in the OLD "Open Batches by Grade" section's grade labels was flagged but is out of scope (predates this session).
- Note: the existing "Book a Free Trial" form's grade dropdown intentionally still only offers Grade 1-5 (untouched, per this session's scope) — booking a trial for a Teenpreneur-age child isn't yet wired to the new grade range.

### Recent Updates (August 24, 2026)

**Entrepreneurship Workshop — State/City lead capture + "Smart Money Management" highlight** ✅
- `EntrepreneurshipWorkshopPage.jsx`: replaced the "Live Expert-Led Classes" highlight card with "Smart Money Management" (financial literacy framing: save/spend/budget the money kids have and earn).
- Trial enquiry form now captures State then City (cascading dropdown, city disabled until state chosen, resets on state change) for admin reporting uniformity — new static lookup `frontend/src/data/indiaStatesCities.js` (INDIA_STATES, getCitiesForState()).
- Backend `TrialEnquiryRequest` (`subscriptions.py`) requires `state`/`city`; stored on `entrepreneurship_trial_leads`.
- Admin `AdminPage.jsx` Trial Requests tab: State/City table columns, cascading State/City filter dropdowns (filtered/total badge), CSV export includes state/city.
- Verified: testing_agent iteration_102 — 24/24 backend pytest, 100% frontend Playwright (form validation, cascading dropdowns, admin filters/CSV, regression on status/delete). No defects; test leads cleaned up.
- Deferred by user: tagging existing content/live-classes with the `money_entrepreneurship` curriculum — user will do this manually via the already-verified Content Management curriculum selector.

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
- For Preview: `https://smart-money-learn-5.preview.emergentagent.com/api/auth/google/callback`
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

- **Homework + activity analytics moved to POPUP MODALS** (June 2026)
  - `TeacherHomework.jsx`: the Analytics button now opens a centered Dialog (`homework-analytics-dialog`) with class-level tiles + per-student list, instead of expanding inline in the card. Cards stay compact.
  - `TopicPage.jsx` (teacher): removed the inline "Scores" student name-list from under activity content cards (kept inline only for parents). The teacher "Analytics" button now opens a popup (`ActivityAnalyticsDialog.jsx`, new component) that fetches `/activity/teacher/content-overview/{contentId}` and shows summary tiles + Completed/Not-Attempted lists — no separate page navigation.
  - Verified 100% by testing agent (iteration_79). Non-blocking notes: no abort/stale-response guard on rapid clicks (low impact).

- **Homework: analytics-first teacher UI + blue "Assigned" color** (June 2026)
  - `TeacherHomework.jsx`: homework cards are now compact by default (title, type badge, due date, X/Y done, thin green progress bar). Added an **Analytics** button that reveals class-level tiles (Done / Not done / Completion%); the per-student done/not-done list is hidden until the user clicks a further "View student list (N)" toggle. Keeps classrooms of 25-40 learners readable.
  - `TopicPage.jsx`: color distinction finalized — "Done in class" green (#06D6A0), "Assign as Homework" orange (#EE6C4D), and "Assigned as Homework" now a clear **blue #2563EB** (previously green, which collided with Done-in-class).
  - Verified 100% by testing agent (iteration_78). No functional bugs. Non-blocking notes: single shared `showStudents` state (fine since only one card expands at a time); auth session_token cookie is Partitioned (only affects test automation).


## Recently Completed
- **Fix: no Harvest button on a fully-grown Money Garden plant** (June 2026)
  - Reported: "the flower is ready" but the child had no button to cut/harvest and then sell it.
  - Root cause: `garden.py` `get_farm` applied watering-overdue penalties (water_needed/wilting/dead) BEFORE checking growth, so a plant that reached 100% growth while overdue for water got stuck in `water_needed` and never became `ready` — and the harvest UI only renders when `status==='ready'`.
  - Fix: compute growth from elapsed time FIRST; a fully-grown plant (>=100%) is `ready`/harvestable regardless of thirst; watering penalties only apply while still growing. Frontend: 75-99% bucket relabeled 'Almost Ready!' (was misleadingly 'Ready!'), harvest button now reads '🎁 Harvest' with `data-testid='harvest-btn'`; sell buttons got testids.
  - Verified 100% by testing agent (iteration_91, backend 5/5 + frontend 7/7): grown+thirsty plot returns ready, harvest works, crop appears in shop. (Sell requires the in-app market open 7AM-5PM IST.) Test data cleaned.

  - Reported: entering an incorrect password refreshed to the home/landing page instead of showing an error and staying on sign-in — confusing the user.
  - Root cause: the global axios 401 response interceptor (`App.js`) redirected to `/?session_expired=true` on ANY 401, including wrong-password login attempts (login is `/login`, which wasn't excluded), pre-empting AuthPage's own error toast.
  - Fix: the interceptor now returns early (no redirect) when the failing request is an auth attempt (`/api/auth/login|admin-login|school-login|signup|register`) and also excludes the `/login` path. AuthPage's catch block shows the error toast and keeps the user on the page.
  - Verified 100% by testing agent (iteration_90, frontend 3/3): wrong password (email + username identifiers) stays on /login with an error; correct login still navigates to the dashboard.

  - **Profile/Change Password**: the Security → Change Password card now shows for children and teachers (was parent-only); Teacher dashboard gained a Profile button → `/profile`. `/api/auth/me` now returns `has_password` so the UI knows whether to ask for the current password (reuses existing `PUT /api/auth/change-password`; no auth logic changed).
  - **School Dashboard delete** (full account delete, behind a Confirm-Delete popup): `DELETE /api/school/users/{id}` — teacher delete removes teacher + their class(es) but keeps students (they become classless); student delete removes the student; parent delete keeps their children.
  - **Class codes**: Teachers tab shows each teacher's class code; Students tab shows the student's class code, and classless students get an **Assign class** action (`POST /api/school/students/{id}/assign-class`) to enrol into an existing class. Dashboard payload now includes `join_code`, `parents[]`, and `classrooms[]`.
  - Verified 100% by testing agent (iteration_89, backend 9/9 + frontend). All test data cleaned. Non-blocking: school.py growing (~1440 lines); student learning progress is intentionally retained when a teacher is deleted.

  - Replaced the 3 separate uploads (teachers/students/parents) with ONE unified CSV — **one row per student** carrying that student's teacher(+class) and parent. A single upload creates every account, enrols the student in the teacher's classroom, links parent↔child, and maps everyone to the school. Teachers/parents repeated across rows are created once.
  - Required cols: student_name, student_grade(0-5), teacher_name, teacher_email, class_name, parent_name, parent_email. Optional: student_email, student_username, student_password, subscription(active), subscription_duration(1_day/1_week/1_month).
  - **Credentials**: email-less students get auto username+password; teachers & parents get an auto password (so non-Google users log in with email+password). All generated logins shown post-upload in a Name/Role/Login/Password table + **Download all credentials CSV**. A **Download sample** button provides the template with the 12 headers in order.
  - Backend `POST /api/school/upload/unified` (in `school.py`) returns counts + per-row errors + credentials[]. Verified 100% by testing agent (iteration_88, backend 10/10 + frontend): dedup, error rows, DB integrity (school_id, password_hash, parent links x2 for shared parent, enrollments, grade), subscription grant, and generated parent+student logins return 200. Old per-type endpoints remain server-side but the UI no longer uses them.

  - Admin Content Management: each content row has a **Duplicate** button (content items only — not topics/subtopics). It deep-copies the whole item (title + " (Copy)", thumbnail, grade range, visibility, reward, mandatory flag, and content_data incl. uploaded file references) into a new DRAFT item under the same subtopic, then opens the Edit dialog pre-filled so the admin can tweak and save.
  - Backend: `POST /api/admin/content/items/{id}/duplicate` returns `{content_id, item}`. Editing the copy doesn't affect the original (shared file references are intentional). Verified 100% by testing agent (iteration_87, backend 3/3 + frontend). Non-blocking: pre-existing "setState during render" console warning in ContentManagement (unrelated).

  - When a teacher is added to a school (Add Teacher, Link-Existing teacher, or Bulk CSV upload), every child enrolled in that teacher's classroom(s) is auto-assigned the school's `school_id`, so they show up in the School Dashboard students list. The child profile already surfaces the school via their class.
  - Children already belonging to a DIFFERENT school are skipped and reported back (`students_mapped` / `students_skipped` with names + other-school), surfaced as toasts in `SchoolDashboard.jsx` (`showMappingResult`).
  - Forward case: `student.py` `join_classroom` now sets the child's `school_id` to the classroom teacher's school when the child joins later (skips if already in a school). Teacher leaving does NOT unmap children (per user decision).
  - Helper `_map_teacher_students_to_school` in `school.py`. Verified 100% by testing agent (iteration_86, backend 3/3): mapped 6, skip path (Cara→St. Kabir) correct, forward join-classroom maps school. Env reverted clean.
  - Note: demo_classroom_1 currently has no `join_code` in seed data (unrelated to this feature).

  - Removed the Delete-classroom action from the teacher dashboard; `DELETE /api/teacher/classrooms/{id}` now always returns 403 (classrooms are managed by the school). Classroom *create* was already hidden for school-linked teachers and is unchanged.
  - Added quest **archiving**: per-card Archive/Unarchive + a "Show archived" toggle on the teacher's My Quests section. Backend `is_archived` flag; `GET /teacher/quests?archived=` filters; new `/quests/{id}/archive` + `/unarchive`. Archiving is TEACHER-VIEW-ONLY — child quest queries don't reference `is_archived`, so students still see/complete their quests.
  - Verified 100% by testing agent (iteration_85, backend 9/9 + frontend): delete→403, archive/unarchive flow works, and the assigned student still sees an archived quest.

  - When a teacher marks a content item "Done in class", its "Assign as Homework" and "Analytics" buttons are hidden (it's already covered in class); the green Done-in-class toggle stays. Reactive — updates instantly on toggle, restores on un-toggle. Gated via `!teacherDoneIds.has(content_id)` in `TopicPage.jsx`. Verified 100% by testing agent (iteration_84).

  - For content whose `visible_to` excludes `child` (e.g. a teacher's guide), the teacher Learn/topic card no longer shows "Mark done in class", "Assign as Homework", or "Analytics" — those actions don't apply since students can't see the item.
  - Such cards now get a purple "Teacher Only" badge and a purple border/tint (`#7C3AED`) so they stand out. Child-visible content is unaffected.
  - Logic in `TopicPage.jsx`: `isTeacherOnly = visible_to.length>0 && !visible_to.includes('child')`. Verified 100% by testing agent (iteration_82).

  - Extended the earlier 500-item admin fix. Audited every content query in `content.py` and `repository.py`:
    - `find_with_grade_order` (powers the user-facing Learn/topic view) defaulted to 500 but was called with `limit=100` everywhere → children/teachers/parents could not see more than 100 items in a subtopic. Now unbounded.
    - `admin_get_topics` capped topics/subtopics at 100; `admin_get_items` per-topic capped at 500; `repository.py` topic/subtopic/teacher_repository lists capped at 100/200/500.
    - All changed to `to_list(length=None)` (drains the full cursor).
  - Verified by testing agent (iteration_81, backend, 100% / 5 tests): with 574 seeded items, admin list=574, per-subtopic=152, and the user-facing topic detail returns 152 (was hard-capped at 100). Regression: new item still appears. Reusable guard test at `/app/backend/tests/test_content_cap_fix_v2.py`. REQUIRES PRODUCTION REDEPLOY to take effect on the live site.

  - Reported on the LIVE site (admin@learnersplanet.com, 500+ content items): adding an activity to certain subtopics showed "Content created" but the item never appeared in Content Management (or to users).
  - Root cause: `GET /api/admin/content/items` (`content.py` `admin_get_items`) used `to_list(500)`. With 500+ total items, newly created items fell outside the 500-item window and were silently dropped from the admin response.
  - Fix: removed the cap → `to_list(length=None)` returns every content item.
  - Verified by testing agent (iteration_80, backend, 100%): seeded 544 items, endpoint returns all 544, and a newly created item appears in both the full and per-topic lists. REQUIRES PRODUCTION REDEPLOY to take effect on the live site.

- **Homework: "Assigned" state + child highlight** (June 2026)
  - Teacher content view (`TopicPage.jsx`): after a content item is assigned as homework, its button changes from orange "Assign as Homework" to green "Assigned as Homework" (check icon). Fetched from `GET /teacher/homework` into `assignedContentIds`; flips instantly on assign. Still clickable to assign to another classroom.
  - Child side (`ChildHomework.jsx` → `TopicPage.jsx`): tapping "Open"/"Start" on a homework to-do navigates with `?highlight=<content_id>`; the target content card gets an orange ring + a "Your Homework — complete this!" badge and scrolls into view so the child knows exactly what to do.
  - Verified 100% by testing agent (iteration_77). Note: testing agent flagged that unified login doesn't persist `session_token` to localStorage (only signup does) — recommended fix to reduce intermittent auth bounce (deferred; auth change).

- **Fix: teacher clicking a Topic showed "Coming Soon"** (June 2026)
  - Bug: when a teacher clicked a parent Topic card (not a subtopic), the content page showed an empty "Coming Soon" state instead of the topic's subtopics.
  - Root cause: `get_topic_detail` in `content.py` computed subtopic `content_count` only for child/parent/admin roles; for teachers it stayed 0, so the "filter out empty subtopics" step (`if not is_admin`) dropped every subtopic.
  - Fix: added an `elif is_teacher:` branch that computes subtopic `content_count` using teacher-visibility rules (and marks them unlocked). Teachers now see the non-empty subtopics list, matching the child experience.
  - Verified 100% (testing agent iteration_76, pytest `test_teacher_topic_bugfix.py` + UI). Child behavior unchanged.

- **Assign as Homework (teacher → students) with analytics** (June 2026)
  - Teachers can assign any content item as homework from the Lesson Plan / content view (`TopicPage.jsx` → "Assign as Homework" button → dialog with classroom picker + due date).
  - All active students of the chosen classroom get it and receive a bell notification (deep-links to the content topic). Child sees a "My Homework" section (`ChildHomework.jsx`) on their dashboard with due date + overdue flag.
  - Interactive `activity` content is auto-tracked (via `user_content_progress`); story/book/video/worksheet are self-marked "Done" by the child (`homework_completions`). Overdue stays completable, flagged late.
  - Teacher analytics per homework (`TeacherHomework.jsx`, inside the classroom view): % complete, progress bar, and per-student Done / Not-Done list.
  - Backend (`teacher.py`): POST/GET/GET{id}/DELETE `/teacher/homework`; (`child.py`): GET `/child/homework`, POST `/child/homework/{id}/mark-done`. Collections: `homework_assignments`, `homework_completions`.
  - Verified 100% (curl for all backend paths + testing agent iteration_75 for the full UI). data-testids documented in iteration_75.
  - Known small follow-ups (optional): server-side classroom filter for teacher homework list; non-activity grade-3 seed to UI-exercise Mark-Done; DialogDescription a11y.

- **School Dashboard: map existing accounts by email or username** (June 2026)
  - The "Add User" modal now has a **Create New** vs **Add Existing** mode toggle. In "Add Existing", the school admin enters an existing account's email OR username and it's mapped to the school (sets `school_id`).
  - New backend endpoint `POST /api/school/users/link-existing` (`school.py`): looks up by email or username, validates role match + school membership (rejects already-in-a-school and role mismatches), and for a child honors optional parent/classroom/teacher links.
  - Frontend `SchoolDashboard.jsx`: `addUserMode` toggle, identifier input (`user-identifier-input`), `handleLinkExisting`; testids `add-user-mode-create/existing`, `confirm-link-existing-btn`.
  - Verified 100% (curl for all edge cases + testing agent iteration_74). School QA login: springfield / school123.

- **"Remember me" on login** (June 2026)
  - Added a "Remember me" checkbox (checked by default) to the login form in `AuthPage.jsx`. On submit it saves the entered email/username to `localStorage` (`remembered_identifier`); on the next visit the field is pre-filled to reduce login friction. Password is NEVER stored. Unchecking clears the saved identifier. Testid `remember-me-checkbox`.

- **Quest image upload — investigated (June 2026)**
  - Reported: uploaded image shows broken in the Create Quest preview and not shown to the child. Could NOT reproduce on the current build.
  - Verified end-to-end (testing agent iterations 72 & 73): both small (direct `/upload/quest-asset`) and large >512KB (chunked init/part/complete) uploads work — preview renders (naturalWidth>0), byte-perfect assembly, child sees the image. Backend serves webp/png at `/api/uploads/quests/...` (HTTP 200).
  - Improvement applied: `handleQuestFileUpload` in `TeacherDashboard.jsx` now throws if the server returns no URL and surfaces the real error detail (`Upload failed: <detail>`) instead of a generic message.
  - Likely cause for the reporter: stale/cached JS build or transient network. Recommendation: hard-refresh (Ctrl+Shift+R) and retry; the new error toast will reveal any real failure.

- **Quest images & PDFs now shown to child + teacher** (June 2026)
  - Bug: images/PDFs attached to a teacher-created quest (both quest-level "general upload" and per-question) were not visible for review.
  - Backend (`teacher.py` `get_quest_responses`): now returns `quest.image_url`/`quest.pdf_url` and adds `image_url`/`pdf_url`/`max_points` to each `question_details` entry (question_analytics already had them).
  - Frontend teacher responses modal (`TeacherDashboard.jsx`): shows the quest-level image + "View attached PDF" (data-testid `responses-quest-attachment`) and per-student question images; fixed "10/undefined pts" → "10/10 pts".
  - Frontend child (`QuestsPage.jsx`): completed quests are now clickable to re-open in **review mode**, showing the general image, View PDF, and per-question images.
  - Verified 100% by testing agent (iterations 70 & 71). NOTE: a separate pre-existing issue was flagged — username-only ("school child") logins via the /login UI hit `/api/auth/school-login` and 401; `/api/auth/login` works. Not addressed (out of scope).

- **Child-to-child gifts are CoinQuest play money (not parent-owed)** (June 2026)
  - Bug: a child gifting money to a classmate moved the gifting jar balance correctly, but the receiver's `gift_received` transaction had no `wallet_source`, so it defaulted to `my_wallet` and wrongly showed up in the parent's "Real Earnings to Pay Your Children" list as real cash owed.
  - Fix: all child-to-child gift transactions (money + item, sent + received) in `/app/backend/routes/child.py` `gift-money` now set `wallet_source: "coinquest"`. Parent give-money gifts still explicitly use `my_wallet` (real money owed) — unchanged.
  - Migrated 14 existing child-to-child gift transactions to `coinquest` (identified by `gift_type` field / `gift_sent` type) and cleared their stray `settlement_status`.
  - Verified via curl: fresh gift moves sender gifting jar −5 / receiver +5, both tx tagged `coinquest`, and the entries are excluded from the parent pending/owed list.

- **Parent Overview declutter + "Send Money" dialog** (June 2026)
  - Removed the **Add Chore** and **Jobs** tiles (chores now via Quick Add; Jobs is a top-level tab) and the **Give Money** and **Allowance** tiles from the Overview action grid — now a clean 3-tile grid (Shopping List, Purchases, Savings Goal).
  - Added a **Send Money** button in the Money & Goals tab (mirrors Quick Add) with two tabs: 🎁 Gift Money and 📅 Allowance. Testids: `send-money-btn`, `send-money-tab-gift|allowance`, `send-money-submit-gift|allowance`.
  - Fixed a pre-existing bug: the allowance form posted to the one-time `/parent/allowance` endpoint, so recurring allowances never persisted. Now posts to `/parent/allowances` (recurring) — appears under Active Allowances. Also polished the Active Allowances card (child name fallback + frequency chip, hides empty "Next:").
  - Enlarged the "Quick Add" button (`px-5 py-2.5 whitespace-nowrap`) so text isn't clipped.
  - Verified by testing agent (iterations 68 & 69, 100% for tested flows).

- **Parent "Quick Add" dialog (Reward / Penalty / Chore)** (June 2026)
  - Renamed the "Quick Reward/Penalty" button in Chores & Rewards to **Quick Add** and added a third **📋 Chore** tab so chores can be created inline (alongside Reward and Penalty). Selected child persists across tabs. Chore submits via `POST /api/parent/chores-new` and appears in Active Chores.
  - Testids: `add-reward-penalty-btn`, `quick-add-tab-reward|penalty|chore`, `quick-add-chore-title`, `quick-add-submit-chore`.
  - Verified 100% by testing agent (iteration_67).

- **Parent "Money you owe" itemized breakdown** (June 2026)
  - The "Real Earnings to Pay Your Children" panel now lists each pending entry (description + date + amount) per child instead of just "N pending entries", so parents can trace exactly what they owe. Uses the `pending` array already returned by `GET /api/parent/wallet/pending/{child_id}`. Verified via API + compile.

- **Parent Dashboard misc UI fixes** (June 2026)
  - "Money & Goals" nav tab: inactive text/icon changed from pale yellow to dark goldenrod (#B8860B) for readable contrast.

- **Parent first-time "Link Child" walkthrough nudge** (June 2026)
  - On the Parent Dashboard, when a parent has ZERO children linked, the "Link Child" button now glows with a pulsing highlight ring and an animated pointing cursor + a callout tooltip ("Step 1: Link your child") nudges them to click it.
  - Only shows when: not loading, no children linked, dialog closed, AND the pre-existing welcome onboarding tour is finished (`user.has_completed_onboarding`), so the two don't overlap. Disappears automatically once a child is linked or the Link dialog is open.
  - Files: `/app/frontend/src/pages/ParentDashboard.jsx` (nudge block, data-testid `link-child-nudge`), `/app/frontend/src/index.css` (`.nudge-highlight`, `.nudge-cursor`, `.nudge-callout` keyframes).
  - Verified 100% by testing agent (iteration_65 + iteration_66).

- **Landing hero image replaced + headline update** (June 2026)
  - Replaced the Piggy Bank pexels photo in the landing hero card with the user-uploaded photo of a child using the CoinQuest app on a tablet. Removed the 3 feature tiles (Fun Quests / Grow Money / Win Badges) below it per user request; now shows the full image un-cropped (`w-full h-auto`). `data-testid="hero-image"`.
  - Also fixed the known unescaped-apostrophe lint error in `PricingSection.jsx` ("child&apos;s").
  - Files: `/app/frontend/src/pages/LandingPage.jsx`, `/app/frontend/src/components/PricingSection.jsx`.

- **Money Words: grade-aware category & letter filters** (June 28, 2026)
  - Category chips and A-Z letter buttons on the user Money Words page now show only what's actually available for the viewer's grade. For a Kindergarten child, categories like "Investing" or "Budgeting" (which don't have K words) no longer appear — same for empty letters.
  - Backend (`/app/backend/routes/glossary.py`): `GET /glossary/words` now computes `letters` and `categories` from a base query that respects `is_published != False` (for non-admins) + the child's grade (auto-picked) or `?grade=N` if supplied. Admin GET still returns all letters/categories including from draft words.
  - Verified via curl: parent (no grade) → all 7 categories, 12 letters; parent + `?grade=0` → 5 categories (budgeting & investing filtered out), 9 letters. Word list matches.
  - Files: `/app/backend/routes/glossary.py`.

- **Money Words Live/Draft toggle** (June 28, 2026)
  - Admins can now flip any word to **Draft** to hide it from users, or **Live** to publish. Legacy words with no flag are treated as Live.
  - Backend (`/app/backend/routes/glossary.py`):
    - New `is_published` field on word docs (defaults to `True` for new words)
    - Non-admin GETs (`/glossary/words`, `/glossary/words/{id}`, `/glossary/word-of-day`) exclude `is_published: False` — draft words return 404 on single fetch
    - Admin GET returns all words including drafts
    - New endpoint `POST /admin/glossary/words/{id}/toggle-publish` flips the flag
    - Existing PUT payload accepts `is_published` for full edit dialog control
  - Frontend Admin (`AdminGlossaryManagement.jsx`):
    - Clickable **Live** (green) / **Draft** (grey) pill on each word row — toggles instantly (`data-testid=publish-badge-{id}`)
    - Publish Status Switch inside the Edit dialog (`data-testid=word-publish-toggle`) with helper text explaining Live vs Draft
  - Verified via curl: draft word hidden from user list + returns 404 on single fetch; toggle flips visibility instantly.
  - Files: `/app/backend/routes/glossary.py`, `/app/frontend/src/pages/AdminGlossaryManagement.jsx`.

- **Per-grade Money Words overrides** (June 28, 2026)
  - Admins can now provide **grade-specific meaning / description / examples / image** for any word — a simple version for K, slightly detailed for Grade 1, more detailed for Grade 2. Everything except the term itself is overridable.
  - Backend: new `apply_word_grade_override()` helper + `grade_overrides` dict on word docs (`{"0":{...},"1":{...},"2":{...}}`). Admin POST/PUT accept overrides; user-facing GETs (list / single / word-of-day) apply the override for the user's grade (child auto-picks own grade; `?grade=N` for parents/teachers; no grade → global).
  - Frontend Admin: "Grade-specific overrides" accordion below the main form with one collapsible per grade (K, 1, 2). Each has Meaning / Description / Examples (add/remove) / Image upload. Header shows **Custom** badge when populated or **Uses global** when empty. "Clear this grade" button per grade. Save-time sanitization drops empty fields.
  - Verified via curl: overrides at grade=0 return K-friendly text, grade=2 returns detailed text, no grade → global.
  - Files: `/app/backend/routes/glossary.py`, `/app/frontend/src/pages/AdminGlossaryManagement.jsx`.

- **User Dashboard Footer** (June 28, 2026)
  - New `DashboardFooter` component (`/app/frontend/src/components/DashboardFooter.jsx`) rendered at the bottom of the child (`Dashboard.jsx`), parent (`ParentDashboard.jsx`), and teacher (`TeacherDashboard.jsx`) dashboards.
  - Shows `hello@coinquest.co.in` mailto link + `© {year} CoinQuest. All rights reserved.` — matches landing page contact info.
  - Test-ids: `dashboard-footer`, `footer-contact-email`.
  - Verified via screenshot: footer visible at bottom of Parent Dashboard.

- **"Word Bank" → "Money Words" rename (user-facing)** (June 28, 2026)
  - Dashboard nav tile label changed from "Word Bank" to "Money Words" (`/app/frontend/src/pages/Dashboard.jsx`)
  - GlossaryPage header `<h1>` changed from "Word Bank" to "Money Words" (`/app/frontend/src/pages/GlossaryPage.jsx`)
  - Admin page label intentionally left as "Word Bank" since user said "for the users".

- **Mandatory/Optional inline toggle on Lesson Plan** (June 28, 2026)
  - Each content item in Step 3 Lesson Plan now shows a clickable **Mandatory** (indigo) or **Optional** (amber) pill alongside the Live/Draft pill. Clicking toggles instantly without opening the Edit dialog — matches the Live/Draft UX.
  - New backend endpoint `POST /api/admin/content/items/{content_id}/toggle-mandatory` (mirrors `/toggle-publish`). Default for legacy items is mandatory (True).
  - Files: `/app/backend/routes/content.py` (new endpoint), `/app/frontend/src/pages/ContentManagement.jsx` (`toggleMandatory` handler, clickable pill in `SortableContentItem`).
  - Verified end-to-end via curl: toggle flips `is_mandatory` between True/False on existing items.

- **Grade-scoped content count fix + Know-It Sheet content type** (June 13, 2026)
  - **Count Bug Fix**: Admin Content Management Step 2 Subtopics card was showing "0 content items" for subtopics that had items moved into them for a specific grade only. Root cause: `ContentManagement.jsx` line 1692 was filtering by raw `c.topic_id` instead of `effectiveContentParent(c)` which honors `content.grade_parents[gradeFilter]`. Now counts reflect grade-scoped moves correctly. Child-facing pages already used the backend's `count_with_grade_parent` helper so no change was needed there.
  - **Know-It Sheet content type**: Added as the 5th content type alongside Worksheet, Activity, Book, Workbook, Video. Uses the `Lightbulb` icon. Behaves identically to Worksheet/Workbook (PDF upload, viewer, download, ChildActivityScore). New `WORKSHEET_LIKE_TYPES` set in `TopicPage.jsx` consolidates the worksheet/workbook/know_it_sheet checks via `isWorksheetLike()`.
  - **Edit dialog type switching**: Added a 6-card Content Type picker at the top of the Add/Edit Content dialog (`data-testid=content-type-pick-{value}`) so admins can switch a content item between any of the 6 types without losing files/metadata.
  - Backend `content_type` is a free string — no schema changes required. Files: `ContentManagement.jsx`, `TopicPage.jsx`, `LearnPage.jsx`.
  - Testing: 3/3 backend tests pass (`/app/backend/tests/test_know_it_sheet_and_move.py`) and all frontend flows verified by testing agent (iteration_64).

- **Scroll-to-completed content fix** (April 1, 2026)
  - After a child marks an activity/book as done, the viewer closes and the content list scrolls to the just-completed item (using `scrollIntoView` with `block: 'center'`). Previously scrolled to top, forcing child to scroll down to find where they stopped.
  - Added `data-content-id` attributes to content item cards and `lastCompletedRef` to track the last completed content ID.

- **Hide Empty Topics/Subtopics from Users** (May 1, 2026)
  - Topics and subtopics with zero content items are now hidden from non-admin users (children, parents, teachers). Admin still sees everything for management.
  - Applied in both `get_all_topics` (LearnPage listing) and `get_topic_detail` (TopicPage subtopics).

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
- **Grade-Aware Classmates Page — Viewer-Driven Tiles** (May 28, 2026)
  - Fixed `ClassmatesPage.jsx` to gate Investing/Garden and P/L tiles by the VIEWER's grade (not the classmate's grade).
  - K (grade 0): no Invested/Garden tile, no P/L tile (only Streak, Lessons, Quests, Saved, Spending, Badges).
  - Grade 1–2: Garden 🌱 tile shown, P/L hidden (kids don't understand profit/loss yet).
  - Grade 3+: Invested 📈 + P/L tiles both visible.
  - Verified visually via screenshots for K, G1, and G3 perspectives in Demo Class.
  - Added test users `classmate_k/g1/g2/g3` (password `testpass123`, all flagged `is_test_user`) enrolled in `demo_classroom_1` for ongoing grade-aware QA.


## Upcoming Tasks
- **P1**: Streak Bonuses & Leaderboards
- **Gifting Upgrades — CoinQuest funding, Item gifts/requests, Sequential back nav** (May 28, 2026)
  - Giving Jar can now be funded from **CoinQuest Wallet (play coins)** in addition to My Wallet. Backend `wallet.py` relaxed; frontend `GiftingPage.jsx` exposes both sources in the Add Money dialog.
  - Children can now **Give** or **Ask for** specific items (toy/book/etc.) — not just money. New `Money/Item` toggle in both `ClassmatesPage.jsx` dialogs. Item gifts/requests don't move any wallet balance; they just create a record + notify the friend so kids can coordinate the physical handover.
  - Backend: `GiftRequest` model extended with `gift_type`, `item_name`, `item_description`. `/gift-money`, `/request-gift`, and `/gift-requests/{id}/respond` all handle item-type flows without touching wallet balances.
  - **Smart back navigation**: created `/app/frontend/src/components/BackButton.jsx`. Uses `navigate(-1)` when history exists, falls back to `/dashboard` on deep links. Applied to 10 child-facing pages: Classmates, Gifting, Wallet, Achievements, Chat, Lending, Garden, Jobs, Quests, Stocks. So `Dashboard → Gifting → Send Gift → Classmates → Back` now correctly returns to Gifting (no more confusing jump to Dashboard).
  - Regression suite: `/app/backend/tests/test_gifting_features.py` — 9 tests, all green (CoinQuest→Gifting allowed, Savings rules intact, item gifts have zero wallet impact, money gifts unchanged).

- **P1**: Safety Guardrails (spending limits, parent approval)
- **P2**: Teacher/Parent Collaboration Portal
- **Mandatory vs Optional content** (May 28, 2026)
  - New `is_mandatory` field on `content_items` (defaults to `True`). Admins flip a "Completion Requirement" toggle in the content dialog (Repository → Edit) — copy adapts to "Mandatory — kids must finish this before the next item unlocks." vs "Optional — the next item unlocks even if kids skip this one."
  - Backend (`/api/content/topics/{topic_id}`): progressive-unlock walker now lets optional items pass-through (next item auto-unlocks) as long as the optional item itself is reachable. Subtopic→subtopic and topic→topic gates also use mandatory-only completion so a single optional item never blocks downstream progression.
  - Frontend: admin list shows an amber **Optional** pill on content rows; child `TopicPage.jsx` shows the same pill next to the content title.
  - Test suite: `/app/backend/tests/test_optional_content.py` — 6 tests covering default-mandatory persistence, optional-skip-through, mandatory chain integrity, and admin PUT-toggle round-trip.

- **P2**: Collaborative & Seasonal Events
- **P2**: Email notifications for loan events
- **P2**: Tutorial System for new users
- **Active/Inactive subscription tabs + Mandatory mobile on signup** (May 29, 2026)
  - Admin → Subscription Management now has Active / Inactive sub-tabs (with counts) inside the existing Subscriptions tab. Fixes the bug where only 1 of 21 subscriptions was visible. New "Status" column shows Active / Expired / Deactivated / Pending so admins can triage Inactive entries.
  - Non-SSO signup now requires a mobile number. Backend validates a 10-digit Indian mobile (accepts +91 / 91 / 0 prefixes, must start 6–9) and stores it normalized as `+91XXXXXXXXXX` on the user doc.
  - Phone surfaces in Admin → Users table (new "Phone" column) and in a new "CSV" download button on the Users toolbar (includes Phone, Subscription Status, Sign Up & Last Login dates).
  - Regression suite: `/app/backend/tests/test_signup_phone.py` — 5 tests covering required field, invalid formats, valid variants normalization, leading-digit rule, and admin payload exposure. 20/20 tests across all suites green.


- **Playful Savings Goal progress bar** (June 2026)
  - Redesigned the Savings Goals progress bar in `/app/frontend/src/pages/SavingsGoalsPage.jsx` to be highly visual & exciting per user request.
  - Features: striped animated green fill (moving stripes), a bouncing 🪙 coin marker that slides to the % position, milestone flag markers at 25/50/75%, a centered % label, and motivational milestone messages ("You're on your way!" → "Halfway there!" → "Almost there — keep going!" → "Goal reached!").
  - Completed goal cards now burst with falling confetti (🎉⭐🪙🎊💫🏆); a rainbow shimmer variant kicks in at 100%.
  - CSS animations added to `/app/frontend/src/index.css` (`.goal-track`, `.goal-fill`, `.goal-coin`, `.goal-milestone`, `.goal-confetti` + keyframes).
  - Verified visually with seeded goals on `wallet_demo_child` at 15% / 53% / 80% / completed — all percentages compute correctly.

- **Homework "Open" → correct topic + highlight (bug fix, Aug 7, 2026)**
  - Bug: clicking "Open" on a child's homework card landed on a random/wrong topic and didn't highlight the assigned item.
  - Root causes: (1) the homework content could be removed by the topic view's grade/visibility filters; (2) a stale `topic_id` stored on the homework assignment.
  - Fix: `GET /api/content/topics/{topic_id}` now takes an optional `highlight` param that force-includes that content item (published-only) even if outside grade/visibility filters; `GET /api/child/homework` resolves each item's CURRENT `topic_id` from the live content doc; `TopicPage.jsx` forwards the `highlight` param.
  - Verified by testing agent (iteration_92.json): backend 4/4 pytest (`/app/backend/tests/test_homework_highlight.py`), frontend click-through highlights all 3 homework items including the grade-excluded regression case. 100% pass.

- **My Wallet dedicated page + manual money tracking (feature, Aug 7, 2026)**
  - New child page `/my-wallet` (`MyWalletPage.jsx`) opens when tapping the My Wallet card from BOTH the Dashboard tile (`jar-my_wallet`) and the Wallet page card (`my-wallet-card`).
  - Shows real (parent-settled) balance, month In/Out totals, and a "Money Story" ledger of every earning (auto chores/jobs/rewards/gifts/allowance, with 'waiting for payout' badges on unsettled) with kid-friendly category icons.
  - Kids can log manual entries: "I got money" (income → increases balance) and "I spent money" (spend → decreases balance), each with icon categories + optional note. Overspend and amount<=0 rejected client + server side.
  - Backend (`routes/wallet.py`): `GET /api/wallet/my-wallet` (balance + summary + entries) and `POST /api/wallet/my-wallet/entry` (records transaction wallet_source='my_wallet', settlement_status='paid', new types manual_income/manual_spend added to `services/wallet_sources.py`). parent_settlement rows shown as neutral info entries.
  - Verified by testing agent (iteration_93.json): backend 6/6 pytest + full frontend flows, 100% pass. Regression: `/app/backend/tests/test_my_wallet.py`.

- **My Wallet: Use money (Spend/Save/Give) + auto-tracking + pagination + chart (Aug 7, 2026)**
  - "I used money" replaces "I spent money": two-step dialog — pick Spend / Save / Give, then amount + category + note. Save moves my_wallet→Piggy Bank jar, Give moves my_wallet→Giving jar, Spend just deducts. "I got money" adds income.
  - Auto-tracking: my_wallet→savings transfers tagged 'save' (wallet_save), my_wallet→gifting tagged 'give' (wallet_give); savings-goal contributions appear as informational 'save' entries. Parent chores/jobs/rewards/gifts/allowance already inflow.
  - Ledger paginated 10/page, newest first (Back/Next). Backend GET /api/wallet/my-wallet?page=&page_size= returns balance, in/out totals, breakdown{spend,save,give with sub-categories}, entries, page, total_pages.
  - Colourful donut chart (`components/MoneyBreakdownChart.jsx`) shows Spend/Save/Give split + sub-category chips. Visible to child (/my-wallet) and parent (ParentDashboard 'Money Story' panel/dialog via GET /api/parent/child/{child_id}/money-story).
  - Verified by testing agent (iteration_94.json): backend 11/11 pytest + all frontend flows (child spend/save/give/income, validation, pagination, parent dialog + chart) 100% pass. Regression: /app/backend/tests/test_my_wallet.py.

- **My Wallet: Save-to-a-Goal + Undo/Fix entry (Aug 7, 2026)**
  - Save flow now asks "Where should it go?" — General Piggy Bank (savings jar) OR a specific active savings goal. Saving to a goal deducts My Wallet and increments that goal's current_amount (marks completed when reached).
  - Manual "by me" entries (manual_income/spend, wallet_save/give) now have edit (pencil) and delete (trash) controls. Delete reverses the money movement (returns to My Wallet, removes from jar/goal/income); edit adjusts balance & goal by the DIFFERENCE only.
  - Backend (routes/wallet.py): add_my_wallet_entry accepts optional goal_id; new DELETE and PUT /api/wallet/my-wallet/entry/{id}; helpers _reverse_entry_effect & _apply_entry_effect_raw with guards (non-manual -> 400, already-spent -> 400, unknown goal -> 404).
  - Verified by testing agent (iteration_95.json): 23/23 pytest + all frontend flows (save-to-goal, save-to-piggybank, edit-by-difference, undo, validation, non-manual guard) 100% pass. Regression: /app/backend/tests/test_my_wallet.py.
  - Known low-risk hardening (non-blocking, from code review): multi-write flows aren't wrapped in a Mongo txn; edit reapply doesn't re-check goal existence after reversal; delete uses window.confirm.

- **My Wallet: removed percentages (Aug 7, 2026)**
  - Chart legend (MoneyBreakdownChart.jsx) now shows only ₹ amounts per bucket (no % figure); donut still conveys proportion visually.
  - Save-to-goal picker (MyWalletPage.jsx) shows "₹315 of ₹2000" instead of a % badge.
  - Scope confirmed by user: leave % as-is on all other screens (child quiz/activity scores, stock market, teacher/parent/admin analytics).

- **More-visual child UX: filling jars, mission cards, celebrations, Learn journey map (Aug 8, 2026)**
  - Dashboard 'My Money' card: each account is now a FILLING JAR (liquid level = balance vs largest jar) with ₹ amount; each jar links to its feature. CSS `.jar-fill` in index.css.
  - Homework redesigned as 'My Missions' cards (ChildHomework.jsx): content-type icon, due date/overdue badge, Open/Start + Mark-done.
  - Big-win CELEBRATION: canvas-confetti + Web-Audio chime fire ONLY on savings-goal completion (SavingsGoalsPage handleAllocateToGoal) and badge claim (AchievementsPage handleClaim). Reusable util /utils/celebrate.js; persistent mute toggle (localStorage 'coinquest_mute') in dashboard header (CelebrationMuteToggle.jsx). User choice: celebrate big wins only; sound on with mute toggle.
  - /learn for CHILDREN = winding JOURNEY MAP of top-level topics (LearnPage JourneyMap): locked (padlock + toast), current (🐣 'Start here!' + pulse), completed (star/check), last stop gets a flag. Teacher/parent keep the old list.
  - Added dep: canvas-confetti. Verified by testing agent (iteration_96.json): 8/8 frontend flows 100% pass, no bugs.
  - Suggested-but-deferred (per user): dashboard mascot; child quiz/stock %/adult analytics left unchanged.

- **REVERTED: "more-visual child UX" batch (Aug 8, 2026)**
  - Per user request, fully rolled back the last batch: filling money jars, homework "My Missions" cards, big-win celebrations (confetti/sound + mute toggle), and the Learn journey map.
  - Method: restored Dashboard.jsx, LearnPage.jsx, ChildHomework.jsx, SavingsGoalsPage.jsx, AchievementsPage.jsx, index.css from pre-batch commit 3cb5076; deleted utils/celebrate.js and components/CelebrationMuteToggle.jsx; removed canvas-confetti dep.
  - KEPT (unaffected): My Wallet page + buckets + pagination + chart, save-to-goal + undo/edit, %-removal, savings-goal playful bars, /my-wallet routing, homework Open→highlight fix.
  - Verified via screenshot: dashboard shows original tile "My Money" grid (no jars/mute), Learn shows original card list (no journey map); frontend compiles clean.

- **Garden: per-unit price for Grade 2 (Aug 8, 2026)**
  - In the Money Garden seed-detail card (MoneyGardenPage.jsx ~line 709), Grade 2 now shows "Price per <unit>" (e.g. "Price per piece ₹2", "Price per kg ₹X") instead of the pre-computed "Total Income", so the child must multiply Harvest Yield × unit price themselves.
  - Gated on gradeLevel === 2 only; Grade 1 and all other grades keep "Total Income" unchanged. Unit singularized (pieces→piece, flowers→flower, kg→kg).
  - Verified via screenshot as classmate_g2: Red Chilli shows "Harvest Yield 15 pieces" + "Price per piece ₹2".

- **Money Garden mobile layout fix (Aug 8, 2026)**
  - The garden's 2×2 quadrant grid was forced to 2 columns on phones, cramming each quadrant into ~180px and causing the Market/Shop "Buy"/"Sell" buttons to overlap the seed name/price.
  - Fix (MoneyGardenPage.jsx): grid now `grid-cols-1 md:grid-cols-2` (stacks on phones, 2×2 on md+); full-viewport min-height applied md+ only; each quadrant card got a mobile min-height so internal flex areas render; Market/Shop rows got `shrink-0` on the action button + `truncate` on text to prevent overlap.
  - Verified via 390px screenshot as classmate_g2: single-column, no overlap, 0px horizontal overflow. Desktop 2×2 unchanged.

- **School dashboard: teacher last-login (Aug 15, 2026)**
  - Added teacher "Last Login" to the School dashboard — a new "Last Login" column in the Teachers tab table and a "Last login" line in the overview Recent Teachers list (SchoolDashboard.jsx).
  - Uses existing users.last_login_at (already set on login in auth.py); backend school dashboard already returns it (only _id/password excluded). New formatLastLogin() helper shows Today / Yesterday / N days ago / "12 Jun 2026", and "Never" when the teacher hasn't logged in.
  - Verified via screenshot as school admin (springfield): both teachers show "Never" (correct — no logins yet).

- **Content Management: grade-range edit not reflecting (Aug 15, 2026) — FIXED**
  - Bug (reported on production): editing a topic/subtopic and changing its Min/Max Grade did not reflect in the UI when a grade filter was active.
  - Root cause: ContentManagement.jsx adds `payload.grade = gradeFilter` to the PUT whenever a grade filter is active (to save per-grade text overrides). Backend `admin_update_topic` (content.py) then took the override branch and only saved title/description/thumbnail under `grade_overrides.<grade>` — silently ignoring min_grade/max_grade.
  - Fix (backend content.py `admin_update_topic`): in the per-grade branch, always apply min_grade/max_grade as GLOBAL `$set` (grade range is a structural, global property and can't be a per-grade override). Also updated the edit-dialog amber hint text in ContentManagement.jsx to say the grade range always saves globally.
  - Verified: curl PUT with `grade:"1"` + changed min/max now updates global min_grade/max_grade while keeping text overrides; full UI e2e (Grade-1 filter → Edit topic → change Max Grade → badge live-updated K-5→K-3 → reverted). Data left clean.
  - NOTE: fix is in preview/codebase; production must be REDEPLOYED for the user to see it live.

- **New content item types: Group Project & Class Discussion (Aug 15, 2026)**
  - Added two new content types alongside Worksheet/Know-It Sheet/etc. Admins upload content for them the same way (PDF/HTML/link/instructions).
  - Teacher-oriented: selecting either type in the Add Content dialog defaults visibility to ['teacher'] (TEACHER_ONLY_TYPES in ContentManagement.jsx). Not shown to kids by default; admin can still adjust visibility per item.
  - Icons/colors: Group Project = Users (teal), Class Discussion = MessagesSquare (pink).
  - Registered across: ContentManagement.jsx (CONTENT_TYPES + default-visibility on both type pickers), TopicPage.jsx (CONTENT_TYPE_CONFIG + added to WORKSHEET_LIKE_TYPES so they use the PDF viewer/download/mark-done UI), LearnPage.jsx (CONTENT_TYPE_ICONS), TeacherHomework.jsx & ChildHomework.jsx (label maps).
  - Backend needs no change (content_type is free-form string; no enum). Verified: API create persists content_type='group_project' with visible_to=['teacher']; frontend compiles; Add Content grid shows both new cards.

- **Renamed "Class Discussion" → "Discussion" (Aug 16, 2026)**
  - Type value renamed class_discussion → discussion; label "Discussion", description "Talk it out — in class or at home" (can be a class talk or an at-home talk).
  - Default visibility now teacher + parent (DEFAULT_VISIBILITY map in ContentManagement.jsx replaced the old TEACHER_ONLY_TYPES; group_project stays teacher-only, discussion = ['teacher','parent']). Helper defaultVisibilityFor() used by both new-content grid and in-dialog type switcher.
  - Updated in ContentManagement.jsx, TopicPage.jsx (config + WORKSHEET_LIKE_TYPES), LearnPage.jsx, TeacherHomework.jsx, ChildHomework.jsx. No stale class_discussion refs remain.
  - Verified: API persist type='discussion' visible_to=['teacher','parent']; frontend compiles; Add Content grid shows the "Discussion" card.

- **Block downloads for test users (Aug 16, 2026)**
  - Admin-flagged test users (is_test_user=True) can VIEW content but are blocked from DOWNLOADING PDFs/files (prevents free harvesting of paid content).
  - Backend (content.py): POST /content/{id}/download now returns 403 "Test users cannot download the content. You can still view it online." for is_test_user; GET /content/{id}/download-status returns {download_blocked:true, block_reason} for test users. Non-test users unaffected (verified admin download still 200).
  - Frontend (TopicPage.jsx): download button renders a lock icon + "viewing only" tooltip for blocked users; handleDownload pre-empts with a toast (no API call); 403 test-user responses show the message instead of the trial-upsell modal. Inline PDF viewer (viewing) unchanged.
  - Verified: API (test user 403 + download_blocked status; non-test 200) and full UI e2e as test child classmate_k — worksheet opened (view works), download click showed the toast "Test users cannot download the content."

- **Block "Open in new tab" PDF link for test users (Aug 16, 2026)**
  - Extends the test-user download block: the viewer's "Open in new tab" link for worksheet/workbook PDFs and book PDFs is now replaced with a lock button for is_test_user accounts. Clicking it shows the toast "Test users cannot download the content."
  - Uses user.is_test_user (returned by /api/auth/me) in TopicPage.jsx. Inline PDF viewer (viewing) unchanged. HTML/activity "open in new tab" links left as-is (not file downloads).
  - Verified via UI e2e as test parent (wallet_demo_parent): both the download and open-in-tab controls render as locks; open-in-tab click shows the toast; content still viewable inline.

- **Hid Store from child + Store/Purchases from parent dashboards (Aug 20, 2026)**
  - Added feature flag /app/frontend/src/config/features.js → STORE_ENABLED (currently false). Flip to true to re-enable everything.
  - Child (Dashboard.jsx): "Store" nav tile hidden; the spending ("Wallet") jar now links to /wallet instead of /store while the flag is off.
  - Parent (ParentDashboard.jsx): the action grid with "Shopping List" (store) and "Purchases" buttons is hidden (Purchases dialog kept in code, just not triggerable).
  - /store route and StorePage are NOT deleted — only the dashboard entry points are hidden. Verified via screenshots on child (classmate_g1) and parent (wallet_demo_parent) dashboards.

- **Fixed "Money You Can Spend" total counting Giving jar (Aug 20, 2026)**
  - Bug: WalletPage /wallet top card summed ALL jar balances incl. Giving (gifting), so ₹25 earmarked for giving inflated spendable total (e.g. 115+25=140).
  - Fix (WalletPage.jsx ~line 243): totalAvailable now excludes account_type 'gifting' and iterates getFilteredAccounts() (grade-aware, so hidden jars like Kindergarten garden never count); uses available_balance ?? balance so goal-allocated (savings In Goals) and invested (garden) money is excluded too.
  - Verified by testing_agent (iteration_97.json): 4/4 child wallets show total == sum of non-gifting accounts' available_balance; live transfer My Wallet->Giving dropped the spendable total immediately. FIXED.
  - Known separate/pre-existing issue surfaced by tester (NOT part of this fix): the Move Money dialog offers Giving->My Wallet but backend rejects it ("Giving money can only leave by sending a gift"). Backlog. Also tester mutated wallet_demo_child seed (my_wallet 265->255, gifting 49->59) and couldn't revert due to that rule.

- **Multi-curriculum module (Financial Literacy + Money Masters & Entrepreneurship) (Aug 21, 2026)**
  - Schools buy/enable curricula separately; a school can have one or both. Non-school (D2C) users see Financial Literacy only. Content shared at content-ITEM level (each item has a `curricula` tag; topics/subtopics also tagged for organisation).
  - Backend: new services/curricula.py (registry + get_active_curricula + content_curricula_clause + normalize_curricula). content.py: GET /curricula (public), delivery scoping applied to /content/topics + /content/topics/{id} via _apply_curricula on content-item queries, honors ?curriculum= override (only within the user's active set). Admin create/update topic+item persist curricula. school.py: PUT /admin/schools/{id}/curricula, curricula on create + in GET. Migration backfilled all 25 items, 88 topics, 2 schools to ['financial_literacy'].
  - Leak fix: untagged/legacy content is treated as Financial Literacy ONLY (never leaks into an entrepreneurship-only school). /curricula made public-safe.
  - Frontend: ContentManagement CurriculaSelector in topic/subtopic/content editors; AdminPage school-card 'Curriculum access' toggles (PUT); LearnPage curriculum switcher shown only when the school has >1 curriculum (passes ?curriculum=).
  - Verified: testing_agent iteration_98 (backend 16/16 pytest incl. delivery scoping + school PUT + admin CRUD; all frontend flows). Baseline restored (both schools FL-only). Test suite at /app/backend/tests/test_curricula.py.
  - KNOWN pre-existing bug surfaced (NOT caused by this feature, will show on ENT topics): a topic that has direct content items and NO subtopics is marked COMPLETE on /learn regardless of child progress (get_all_topics derives is_completed from subtopic completion only). Fix pending user go-ahead.

- **Content Management: Curriculum filter (Aug 22, 2026)**
  - Added a "Curriculum" dropdown in the Content Management header (next to Filter by Grade + Status): All Curriculums / Financial Literacy / Money Masters & Entrepreneurship (data-testid='curriculum-filter-select').
  - curriculumFilter state + matchesCurriculumFilter() applied to filteredTopics (topics + subtopics + grafted) and filteredContent. Legacy/untagged items count as financial_literacy. Verified: selecting ENT hides the all-FL topics ("No topics yet").

- **Live Classes module (Aug 22, 2026)**
  - Admin-managed calendar of dated live sessions: title, brief, date/time (IST), duration, join link (Zoom/Meet), optional recording link (added later), grade RANGE (min-max), curricula tag (grade + curriculum scoped), publish toggle.
  - Delivery: subscribed CHILDREN see published classes matching their grade + their school's enabled curricula; PARENTS see the union across their linked children; teachers/others see none (child+parent surface). D2C children default to Financial Literacy.
  - Backend: routes/live_classes.py (admin CRUD + GET /live-classes) registered in server.py; reuses services/curricula.py for scoping. Full input validation (400 not 500) on grades/duration/datetime(ISO->UTC)/title/URL(http-s only)/min<=max.
  - Frontend: LiveClassesAdmin.jsx (/admin/live-classes, tile on Admin dashboard); LiveClassesPage.jsx (/calendar) read-only with Upcoming/Live vs Past split, Join buttons + Watch Recording, IST times, error+retry state. New 'Calendar' child nav tab (after Money Words). Parent dashboard header 'Live Classes' link.
  - Verified: testing_agent iteration_99 (backend 25/25 + all frontend flows). Fixed all flagged validation gaps; regression suite /app/backend/tests/test_live_classes.py now 31/31 pass. live_classes collection left empty (baseline).

- **Money Masters & Entrepreneurship: standalone batch subscriptions (Aug 23, 2026)**
  - New sellable module, independent of the base Financial Literacy plan: parents buy a dated "batch" (name, grade, start/end date, price) for one linked child. Live Classes is NOT sold standalone — a batch purchase automatically includes that batch's live classes (curriculum-based access, no extra plumbing needed). Works fully standalone: no base FL plan required. No seat/capacity limit on batches. Reuses the existing Razorpay create-order/verify-payment flow.
  - Backend: `services/curricula.py` — `get_active_curricula`/new `get_d2c_subscribed_curricula` now derive a D2C user's curricula from their OWN active subscriptions (base plan → financial_literacy, money_masters batch → money_entrepreneurship, union if both). Children also inherit their linked parent's base-plan curriculum via `parent_child_links` (critical fix — see below).
  - `routes/subscriptions.py`: new `db.money_masters_batches` collection + admin CRUD (`POST/GET /admin/money-masters/batches`, `PUT/DELETE /admin/money-masters/batches/{id}`) with validation (name, grade 0-5, end>start, price>0); parent-facing `GET /money-masters/batches?child_id=`, `POST /money-masters/create-order` (validates child link + grade match + no duplicate active sub for that child), `GET /money-masters/my-batches`. `verify_payment` now branches on `plan_type=='money_masters'` to keep the batch's real `end_date` instead of recalculating from `DURATION_MAP` (base plans unaffected).
  - `routes/admin.py` `get_users`: rebuilt subscription lookup so a user can carry multiple simultaneous `active_plans` (Full Plan + Money Masters batch); added `money_masters_batch` field. Children now correctly inherit their parent's base-plan badge for display via `parent_child_links` resolution (previously always showed "inactive" for children even when the parent had an active plan — pre-existing gap, fixed here for accurate admin visibility).
  - Frontend: `AdminSubscriptionManagement.jsx` new "Money Masters Batches" tab (create/edit/delete/toggle-open, enrolled count); Subscriptions tab shows batch name+grade for money_masters rows. `AdminPage.jsx` Users table shows Full Plan / Money Masters plan badges under the status pill. New `components/MoneyMastersPurchase.jsx` — parent-facing promo card + purchase dialog (child picker → matching open batches → Razorpay checkout), rendered in `ParentDashboard.jsx` Overview.
  - CRITICAL bug found + fixed by testing agent: base-plan subscriptions only ever store `parent_emails` (never `child_user_ids`), so a child's own curriculum lookup previously fell back to the `DEFAULT_CURRICULUM` — once a money_masters sub set `child_user_ids`, that fallback stopped firing and the child LOST Financial Literacy entirely. Fixed by resolving the child's linked parent(s) via `parent_child_links` and including the parent's base-plan email as a lookup candidate.
  - Also fixed: invisible "+ New Batch" button (text color matched background), batch-dialog date pickers allowed selecting adjacent-month "outside days" and end<start ranges (added `showOutsideDays={false}` + `disabled={{before: start}}` + `fromDate`), added client-side end>start validation, added Razorpay `prefill` (name/email/contact) in the parent purchase dialog.
  - Verified: testing_agent iteration_100 — new `/app/backend/tests/test_money_masters.py` (39 pytest cases: batch CRUD/validation/toggle, create-order guards, verify-payment end_date branching, curricula gating incl. the critical child-inheritance case, admin active_plans) — 39/39 pass after the fix. Full Playwright pass on admin batch CRUD, admin Users badges, and the parent purchase dialog up to (not through) the live Razorpay widget. Regression-checked `test_curricula.py` (47) and `test_live_classes.py` unaffected.
  - Known follow-up (not yet done): no topic/content item/live class is currently tagged `curricula=['money_entrepreneurship']`, so a money-masters-only purchaser sees an empty Learn page (existing "content coming soon" empty-state renders, no crash) until admin tags content via the existing Content Management curriculum selector.

- **Entrepreneurship Workshop hero image (Aug 24, 2026)**
  - Replaced the placeholder Rocket-icon box in the workshop hero (right side, `/entrepreneurship-workshop`) with a real photo (user-provided: child selling cookies to a customer).
  - Relabeled the 3 highlight tiles: "Big Ideas"->"Built a product" (Hammer icon), "Teamwork"->"Pitched to real buyers" (Mic icon), "Real Ventures"->"Made their first sale" (IndianRupee icon).
  - Verified via screenshot on desktop + mobile — compiles clean, image renders correctly, no layout regressions.
  - Follow-up: image was cropped because the box used a fixed short landscape height (h-56) for a portrait (1122x1402, 4:5) source photo. Fixed by changing the container to `aspect-[4/5]` so the full photo renders without cropping.
  - Follow-up 2 (user feedback: too much empty space top/bottom): re-cropped the source photo to a tight square (1122x1122, saved locally at frontend/public/workshop-hero.png) centered on the boy/customer hand-off + price sign, removing sky and excess tablecloth. Hero container changed to `aspect-square`, card padding tightened (p-8->p-6, gap-4->gap-3), image column capped at `max-w-md` on mobile so it does not grow oversized.
  - Follow-up 3 (still had visible empty sky at top): re-cropped tighter — square 950x950 (was 1122x1122), starting lower (y=300) and horizontally centered, so subjects fill the frame with minimal empty background while keeping the price sign/boxes fully visible.
  - Follow-up 4: removed the 3-tile highlight row ("Built a product"/"Pitched to real buyers"/"Made their first sale") below the hero photo entirely per user request, making the hero section more compact.

- **Shared persistent site header (Aug 25, 2026)**
  - New `components/SiteHeader.jsx`: cream nav bar with CoinQuest logo (links home), nav links Workshop -> `/entrepreneurship-workshop`, Platform -> `/financial-literacy`, For Schools -> `/school-login` (active page highlighted in orange), and "Sign In" kept as the existing pill button style (`btn-primary`). FAQ intentionally omitted for now.
  - Rendered at the top of the Hub (`LandingPage.jsx`), Financial Literacy Platform page, and Entrepreneurship Workshop page — replacing each page's own inline nav (logo+Sign In on hub/FL, "← CoinQuest Home" back-link + Sign In on the other two). Back-to-home links removed per user request since the shared header's logo now covers that.
  - Verified via screenshot on all 3 pages + live click-through (Workshop and Platform nav links navigate correctly, active state highlights).

- **Context-aware header CTA (Aug 25, 2026)**
  - `SiteHeader.jsx` CTA button now changes by current page: Workshop -> "Book a Free Trial" (reuses existing `?trial=1` query-param flow to open the trial dialog on that page), Platform -> "Sign Up" (navigates to `/signup`), For Schools (`/school-login`) -> "Enquire Now" (opens the school enquiry form), all other pages -> default "Sign In".
  - Extracted the School Subscription Enquiry dialog out of `PricingSection.jsx` into a standalone reusable `components/SchoolEnquiryDialog.jsx` (controlled via open/onOpenChange) so both PricingSection and SiteHeader share the same form + `/admin/school-enquiry` submit logic without duplication.
  - Added `SiteHeader` to `SchoolLogin.jsx` too (was previously missing it) and removed its now-redundant "Back to Home" link, matching the pattern already applied to the Hub/Platform/Workshop pages.
  - Verified via live click-through on all 4 contexts (Workshop trial dialog opens, Platform navigates to /signup, School enquiry dialog opens, Hub shows default Sign In) — screenshots confirm correct CTA label + behavior on each page.

- **Sticky header (Aug 25, 2026)**: `SiteHeader.jsx` changed from static to `sticky top-0 z-50` with a subtle shadow, so it stays visible while scrolling on all pages that use it. Verified via screenshot after scrolling.

- **New "For Schools" marketing page (Aug 25, 2026)**
  - Built `pages/ForSchoolsPage.jsx` at new route `/for-schools`, replacing the raw school-login form as the "For Schools" nav destination (login form still lives at `/school-login`, now reachable only via SchoolDashboard's own redirect).
  - Hero: exact user-provided copy ("Beyond academics: raise students who understand money and think like builders." + description), single "Enquire Now" CTA, right column intentionally left blank pending a future image.
  - Two beautified program sections (Financial Literacy — yellow badge/cream bg; Entrepreneurship Workshop — purple badge/white bg), each with a title+subtitle+CTA row and a 5-card icon grid (who delivers it / what we provide / schedule fit / student outcome / print-ready or culmination day), copy matched to the user's mockups.
  - Comparison table "Which one fits your school?" (7 rows) + simplified final CTA section — replaced the mockup's 3-step "getting started" flow with just a "Get Started Now" heading and a single Enquire Now button, per explicit request.
  - `SiteHeader.jsx` "For Schools" nav now points to `/for-schools` (was `/school-login`); CTA map updated to match. All 4 Enquire Now buttons on the page open the same shared `SchoolEnquiryDialog`.
  - Verified via screenshot (desktop + mobile hero, all sections) and live click-through confirming the enquiry dialog opens correctly.
  - Follow-up: hero gradient ended in a peach that blended into the (then-cream) Program 1 section with no visible boundary. Swapped section backgrounds — Program 1 now white, Program 2 now cream (#FDF6E3) — so hero->Program1->Program2 each have clear contrast, matching the convention used on the Hub/Platform/Workshop pages.
  - Removed the "Get Teacher Access" (Program 1) and "Request a Pilot" (Program 2) buttons per user request — each program section now just shows the badge/title + subtitle, no per-program CTA.
  - Added the standard site footer (logo, Contact Us, copyright) matching the pattern used on Landing/Financial Literacy/Workshop pages.

- **Redesigned "For Schools" page for stronger visual hierarchy (Aug 25, 2026)**
  - User feedback: page felt "underwhelming", headings not standing out. Called design_agent -> new `/app/design_guidelines.json` ("Playful Brutalism" bento-grid direction).
  - Program section headers redesigned: rotated sticker-style badges (teal "Program 1" / coral "Program 2", -rotate-2/rotate-2), massive program titles (text-4xl/5xl, purple for Program 2), subtitle now full-width below instead of squeezed into a flex row.
  - Feature cards upgraded to a bento grid: "What students walk away with" is now a wide (col-span-2) lead card; all cards got thicker 3px borders, hard drop-shadows with hover lift, and colored icon-block backgrounds (teal/yellow/cyan for Program 1, purple/coral for Program 2) instead of flat cyan icon boxes.
  - Comparison table: bigger heading (text-4xl/5xl), thicker border + 8px hard shadow container, column headers color-coded (teal/yellow) to match each program.
  - Final CTA: bigger heading + button (yellow bg, 6px shadow) for more presence.
  - Verified via full-page screenshot scroll — hero, both program sections, comparison table and final CTA all confirmed rendering correctly with the new hierarchy.

- **Icon consistency fix (Aug 25, 2026)**: the 5 feature-card icons per program previously alternated colors (teal/yellow/cyan mix in Program 1, purple/coral mix in Program 2 — purple bg + navy icon had weak contrast). Now every icon box within a program uses one consistent color: teal bg + navy icon for all 5 Financial Literacy cards, coral bg + navy icon for all 5 Entrepreneurship Workshop cards. Verified via screenshot — good contrast, visually uniform per program.
  - Removed the yellow marker-underline beneath "understand money and think like builders." in the hero — headline is now plain colored text (coral), no underline decoration.

- **Hero image added on For Schools page (Aug 25, 2026)**: right side of the hero (previously left blank) now shows the "Young Entrepreneurs Pitch Day" classroom photo in a compact framed card (white bg, thick navy border, rounded-[28px], hard shadow, decorative yellow capsule accent on the edge) — matching the workshop page's photo-frame treatment. Sized `max-w-[380px]` aspect-square so it does not increase hero height. Verified via screenshot; note the two user-uploaded images had their artifact URLs initially swapped (cookie-photo vs pitch-day-photo) — corrected to use the actual Pitch Day photo.
  - Follow-up: removed the decorative yellow capsule accent to match the plain frame style used elsewhere, and increased image size (max-w 380px -> 460px) to use the available hero space.

- **Multi-grade Money Masters batches + clearer edit (Aug 26, 2026)**
  - Backend (`routes/subscriptions.py`): `BatchCreate`/`BatchUpdate` now take `grades: List[int]` instead of a single `grade` int. Create/update validate at least one grade, each 0-9. Parent-facing batch matching (`/money-masters/batches?child_id=`, `create-order`, `public-batches`) now checks child's grade against the `grades` array. Subscription record now stores the child's actual grade (was previously the batch's single grade field, no longer valid for multi-grade batches).
  - Frontend (`AdminSubscriptionManagement.jsx`): Grade single-select dropdown replaced with multi-select toggle chips (K..Grade 9), reusing the same chip pattern as the School Enquiry form. Batches table shows comma-separated grade labels. Edit already existed (PUT-based) but the icon was an ambiguous Save icon — swapped to a Pencil icon for clarity.
  - Frontend (`EntrepreneurshipWorkshopPage.jsx` public trial widget): batch-by-grade grouping and eligible-batch filtering updated to check `grades.includes(...)` instead of exact match.
  - Verified end-to-end via curl (create with 3 grades, edit to different 3 grades, confirmed in both admin and public listings, empty-grades validation rejected) + live screenshot of the multi-select chip UI in the admin dialog.
