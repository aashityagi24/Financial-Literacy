# PocketQuest - Financial Literacy Platform for K-5 Kids

## Original Problem Statement
Create a financial literacy gamified learning activity for children (K-5, ages 5-11) with teacher, parent and child login. Features include grade-level progression, classroom economy system, virtual wallet with spending/savings/investing/giving accounts, virtual store, investment simulations, mini-games, quest system, avatar customization, badges/achievements, daily login rewards, and educational guardrails.

## User Personas
1. **Child (K-5 Students)**: Primary users who learn financial concepts through gamified activities
2. **Parent**: Monitor child progress, set up chores, give digital rewards
3. **Teacher**: Set up classroom economies, track student progress, reward financial learning

## Core Requirements
- Google Social Login authentication
- Grade-level appropriate content (K-5)
- Digital wallet with 4 account types
- Virtual store for purchases
- Investment simulation (garden for K-2, stocks for 3-5)
- Quests and achievements system
- Daily login rewards and streaks
- AI chatbot for financial questions (Claude Sonnet 4.5)

## What's Been Implemented (December 2025)

### Backend (FastAPI + MongoDB)
- ✅ User authentication with Emergent Google OAuth
- ✅ Session management with cookies
- ✅ User profiles with roles (child/parent/teacher) and grades
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

### Frontend (React + Tailwind + Shadcn UI)
- ✅ Landing page with playful design
- ✅ Google OAuth login flow
- ✅ Role selection (child/parent/teacher)
- ✅ Child dashboard with quick navigation
- ✅ Wallet page with transfers
- ✅ Store page with purchases
- ✅ Investment page (garden/stocks based on grade)
- ✅ Quests page with progress tracking
- ✅ Achievements gallery
- ✅ AI Chat buddy
- ✅ Profile management

### Design
- Child-friendly, colorful, playful cartoon-style
- Fredoka + Outfit fonts
- Colors: Yellow (#FFD23F), Blue (#3D5A80), Orange (#EE6C4D), Cyan (#E0FBFC)
- Thick borders, hard shadows, rounded corners

## Prioritized Backlog

### P0 (MVP Complete) ✅
- Child role full experience

### P1 (Next Phase)
- Teacher dashboard implementation
- Parent dashboard implementation
- Classroom management for teachers
- Chore assignment for parents

### P2 (Future)
- Mini-games integration
- More detailed avatar customization
- Leaderboards
- Seasonal events
- Email notifications

## Next Tasks
1. Implement Teacher Dashboard with classroom management
2. Implement Parent Dashboard with chore setup
3. Add more interactive mini-games
4. Add detailed progress analytics
5. Implement collaborative class goals
