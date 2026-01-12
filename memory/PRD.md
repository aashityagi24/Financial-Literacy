# PocketQuest - Financial Literacy Platform for K-5 Kids

## Original Problem Statement
Create a financial literacy gamified learning activity for children (K-5, ages 5-11) with teacher, parent and child login. Features include grade-level progression, classroom economy system, virtual wallet with spending/savings/investing/giving accounts, virtual store, investment simulations, mini-games, quest system, avatar customization, badges/achievements, daily login rewards, and educational guardrails.

**Key Requirement**: Learning comes FIRST - children learn about different financial literacy aspects (barter system, gold/silver coins, modern currency, needs vs wants, savings, spending, earning). Then they practice with the digital economy tools.

## User Personas
1. **Child (K-5 Students)**: Primary users who learn financial concepts through educational content then practice with gamified activities
2. **Parent**: Monitor child progress, set up chores, give digital rewards
3. **Teacher**: Set up classroom economies, track student progress, reward financial learning
4. **Admin**: Manage content (topics, lessons, books, activities), manage users, view platform statistics

## Core Requirements
- Google Social Login authentication
- Grade-level appropriate content (K-5)
- **Learning Content System** (primary focus)
  - Topics with structured lessons
  - Progress tracking per user
  - Quizzes with scoring
  - Books library
  - Real-world activities
- Digital wallet with 4 account types
- Virtual store for purchases
- Investment simulation (garden for K-2, stocks for 3-5)
- Quests and achievements system
- Daily login rewards and streaks
- AI chatbot for financial questions (Claude Sonnet 4.5)
- Admin dashboard for content management

## What's Been Implemented (December 2025)

### Phase 1: Core Platform
- ✅ User authentication with Emergent Google OAuth
- ✅ Session management with cookies
- ✅ User profiles with roles (child/parent/teacher/admin) and grades
- ✅ Wallet system with 4 accounts (spending, savings, investing, giving)
- ✅ Money transfer between accounts
- ✅ Transaction history
- ✅ Virtual store with items and purchases
- ✅ Investment system (garden plants for K-2, kid-friendly stocks for 3-5)
- ✅ Quests system (daily, weekly, challenges)
- ✅ Achievements/badges system
- ✅ Daily check-in with streak tracking
- ✅ AI Chat integration (Claude Sonnet 4.5)
- ✅ AI Financial Tips generation

### Phase 2: Learning Content System (NEW)
- ✅ **10 Learning Topics** with categories:
  - History: History of Money, The Barter System, Coins Through History
  - Concepts: Modern Currency, Needs vs Wants, Giving and Sharing
  - Skills: The Power of Saving, Smart Spending, Earning Money, Making a Budget
- ✅ **20 Lessons** with content:
  - Story-based lessons with markdown content
  - Interactive lessons
  - Quiz lessons with progress tracking
  - Age-appropriate content per grade
- ✅ **6 Books** library:
  - Recommended story books
  - Workbooks for practice
- ✅ **8 Activities** for real-world practice:
  - Coin sorting, needs vs wants collage
  - Savings tracker, price comparison
  - Barter simulation, currency design
  - Chore chart, budget practice
- ✅ Progress tracking per user/lesson/activity
- ✅ Coin rewards for completing lessons

### Phase 3: Admin Dashboard (NEW)
- ✅ Admin role enforcement
- ✅ Platform statistics (users, content, engagement)
- ✅ User management (view users, change roles)
- ✅ Content creation interfaces:
  - Create/delete topics
  - Create lessons with markdown content
  - Add books to library
  - Create activities with instructions
- ✅ Grade range settings for all content

### Frontend Pages
- ✅ Landing page with playful design
- ✅ Google OAuth login flow
- ✅ Role selection (child/parent/teacher)
- ✅ Child dashboard with quick navigation
- ✅ **Learn page** with Topics, Books, Activities tabs
- ✅ **Topic detail page** with lesson list
- ✅ **Lesson page** with content and completion
- ✅ Wallet page with transfers
- ✅ Store page with purchases
- ✅ Investment page (garden/stocks based on grade)
- ✅ Quests page with progress tracking
- ✅ Achievements gallery
- ✅ AI Chat buddy
- ✅ Profile management
- ✅ **Admin dashboard** (for admin users only)

### Design
- Child-friendly, colorful, playful cartoon-style
- Fredoka + Outfit fonts
- Colors: Yellow (#FFD23F), Blue (#3D5A80), Orange (#EE6C4D), Cyan (#E0FBFC)
- Thick borders, hard shadows, rounded corners

## Prioritized Backlog

### P0 (Complete) ✅
- Child role full experience
- Learning content system
- Admin content management

### P1 (Next Phase)
- Teacher dashboard with:
  - Classroom creation and management
  - Student progress tracking
  - Bulk reward distribution
  - Custom challenges/quests
- Parent dashboard with:
  - Child progress monitoring
  - Chore assignment
  - Allowance automation
  - Goal setting collaboration

### P2 (Future)
- Interactive mini-games
- Detailed avatar customization
- Class/Family leaderboards
- Seasonal events
- Email notifications
- Video lessons
- PDF workbook downloads

## Next Tasks
1. Implement Teacher Dashboard with classroom management
2. Implement Parent Dashboard with chore setup
3. Add video lesson support
4. Add downloadable PDF workbooks
5. Implement mini-games for earning coins
