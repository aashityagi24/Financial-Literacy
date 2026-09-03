# CoinQuest - Financial Literacy Learning App for Children

## Original Problem Statement
A gamified financial literacy learning application for children (K-5) with distinct user roles (Teacher, Parent, Child, Admin). Features include a digital wallet, virtual store, gamified investment modules (Money Garden & Stock Market), dynamic quests, achievements, and hierarchical content system. Currency: Indian Rupees (₹).

## What's Been Implemented

### Core MVP ✅
- User authentication (Custom Google OAuth + Admin login + School login)
- Role-based dashboards (Admin, Teacher, Parent, Child)
- **Email-less child accounts** — children without email IDs can be onboarded via **username + password**:
  - Admin: dedicated "Add Child (No Email)" button with auto-suggest username + auto-generated password (one-time display)
  - Parent: "Add Child (No Email)" button that creates the child and auto-links it to the parent
  - School CSV bulk upload: new optional `username` and `password` columns; when both are blank along with `email`, the system auto-generates credentials and surfaces them in the upload result (downloadable as CSV)
  - Login already supported username + password — children sign in with their username
- Test users — admin can create or flag any existing child as a `test_user`; all topics, subtopics and content are visible and unlocked for them. Any active **1-day subscription** auto-treats the user as a test user (longer plans keep progressive unlock).
- **Download anti-piracy throttle** — paid 1-day-plan subscribers are capped at **5 downloadable assets per account**; the 6th request returns HTTP 403 with an upgrade prompt. Admin-flagged test users are exempt. Each download is recorded in `user_downloads` for auditing.
- **Trial UX (1-day plan)**:
  - Persistent slim banner at the top of every authenticated page showing `X of 5 downloads left` with a one-click **Upgrade** button that opens the full pricing flow inline.
  - First-time educational toast when a trial user opens any downloadable content explaining the remaining allowance.
  - When the user hits 5/5, a focused modal explains the trial cap with the exact copy *"As part of the 1-day subscription plan, you can download up to 5 pieces of content so you get a chance to explore the platform. To access all content without any restrictions, please subscribe to a longer plan."* — the dialog has a "See Upgrade Plans" CTA and an explicit Close action (can't dismiss by clicking outside).
  - Download button on the content viewer becomes a locked-orange "5/5" badge that opens the same modal on click.
- Content management system with drag-and-drop reordering — fully **grade-specific** when a grade filter is applied. Per-grade overrides on topics/subtopics (orders, parents, titles/descriptions/thumbnails).
- **Grade-scoped "Move to" for content items (fixed June 11, 2026)**: when a grade filter is active, moving a content item to another subtopic via the Move dialog now sends `grade` to `POST /api/admin/content/items/{id}/move`, writing to `grade_parents.<grade>`/`grade_orders.<grade>` only — other grades keep the original placement. Both Move dialogs (subtopic + content) now show an amber note when a grade filter is active (`data-testid="move-content-grade-note"`, `move-subtopic-grade-note`).
- Multi-admin background sync — every admin management page polls every 15s and on window focus.
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


### Content Management — Multi-Curriculum Placement (Aug 26, 2026) ✅
- Topics/Subtopics/Content items can belong to 2+ curricula. The FIRST ticked curriculum is the item's "home" (uses its own `parent_id`/`topic_id` + `min_grade`/`max_grade`). Every OTHER ticked curriculum gets a `curriculum_overrides.<curriculum_id> = { parent_id, min_grade, max_grade }` entry via a new "Placement for &lt;Curriculum&gt;" box in the admin dialogs (Topic: grade range only; Subtopic: Topic picker + grade range; Content: cascading Topic→Subtopic picker + grade range). Placement pickers only list topics/subtopics already tagged with that curriculum (with an amber warning if none exist yet), and saving is blocked with a toast until a placement is chosen.
- Admin Content Management tree view (`ContentManagement.jsx`), when filtered by the Curriculum dropdown, grafts subtopics/content under their curriculum-specific placement instead of the default one (mirrors the existing per-grade `grade_parents` grafting pattern).
- Backend (`routes/content.py`): `curriculum_overrides` persisted on create/update for `content_topics` and `content_items`, treated as a structural field (always saved globally, like `min_grade`/`max_grade`, even when a per-grade override save is in progress).
- **Scope note**: this is Phase 1 (admin authoring + admin tree only). The live child/parent/teacher-facing delivery pipeline (`get_all_topics`/`get_topic_detail` in `content.py`) does NOT yet resolve `curriculum_overrides` — real learners still see items at their default/home placement regardless of secondary-curriculum placement. Phase 2 (making live delivery curriculum-aware) is a deferred follow-up, flagged to the user as higher-risk since it touches the progressive-unlock/grade-gating query logic.

### Parent "Add Child" Grade Cap (Sep 3, 2026) ✅
- Financial Literacy content is currently live only up to Grade 3. Parent's "Link a Child" → "New (no email)" tab (`ParentDashboard.jsx`) now only offers Kindergarten–3rd Grade, with a note explaining why.
- Backend (`routes/parent.py` `/parent/create-child`) rejects grade 4+ with 400 "Financial Literacy content is currently live only up to 3rd Grade" — enforced server-side, not just UI.
- Scope: parent-only flow. Admin/school child creation and Money Masters batch grade pickers (K-9) are untouched per user's explicit instruction. Existing children already at grade 4/5 are unaffected.
- Self-tested via curl (grade 4 rejected, grade 3 accepted) + screenshot of the capped dropdown; test data cleaned up.

### Referral Codes (Aug 31, 2026) ✅
- Admin → Subscription Management → "Referral Codes" tab: create/list/edit/toggle-active/delete codes. Each code has a discount % (dropdown: 10/15/20/25/30/35/50 only) and applies to one or more targets — platform subscription plans (`plan_type`+`duration` combos) and/or Money Masters batches. One code can span multiple plans/batches at once.
- Backend (`routes/subscriptions.py`): `db.referral_codes` collection; `_resolve_referral_discount()` re-validates the code server-side (never trusts client-computed amounts) inside both `/subscriptions/create-order` and `/subscriptions/money-masters/create-order`. Wrong/nonexistent code → 400 "This referral code does not exist"; valid code not applicable to the chosen plan/batch → 400 "This referral code isn't valid for this plan". `usage_count` increments only on successful `/verify-payment` (not on order creation) so it reflects paid conversions.
- Checkout UX: platform checkout (`PricingSection.jsx`) and Money Masters purchase (`MoneyMastersPurchase.jsx`, inside Parent Dashboard) both have an optional referral code field; invalid/inapplicable codes surface the exact backend error via toast before Razorpay opens.
- Tested by testing_agent (iteration_106): 34/34 backend pytest cases pass + full frontend flow verified (admin CRUD, both checkout paths, cross-target code applying to a platform plan AND a batch simultaneously). Minor unaddressed enhancement: the built `/validate-referral-code` endpoint isn't wired to a live "Apply"/discount-preview button pre-payment (deferred, optional UX polish).

## Current Architecture Snapshot (Aug 23, 2026)
- Roles: child, parent, teacher, school (admin), admin.
- Learning hierarchy: Topic → Subtopic → Content Item, grade-scoped, progressive unlock.
- Curricula: `financial_literacy` (default) and `money_entrepreneurship` (Money Masters & Entrepreneurship). Schools enable curricula via `enabled_curricula`; D2C users' curricula are derived from their own active subscriptions (`services/curricula.py get_active_curricula`).
- Subscriptions (`db.subscriptions`): base plans (`single_parent`/`two_parents`/`admin_granted`, duration-based, keyed by `parent_emails`) and standalone Money Masters batch subscriptions (`plan_type='money_masters'`, keyed by `child_user_ids` + `parent_emails`, `end_date` = the batch's own end date). Razorpay create-order/verify-payment shared across both.
- Money Masters batches (`db.money_masters_batches`): admin-managed, per-grade, dated, priced cohorts — buying one includes that batch's live classes and curriculum content, no base plan required.
- Live Classes (`db.live_classes`): admin-managed dated sessions, grade-range + curriculum scoped, visible to child/parent only.
- See `CHANGELOG.md` for the full chronological implementation log and `ROADMAP.md` for the prioritized backlog.
