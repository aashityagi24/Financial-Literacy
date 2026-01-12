# PocketQuest - Financial Literacy Platform for K-5 Kids

## Original Problem Statement
Create a financial literacy gamified learning activity for children (K-5, ages 5-11) with teacher, parent and child login. Features include grade-level progression, classroom economy system, virtual wallet with spending/savings/investing/giving accounts, virtual store, investment simulations, mini-games, quest system, avatar customization, badges/achievements, daily login rewards, and educational guardrails.

**Key Requirement**: Learning comes FIRST - children learn about different financial literacy aspects (barter system, gold/silver coins, modern currency, needs vs wants, savings, spending, earning). Then they practice with the digital economy tools.

## User Personas
1. **Child (K-5 Students)**: Primary users who learn financial concepts through educational content then practice with gamified activities
2. **Parent**: Monitor child progress, set up chores, give digital rewards, manage allowances
3. **Teacher**: Set up classroom economies, track student progress, reward financial learning, create challenges
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
- **10 Learning Topics** with categories:
  - History: History of Money, The Barter System, Coins Through History
  - Concepts: Modern Currency, Needs vs Wants, Giving and Sharing
  - Skills: The Power of Saving, Smart Spending, Earning Money, Making a Budget
- **20 Lessons** with content:
  - Story-based lessons with markdown content
  - Interactive lessons
  - Quiz lessons with progress tracking
  - Age-appropriate content per grade
- **6 Books** library
- **8 Activities** for real-world practice
- Progress tracking per user/lesson/activity
- Coin rewards for completing lessons

### Phase 3: Admin Dashboard ✅
- Admin role enforcement
- Platform statistics (users, content, engagement)
- User management (view users, change roles)
- Content creation interfaces for topics, lessons, books, activities

### Phase 4: Teacher Dashboard ✅ (January 2026)
- **Classroom Management**:
  - Create/delete classrooms with auto-generated invite codes
  - Set grade level and description
  - View all classrooms with student counts
- **Student Tracking**:
  - View students in each classroom
  - See individual student balance, lessons completed, streak
  - View detailed student progress with topic breakdown
- **Reward System**:
  - Give rewards to individual or multiple students
  - Bulk reward distribution with custom reason
  - Automatic transaction recording
- **Challenge System**:
  - Create classroom challenges with rewards
  - Mark challenges as complete for individual students
  - Delete challenges

### Phase 5: Parent Dashboard ✅ (January 2026)
- **Child Linking**:
  - Link child accounts by email
  - View all linked children with summary stats
  - See pending chores count per child
- **Chore Management**:
  - Create chores with title, description, reward amount
  - Set frequency (once, daily, weekly)
  - Approve completed chores (auto-rewards child)
  - Delete chores
- **Allowance System**:
  - Set up recurring allowances (weekly, bi-weekly, monthly)
  - View all active allowances
  - Cancel allowances
- **Savings Goals**:
  - Create savings goals for children
  - Track progress toward goals
  - Goal completion tracking
- **Progress Monitoring**:
  - View child's full wallet breakdown
  - See learning progress by topic
  - View recent transactions
  - Monitor streak count
- **Quick Money Giving**:
  - Give money to child with custom reason
  - Automatic transaction recording

### Frontend Pages
- Landing page with playful design
- Google OAuth login flow
- Role selection (child/parent/teacher)
- Child dashboard with quick navigation
- Learn page with Topics, Books, Activities tabs
- Topic detail page with lesson list
- Lesson page with content and completion
- Wallet page with transfers
- Store page with purchases
- Investment page (garden/stocks based on grade)
- Quests page with progress tracking
- Achievements gallery
- AI Chat buddy
- Profile management
- Admin dashboard (for admin users only)
- **Teacher Dashboard** with full classroom management
- **Parent Dashboard** with chore/allowance management

### Design
- Child-friendly, colorful, playful cartoon-style
- Fredoka + Outfit fonts
- Colors: Yellow (#FFD23F), Blue (#3D5A80), Orange (#EE6C4D), Cyan (#E0FBFC)
- Thick borders, hard shadows, rounded corners

## API Endpoints

### Teacher Endpoints
- `GET /api/teacher/dashboard` - Get teacher dashboard data
- `POST /api/teacher/classrooms` - Create classroom
- `GET /api/teacher/classrooms` - List classrooms
- `GET /api/teacher/classrooms/{id}` - Get classroom details
- `DELETE /api/teacher/classrooms/{id}` - Delete classroom
- `POST /api/teacher/classrooms/{id}/reward` - Give rewards to students
- `POST /api/teacher/classrooms/{id}/challenges` - Create challenge
- `DELETE /api/teacher/challenges/{id}` - Delete challenge
- `POST /api/teacher/challenges/{id}/complete/{student_id}` - Complete challenge for student
- `GET /api/teacher/students/{id}/progress` - Get student progress

### Parent Endpoints
- `GET /api/parent/dashboard` - Get parent dashboard data
- `POST /api/parent/link-child` - Link child account
- `GET /api/parent/children` - Get linked children
- `GET /api/parent/children/{id}/progress` - Get child progress
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

## Prioritized Backlog

### P0 (Complete) ✅
- Child role full experience
- Learning content system
- Admin content management
- Teacher Dashboard with classroom management
- Parent Dashboard with chore/allowance management

### P1 (Next Phase)
- Interactive mini-games for earning coins
- Detailed avatar customization
- Class/Family leaderboards
- Child ability to complete chores (mark as done)
- Student join classroom with invite code
- Chore approval workflow improvements

### P2 (Future)
- Video lessons
- PDF workbook downloads
- Email notifications
- Seasonal events
- Teacher/Parent communication portal
- Spending limits and parent approval for large transactions

## Test Coverage
- Backend: 28 tests passing (100%)
- Frontend: All UI components working
- Test file: `/app/tests/test_teacher_parent_dashboards.py`
