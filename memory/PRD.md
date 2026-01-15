# MoneyHeros - Financial Literacy Learning App for Children

## Original Problem Statement
A gamified financial literacy learning application for children (K-5) with distinct user roles (Teacher, Parent, Child, Admin).

## What's Been Implemented

### Core MVP ✅
- User authentication (Google OAuth + Admin login)
- Role-based dashboards (Admin, Teacher, Parent, Child)
- Content management system
- Virtual store with categories and items
- Wallet system (Spending, Savings, Gifting jars)
- User connections (Parent-Child, Teacher-Classroom)
- Dynamic quest system (Admin, Teacher, Parent chores)
- Shopping list system for parents

### Money Garden System (Grade 1-2) ✅ (January 15, 2026)
**New visual farm-based investment system for younger children:**

- **Grade Restrictions:**
  - Kindergarten: No investments
  - Grade 1-2: Money Garden only
  - Grade 3-5: Stock Market (existing)

- **Farm Features:**
  - 2x2 starting grid (expandable at ₹20/plot)
  - Plant seeds purchased from seed shop
  - Visual growth stages: 🌱 → 🌿 → 🌿🌼 → 🍅
  - Watering system (free, must water on schedule or plant dies)
  - Water status indicators (green/yellow/red droplet)
  - Harvest ready state with sparkle animation
  - Inventory basket for harvested produce

- **Market System:**
  - Daily price fluctuations (±% set by admin)
  - Market hours: 9 AM - 6 PM
  - Sell produce from inventory

- **Admin Plant Management:**
  - Seed cost
  - Growth time (days)
  - Harvest yield (quantity + unit)
  - Base sell price
  - Price fluctuation percentage
  - Watering frequency (hours)

### API Endpoints

#### Money Garden (Child)
- GET /api/garden/farm - Get farm with plots, seeds, inventory
- POST /api/garden/buy-plot - Buy additional plot (₹20)
- POST /api/garden/plant - Plant a seed
- POST /api/garden/water/{plot_id} - Water plant
- POST /api/garden/water-all - Water all plants
- POST /api/garden/harvest/{plot_id} - Harvest ready plant
- POST /api/garden/sell - Sell produce at market

#### Admin Garden
- GET /api/admin/garden/plants - List all plants
- POST /api/admin/garden/plants - Create plant
- PUT /api/admin/garden/plants/{id} - Update plant
- DELETE /api/admin/garden/plants/{id} - Delete plant

### Files Created/Modified
- `/app/backend/server.py` - Money Garden models & endpoints
- `/app/frontend/src/pages/MoneyGardenPage.jsx` - Farm UI for children
- `/app/frontend/src/pages/AdminGardenManagement.jsx` - Admin plant config
- `/app/frontend/src/pages/Dashboard.jsx` - Grade-based nav items
- `/app/frontend/src/pages/AdminPage.jsx` - Garden management link
- `/app/frontend/src/App.js` - Routes for /garden, /admin/garden

## Credentials
- **Admin:** admin@learnersplanet.com / finlit@2026
- **Users:** Google Social Login

## Pending/Backlog

### P1 - High Priority
- [ ] Daily Login Rewards & Streak Bonuses
- [ ] Leaderboards
- [ ] Spending limits & parent approval

### P2 - Medium Priority
- [ ] Teacher/Parent collaboration portal
- [ ] Collaborative & seasonal events
- [ ] Avatar customization
- [ ] Email notifications
- [ ] Backend refactor
