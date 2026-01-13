# PocketQuest - Financial Literacy Platform for K-5 Kids

## Original Problem Statement
Create a financial literacy gamified learning activity for children (K-5, ages 5-11) with teacher, parent and child login. Features include grade-level progression, classroom economy system, virtual wallet with spending/savings/investing/giving accounts, virtual store, investment simulations, mini-games, quest system, avatar customization, badges/achievements, daily login rewards, and educational guardrails.

**Key Requirement**: Learning comes FIRST - children learn about different financial literacy aspects (barter system, gold/silver coins, modern currency, needs vs wants, savings, spending, earning). Then they practice with the digital economy tools.

**Localization**: Indian Rupees (₹) used throughout the platform instead of generic "coins"

## User Personas
1. **Child (K-5 Students)**: Primary users who learn financial concepts through educational content then practice with gamified activities
2. **Parent**: Monitor child progress, set up chores, give digital rewards, manage allowances
3. **Teacher**: Set up classroom economies, track student progress, reward financial learning, create challenges
4. **Admin**: Manage content (topics, lessons, books, activities), manage users, view platform statistics

## Core Requirements
- Google Social Login authentication for regular users
- **Admin email/password authentication** (admin@learnersplanet.com / finlit@2026)
- Grade-level appropriate content (K-5)
- **Hierarchical Content System** (primary focus)
  - Topics → Subtopics → Content Items
  - Content types: Lessons, Books, Worksheets (PDF), Activities (HTML)
  - **All content types support both PDF and HTML uploads**
  - Thumbnails for topics, subtopics, and content (with recommended dimensions)
  - Admin ordering/sorting
  - Progress tracking per user
- Digital wallet with 4 account types (balances in ₹)
- Virtual store for purchases
- Investment simulation (garden for K-2, stocks for 3-5)
- Quests and achievements system
- Daily login rewards and streaks
- AI chatbot for financial questions (Claude Sonnet 4.5)
- Admin dashboard for content management
- **Teacher Dashboard** for classroom management
- **Parent Dashboard** for chore/allowance management

## What's Been Implemented (December 2025 - January 2026)

### Phase 1: Core Platform ✅
- User authentication with Emergent Google OAuth
- Session management with cookies
- User profiles with roles (child/parent/teacher/admin) and grades
- Wallet system with 4 accounts (spending, savings, investing, giving)
- Money transfer between accounts
- Transaction history
- Virtual store with items and purchases
- Investment system (garden plants for K-2, kid-friendly stocks for 3-5)
- Quests system (daily, weekly, challenges)
- Achievements/badges system
- Daily check-in with streak tracking
- AI Chat integration (Claude Sonnet 4.5)
- AI Financial Tips generation

### Phase 2: Learning Content System ✅
- **Legacy System**: 10 Topics, 20 Lessons, 6 Books, 8 Activities
- Progress tracking per user/lesson/activity
- Coin rewards for completing lessons

### Phase 3: Admin Dashboard ✅
- Admin role enforcement
- **Admin email/password login** (admin@learnersplanet.com / finlit@2026)
- Platform statistics (users, content, engagement)
- User management (view users, change roles)
- Content creation interfaces (legacy system)

### Phase 4: Teacher Dashboard ✅ (January 2026)
- **Classroom Management**: Create/delete classrooms, invite codes, grade levels
- **Student Tracking**: View students, balances, progress
- **Reward System**: Give rewards to individual or multiple students
- **Challenge System**: Create challenges with rewards

### Phase 5: Parent Dashboard ✅ (January 2026)
- **Child Linking**: Link child accounts by email
- **Chore Management**: Create, approve, delete chores
- **Allowance System**: Set up recurring allowances
- **Savings Goals**: Create and track savings goals
- **Progress Monitoring**: View child's wallet, learning progress

### Phase 6: Hierarchical Content System ✅ (January 2026)
- **Topic Hierarchy**: Parent topics → Subtopics structure
- **Content Types** (5 types):
  - Worksheets (PDF upload and viewer)
  - Activities (HTML zip upload and iframe viewer)
  - Books (reading materials with external links)
  - Workbooks (PDF exercises)
  - Videos (embedded video content)
- **Unified Content Uploads**: All content types support both PDF and HTML (ZIP) uploads
- **Thumbnail Support**: Upload thumbnails for topics, subtopics, content
  - Recommended dimensions displayed in UI
  - Topics: 400×300px, Subtopics: 320×240px, Content: 320×180px
- **Publish Toggle**: Draft/Live status for each content item
- **Ordering System**: Admin can reorder topics and content items
- **File Uploads**:
  - `/api/upload/thumbnail` - Image uploads for thumbnails
  - `/api/upload/pdf` - PDF uploads for worksheets/workbooks
  - `/api/upload/activity` - ZIP uploads for HTML activities
- **Admin Content Management UI** (`/admin/content`) - Redesigned with 4-step workflow:
  1. **Topics Tab** - Create and manage main learning topics
  2. **Subtopics Tab** - Add subtopics under selected topic
  3. **Lesson Plan Tab** - Order content, toggle publish status
  4. **Add Content Tab** - Upload content by selecting type
- **User Learn Page**: Shows hierarchical topics with subtopic preview
- **User Topic Page**: PDF viewer modal, Activity iframe viewer
- **Content Visibility**: Only published content visible to users

### Phase 7: UI/UX Improvements ✅ (January 13, 2026)
- **Currency Localization**: Changed ALL "coins" and "$" references to "₹" (Indian Rupees) across entire platform:
  - Dashboard, Wallet, Store, Quests, Investments pages
  - Teacher Dashboard (student balances, challenge rewards)
  - Parent Dashboard (chore rewards, allowances, child balances)
  - All toast messages and notifications
- **Thumbnail Display Fix**: Added `getAssetUrl()` helper function to properly construct full URLs for uploaded assets
- **CORS Fix**: Updated backend CORS configuration to support credentials from localhost and preview domain
- **Wallet Labels for Children**: Added child-friendly descriptions to wallet account types:
  - Spending: "Money to buy things"
  - Savings: "Money saved for later"
  - Investing: "Money that grows"
  - Giving: "Money to help others"

### Phase 8: Store Redesign ✅ (January 13, 2026)
- **Category Sections**: Redesigned store with 5 realistic shopping categories:
  - 🥕 Vegetable Market (carrots, tomatoes, broccoli, corn, potatoes)
  - 🍎 Fruit Market (apples, bananas, oranges, grapes, watermelon, mango)
  - 🧸 Toy Store (balls, teddy bears, cars, dolls, robots, puzzles, kites)
  - 📱 Electronics (watches, headphones, cameras, tablets, game consoles)
  - 🍕 Restaurant (pizza, burgers, ice cream, cake, noodles, sandwiches)
- **Grade-Appropriate Items**: 30+ items filtered by user grade (min_grade field)
- **Category Filter**: Tab-based category navigation at top of store
- **Realistic Pricing**: Items priced in ₹ from ₹5 to ₹200
- **Shopping Tips**: Educational tips about smart shopping for children

### Phase 9: Wallet & Thumbnail Improvements ✅ (January 13, 2026)
- **Wallet Action Buttons**: Added navigation buttons to each account card:
  - Spending: "Go to Store →" links to /store
  - Savings: "Set Goal →" links to /quests
  - Investing: "Go Invest →" links to /investments
  - Giving: "Give ₹ →" links to /quests
- **Wallet Card Styling Fix**: Fixed gradient backgrounds not showing due to CSS class conflict
- **Thumbnail Image Fix**: Changed all thumbnails from `object-cover` to `object-contain` with white background to prevent cropping:
  - LearnPage topic thumbnails
  - TopicPage subtopic and content thumbnails
  - ContentManagement admin thumbnails

### Phase 10: Child-Friendly Explanatory Banners ✅ (January 13, 2026)
- **Yellow Explanation Banners**: Added prominent yellow banners (gradient #FFD23F to #FFEB99) to key pages explaining what each section does in child-friendly language:
  - **Wallet**: "Welcome to Your Wallet!" - explains digital piggy bank and 4 money jars concept
  - **Investment/Money Garden**: "What is the Money Garden?" / "What is the Stock Market?" - explains growing money over time
  - **Store**: "How Does the Store Work?" - explains practice shopping and spending wisely
  - **Quests**: "What Are Quests?" - explains missions and earning ₹
  - **Learn**: "How Does Learning Work?" - explains topics, lessons, and earning ₹
- **Dashboard Updates**: 
  - Renamed "My Wallet" to "My Money Jars" with subtitle explanation
  - Made wallet account cards clickable (link to /wallet page)
- **Age-Appropriate Language**: All text uses simple words and concepts K-5 children can understand

### Phase 11: Admin Store & Investment Management ✅ (January 13, 2026)
- **Admin Store Management** (`/admin/store`):
  - Categories CRUD: Create, edit, delete store categories
  - Category fields: name, description, icon (emoji), color, image, order, active status
  - Items CRUD: Create, edit, delete store items
  - Item fields: category, name, description, price (₹), image, min/max grade, stock, active status
  - Image upload support for categories and items
  - Filter items by category
  - Table view for items with all details
- **Admin Investment Management** (`/admin/investments`):
  - **Plants (for K-2 children)**:
    - Plant CRUD: Create, edit, delete plants for Money Garden
    - Plant fields: name, description, image, base price, growth rate (min/max), lot size, maturity days, active status
  - **Stocks (for 3-5 children)**:
    - Stock CRUD: Create, edit, delete fictional companies
    - Stock fields: company name, ticker symbol, description, logo, base price, current price, volatility, lot size, active status
    - Price history tracking with date/price records
    - View price history dialog
  - **Simulate Market Day**: Button to apply random price changes to all stocks based on their volatility settings
- **CSS Gradient Fix**: Fixed `.card-playful` class to allow gradient backgrounds when combined with `bg-gradient-*` classes
- **Admin Dashboard Navigation**: Added colorful gradient cards for Store Management (orange) and Investment Management (green)

### Phase 12: Child-Facing Store & Investment Integration ✅ (January 13, 2026)
- **Store Page Revamp** (`/store`):
  - Now fetches ONLY admin-created categories and items (removed all hardcoded sample data)
  - Shows "Store Coming Soon!" message when no items exist
  - Category tabs for filtering items
  - Items display price with unit suffix (₹50/kg, ₹100/piece, etc.)
  - Grade-appropriate filtering (children only see items for their grade level)
- **Investment Page Revamp** (`/investments`):
  - Now fetches ONLY admin-created plants (K-2) and stocks (grades 3-5)
  - Shows "Money Garden Coming Soon!" or "Stock Market Coming Soon!" when no assets exist
  - Fixed portfolio display to use correct API response structure (holdings array)
  - Fixed buy/sell API calls to use correct field names (investment_type, holding_id)
  - Shows asset images/logos from admin uploads
- **Store Item Units**: Added unit field with dropdown options (piece, kg, gram, litre, ml, pack, dozen)
- **API Grade Filtering Fix**: Store API now returns all items for admin users (who have null grade)

## API Endpoints

### Admin Store Management (New - Phase 11)
- `POST /api/upload/store-image` - Upload image for store items/categories
- `GET /api/admin/store/categories` - Get all store categories
- `POST /api/admin/store/categories` - Create store category
- `PUT /api/admin/store/categories/{id}` - Update store category
- `DELETE /api/admin/store/categories/{id}` - Delete store category
- `GET /api/admin/store/items` - Get all store items
- `POST /api/admin/store/items` - Create store item
- `PUT /api/admin/store/items/{id}` - Update store item
- `DELETE /api/admin/store/items/{id}` - Delete store item

### Admin Investment Management (New - Phase 11)
- `POST /api/upload/investment-image` - Upload image for plants/stocks
- `GET /api/admin/investments/plants` - Get all plants (Money Garden)
- `POST /api/admin/investments/plants` - Create plant
- `PUT /api/admin/investments/plants/{id}` - Update plant
- `DELETE /api/admin/investments/plants/{id}` - Delete plant
- `GET /api/admin/investments/stocks` - Get all stocks
- `POST /api/admin/investments/stocks` - Create stock
- `PUT /api/admin/investments/stocks/{id}` - Update stock
- `DELETE /api/admin/investments/stocks/{id}` - Delete stock
- `GET /api/admin/investments/stocks/{id}/history` - Get stock price history
- `POST /api/admin/investments/simulate-day` - Simulate market day (price fluctuations)

### User Investment Endpoints (New - Phase 11)
- `GET /api/investments/plants` - Get available plants for user
- `GET /api/investments/stocks` - Get available stocks for user
- `GET /api/investments/stocks/{id}/chart` - Get stock chart data
- `GET /api/investments/portfolio` - Get user's investment portfolio
- `POST /api/investments/buy` - Buy plant seeds or stock shares
- `POST /api/investments/sell` - Sell plants or stocks

### User Store Endpoints (New - Phase 11)
- `GET /api/store/categories` - Get active store categories
- `GET /api/store/items-by-category` - Get store items grouped by category

### Content Management (New System)
- `POST /api/upload/thumbnail` - Upload thumbnail image
- `POST /api/upload/pdf` - Upload PDF for worksheet
- `POST /api/upload/activity` - Upload ZIP for HTML activity
- `GET /api/content/topics` - Get hierarchical topics for users
- `GET /api/content/topics/{id}` - Get topic with subtopics and content
- `GET /api/content/items/{id}` - Get single content item
- `POST /api/content/items/{id}/complete` - Mark content complete, award ₹
- `GET /api/admin/content/topics` - Admin get all topics
- `POST /api/admin/content/topics` - Create topic/subtopic
- `PUT /api/admin/content/topics/{id}` - Update topic
- `DELETE /api/admin/content/topics/{id}` - Delete topic (cascade)
- `POST /api/admin/content/topics/reorder` - Reorder topics
- `GET /api/admin/content/items` - Get all content items
- `POST /api/admin/content/items` - Create content item
- `PUT /api/admin/content/items/{id}` - Update content item
- `DELETE /api/admin/content/items/{id}` - Delete content item
- `POST /api/admin/content/items/reorder` - Reorder content

### Teacher Endpoints
- `GET /api/teacher/dashboard` - Get teacher dashboard data
- `POST /api/teacher/classrooms` - Create classroom
- `GET /api/teacher/classrooms` - List classrooms
- `GET /api/teacher/classrooms/{id}` - Get classroom details
- `DELETE /api/teacher/classrooms/{id}` - Delete classroom
- `POST /api/teacher/classrooms/{id}/reward` - Give rewards
- `POST /api/teacher/classrooms/{id}/challenges` - Create challenge
- `DELETE /api/teacher/challenges/{id}` - Delete challenge
- `POST /api/teacher/challenges/{id}/complete/{student_id}` - Complete challenge

### Parent Endpoints
- `GET /api/parent/dashboard` - Get parent dashboard
- `POST /api/parent/link-child` - Link child account
- `GET /api/parent/children` - Get linked children
- `POST /api/parent/chores` - Create chore
- `GET /api/parent/chores` - Get all chores
- `POST /api/parent/chores/{id}/approve` - Approve chore
- `DELETE /api/parent/chores/{id}` - Delete chore
- `POST /api/parent/allowance` - Set up allowance
- `GET /api/parent/allowances` - Get allowances
- `DELETE /api/parent/allowances/{id}` - Cancel allowance
- `POST /api/parent/give-money` - Give money to child
- `POST /api/parent/savings-goals` - Create savings goal
- `GET /api/parent/savings-goals` - Get savings goals

## Database Collections

### Admin Store Management (New - Phase 11)
- **admin_store_categories**: {`category_id`, `name`, `description`, `icon`, `color`, `image_url`, `order`, `is_active`}
- **admin_store_items**: {`item_id`, `category_id`, `name`, `description`, `price`, `image_url`, `min_grade`, `max_grade`, `stock`, `is_active`}

### Admin Investment Management (New - Phase 11)
- **investment_plants**: {`plant_id`, `name`, `description`, `image_url`, `base_price`, `growth_rate_min`, `growth_rate_max`, `min_lot_size`, `maturity_days`, `is_active`}
- **investment_stocks**: {`stock_id`, `name`, `ticker`, `description`, `logo_url`, `base_price`, `current_price`, `volatility`, `min_lot_size`, `is_active`, `price_history`}
- **user_investments**: {`investment_id`, `user_id`, `asset_type` (plant/stock), `asset_id`, `quantity`, `purchase_price`, `purchase_date`}

### New Content System
- **content_topics**: {`topic_id`, `title`, `description`, `parent_id`, `thumbnail`, `order`, `min_grade`, `max_grade`}
- **content_items**: {`content_id`, `topic_id`, `title`, `description`, `content_type`, `thumbnail`, `order`, `min_grade`, `max_grade`, `reward_coins`, `content_data`}
- **user_content_progress**: {`user_id`, `content_id`, `completed`, `score`, `completed_at`}

### Other Collections
- **users**: {`user_id`, `email`, `name`, `role`, `grade`, `avatar`, `streak_count`}
- **wallet_accounts**: {`user_id`, `account_type`, `balance`}
- **transactions**: {`user_id`, `type`, `amount`, `description`}
- **classrooms**: {`teacher_id`, `name`, `grade`, `invite_code`, `students`}
- **chores**: {`parent_id`, `child_id`, `description`, `reward`, `status`}
- **allowances**: {`parent_id`, `child_id`, `amount`, `frequency`}

## Test Coverage
- Backend: 30 tests passing (100%) - `/app/tests/test_admin_store_investment.py` (Admin Store & Investment)
- Backend: 26 tests passing (100%) - `/app/tests/test_content_management.py` (Content Management)
- Previous tests: 28 tests for Teacher/Parent dashboards

## Prioritized Backlog

### P0 (Complete) ✅
- Child role full experience
- Learning content system (single hierarchical system)
- Admin content management (single unified system - legacy removed)
- Teacher Dashboard
- Parent Dashboard
- **Hierarchical Content Management System**
- **Currency Localization (₹)**
- **Thumbnail Display Fix**
- **Unified Content Uploads (PDF/HTML for all types)**
- **Admin Store Management** (categories, items CRUD, image upload)
- **Admin Investment Management** (plants for K-2, stocks for 3-5, price history, market simulation)

### P1 (Next Phase)
- Daily Login Rewards & Streak Bonuses
- Leaderboards
- Safety Guardrails (spending limits, parent approval)
- Interactive mini-games for earning ₹
- Detailed avatar customization
- Child ability to complete chores (mark as done)
- Student join classroom with invite code

### P2 (Future)
- Teacher/Parent collaboration portal
- Seasonal events & classroom goals
- Avatar customization shop
- Email notifications
- Tutorial system for new users
