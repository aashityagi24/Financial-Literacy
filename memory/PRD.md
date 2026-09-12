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

### Homepage Polish — Scroll, Badge, Exit-Intent Popup (Sep 6, 2026) ✅
- Nav "Pricing"/"How It Works" scroll now uses a custom eased scroll (`utils/smoothScroll.js`, 1100ms duration, easeInOutQuad) instead of native `scrollIntoView({behavior:'smooth'})` — feels like a natural glide instead of an instant jump.
- Removed the "FINANCIAL LITERACY PLATFORM" pill badge from the hero section (redundant now that this page IS the homepage).
- New `ExitIntentPopup.jsx` on the homepage: shows a "Wait — Don't Miss Out! Try for ₹49" modal once per browser session, triggered by `mouseleave` at the top of the viewport (desktop exit-intent) with a 45s time-based fallback for mobile (no mouse events). CTA dispatches the existing `coinquest:buy-now` event (same mechanism as "Start for ₹49") to open the 1-day checkout directly.
- Self-tested via screenshots: badge gone, scroll visibly gradual (partial-scroll frame captured mid-animation), popup fires on exit-intent, "Try for ₹49" opens checkout pre-filled with the 1-day/₹49 plan, popup doesn't re-trigger twice per session.
- **Popup redesign (Feb 2026)**: Rebuilt from a plain white dialog into a colorful split-layout card per `design_agent` guidelines (`/app/design_guidelines.json`) — left panel: purple/mint organic blob background with `hero-earner.png` + rotated "₹49 / 1 Day" price pill; right panel: purple "Wait! Before you go" eyebrow pill, Fredoka headline "Give Your Child the Gift of Money Smarts!", 3-point checkmark benefit list, offset-shadow coral CTA "Try for ₹49 Today". New data-testids: `exit-intent-eyebrow`, `exit-intent-headline`, `exit-intent-price-tag`, `exit-intent-features`. Self-tested via screenshot: renders correctly, CTA opens checkout, doesn't re-trigger same session.
- **Popup illustration swap (Feb 2026)**: Replaced `hero-earner.png` with a user-provided cutout illustration (`/app/frontend/src/public/exit-popup-girl.png` — girl holding a coin and piggy bank, transparent PNG) and enlarged it (w-48→w-64 responsive) to properly fill the left blob panel top-to-bottom. Left panel widened to 44% and min-height increased (260px mobile / 420px desktop) to fit the taller portrait image. Self-tested via screenshot.

### Marketing Site Restructure — Platform as Homepage (Sep 6, 2026) ✅
- Retired the old dual-chooser `LandingPage.jsx` as the homepage (file kept on disk, unrouted — not deleted). `/` now renders `FinancialLiteracyPage.jsx` directly; `/financial-literacy` is a client-side redirect (`<Navigate to="/" replace />`) for old links.
- `SiteHeader.jsx`: removed the Workshop/Platform/For Schools nav buttons (those two pages are now footer-only, reachable but hidden from nav). Nav order: "How It Works" then "Pricing" (swapped Feb 2026 per user request) — scroll to `#how-it-works` (the "CoinQuest in Action" video section) / `#pricing` on the home page; from other pages (Workshop, For Schools) clicking them navigates home first, then scrolls. CTA stays contextual per path.
- New shared `SiteFooter.jsx` (replacing 3 duplicated inline `<footer>` blocks in FinancialLiteracyPage/EntrepreneurshipWorkshopPage/ForSchoolsPage) with a "Quick Links" column linking to all 3 public pages — this is where Workshop & For Schools now live for discovery.
- Session-expired toast + `no_subscription` handling moved from the old `LandingPage.jsx` into `FinancialLiteracyPage.jsx` since that logic's redirect target is now the homepage.
- Tested by testing_agent (iteration_107): 25+ checks passed, no bugs. Minor note (not fixed): header's cross-page scroll uses a fixed 400ms timeout rather than a mount-detection retry — acceptable for now.

### Coins → XP Rebrand (Feb 2026)
- Renamed the in-game play currency ("coins") to "XP" across the entire app, display-layer only (backend field names like `reward_coins`, `coins_earned`, `wallet_source='coinquest'`, `account_type='spending'` intentionally left unchanged — text/label/icon rename only, confirmed with user).
- Scope: XP is now the ONLY currency shown for `spending` + `investing` wallet_accounts — Store purchases, Money Garden (seeds/harvest/garden money), Lending/Borrowing (100% XP), Stock Market (portfolio/trades), lesson/quiz/quest/streak/badge/teacher-challenge rewards. "CoinQuest Wallet" UI label renamed to "My XP" (icon 🎮/Coins→⚡/Zap, HandCoins→Handshake for Lending).
- Real money (`my_wallet` — parent chores, payday jobs, allowances, parent gifts) stays ₹ and is UNCHANGED. Piggy Bank (savings) & Giving Jar (gifting) stay ₹ (funded primarily from real money) except the Giving Jar's "spending" transfer-source option which shows "My XP" + XP unit.
- QuestsPage.jsx has a MIX: parent-created chores (`quest.creator_type === 'parent'`) credit `my_wallet` and display ₹; all other quests (admin/teacher/"CoinQuest") credit `spending` and display XP — conditional logic added per-quest.
- MyJobsPage.jsx: swapped Coins icon → IndianRupee icon for Payday Jobs since those are real money, not XP.
- Tested: backend regression suite `/app/backend/tests/test_xp_relabel_regression.py` (10/10 pass) + testing_agent (iteration_108) found 3 display bugs (MoneyGardenPage, LessonPage toast, QuestsPage non-conditional pills) — all fixed and self-verified via screenshots + pytest rerun.

### Parent Chore Reward Type Choice (Feb 2026)
- Added a "Reward Type" toggle (₹ Real Money / ⚡ XP) to the parent's Create Chore flow (both the Quick Add modal's Chore tab and the full-page Create Chore dialog in ParentDashboard.jsx), defaulting to "Real Money" to preserve prior behavior.
- Backend: `ChoreCreate` model gained `reward_type: str = "money"`; `/parent/chores-new` stores it on the chore doc; `/parent/chore-requests/{id}/validate` (approval) now branches — `reward_type == "xp"` credits the child's `spending` account (My XP) with `wallet_source: "coinquest"`, otherwise credits `my_wallet` (real money, pending settlement) exactly as before. Recurring chore re-creation carries `reward_type` forward automatically (full doc spread).
- Notification message and QuestsPage.jsx display now correctly show "₹{amount}" for money chores and "{amount} XP" for XP chores — added a `formatReward(quest, amount)` helper (checks `creator_type === 'parent' && reward_type !== 'xp'`) replacing the old blanket `creator_type === 'parent'` check; same helper pattern applied to Dashboard.jsx's Quests preview widget.
- Verified end-to-end via curl: created one XP chore (+30) and one money chore (+15), approved both — `coinquest_balance` (XP) increased by exactly 30 and `my_wallet_balance` (₹) increased by exactly 15, with no cross-contamination. UI toggle screenshot-verified (label/helper text swap correctly between "₹ Real Money" and "⚡ XP" modes).
- NOTE (not in scope, pre-existing, unrelated bug spotted): the separate one-off "Give Reward/Penalty" tool (different feature, `RewardPenaltyCreate`) always credits real money (`my_wallet`) but its helper text says "to their spending wallet" — mislabeled copy, left untouched since user's request was specifically about chores/quests.
- Follow-up fix: Dashboard.jsx's "My Money" jar-grid card for the `spending` account type was still labeled "Wallet" with a 💳 icon on the OUTSIDE of the card while showing "X XP" inside — inconsistent. Renamed the card label to "My XP" with a ⚡ icon (matches "My Wallet"/₹ card's consistent inside/outside labeling). Same fix applied to WalletPage.jsx's shared `getAccountMeta().spending` label for consistency (was unused in that page's jar-grid since spending is shown separately as the top "My XP" card, but fixed for correctness anyway).

### Subtopic Progress Bars (Feb 2026)
- `TopicPage.jsx`'s subtopic grid (the "📌 Subtopics" section shown when viewing a topic like "Understanding Money") now shows, per card: a "Part N" label, a green "NEXT UP" badge on the first unlocked-but-incomplete subtopic, a progress bar, and "{completed} of {total} done" text — using the already-existing `subtopic.completed_count`/`content_count`/`is_completed`/`is_unlocked` fields returned by `GET /content/topics/{id}` (routes/content.py). Locked subtopics keep the existing grayed-out lock overlay (no progress bar). Non-child viewers (parent/teacher/admin) keep the old "{content_count} items" text instead of a progress bar, since completion tracking is per-child.
- Verified via screenshot with a real child account + completing a content item live: bar goes from empty ("0 of 1 done", NEXT UP badge) to full green ("1 of 1 done", checkmark badge, green border) exactly as expected.

### Learning-First Dashboard — Grade K-3 (Feb 2026) ✅ [Iterated through 4 rounds based on user visual feedback]
- New `GET /api/content/next-lesson` backend endpoint (`routes/content.py`, children only, 403 otherwise): walks the curriculum tree (topics → subtopics → content items) using the same helpers as `GET /content/topics` and returns the first incomplete, unlocked content item — the child's real "next lesson". For a brand-new user this resolves to the very first item of the first subtopic of the first topic. Also returns `completed_today` (real count) and `daily_goal: 3`.
- Final Dashboard.jsx layout for grade ≤ 3 (pixel-matched to user-supplied reference screenshots, cream/green palette — NOT the app's usual light-blue/neobrutalist style):
  - Root wrapper uses `bg-[#F1ECE2]` (cream) for grade≤3 vs `bg-[#E0FBFC]` for grade 4-5 (unchanged).
  - Dark green (`#2F5D45`) hero card: real next-lesson title/reward, cream "LESSON IMAGE" placeholder box, gold "Start Learning"/"Continue Learning" button deep-linking to `/learn/topic/{subtopic_id}?highlight={content_id}`.
  - White "Today's goal" card: horizontal layout, SVG ring (left) + title/subtitle/3-pip indicator (right), real `completed_today`/`daily_goal`.
  - `ChildHomework` component gained a `variant="banner"` prop — single most-urgent pending homework item, red-left-border white card, OVERDUE/DUE TODAY pill, real `teacher_name` + `reward_coins` (new fields added to `GET /child/homework`, resolved from `homework_assignment.teacher_id`→`users.name` and the live `content_items.reward_coins`). Grade 4-5 keeps the original multi-item list `variant="list"` (default, unchanged).
  - Exactly 4 soft white nav-cards (emoji icon + colored top border + real dynamic subtitle): My Money (`₹{my_wallet} to spend`), My Garden/Stocks (`{thirsty} plants thirsty` / `₹{invested} invested`), Quests (`{n} quests left`), Money Words. No Badges/Calendar/Store cards on this view (Rewards is reachable via the bottom nav instead).
  - Exactly 2 detail cards: Savings (`ClassmatesSection`-style empty/progress card) + either "My classroom" (new `ClassmatesSection` `variant="leaderboard"` — ranks child + classmates by `spending_balance`/XP, "You" row highlighted, gift-icon per row, capped to 3 rows to stay compact) if `hasClassroom`, else "My jobs" (real family/payday job list). Grid uses `items-start` so both cards size to their own content instead of CSS-grid-stretching to match each other's height.
  - Fixed pill bottom-nav bar (Home/Learn/Quests/Money/Rewards, Home active in green) — grade≤3 only.
  - Grade 4-5 dashboard is **byte-for-byte unchanged** (all old sections wrapped in `{grade > 3 && (...)}`).
- **Grade 3 moved from Stocks to Garden**: `getInvestmentItem()` threshold changed `grade<=2`→`grade<=3`. Backend gates swapped: `GET /garden/farm` + `POST /garden/buy-plot` now block `grade>=4` (was `>=3`); `GET /investments` now blocks `grade<=3` (was `<=2`). 5 seed-catalog docs (Red Chilli, Tomato, Eggplant, Wheat, Strawberry) had `max_grade` widened 2→3 so Grade 3 doesn't see an empty seed shop.
- Tested across 4 rounds by testing_agent (iterations 109-112): 100% pass each round, zero unresolved bugs. New regression suite: `/app/backend/tests/test_round4_garden_investments.py`. QA account `classmate_g4_qa`/`testpass123` added for grade-4 regression baseline (see test_credentials.md).

## Current Architecture Snapshot (Aug 23, 2026)
- Roles: child, parent, teacher, school (admin), admin.
- Learning hierarchy: Topic → Subtopic → Content Item, grade-scoped, progressive unlock.
- Curricula: `financial_literacy` (default) and `money_entrepreneurship` (Money Masters & Entrepreneurship). Schools enable curricula via `enabled_curricula`; D2C users' curricula are derived from their own active subscriptions (`services/curricula.py get_active_curricula`).
- Subscriptions (`db.subscriptions`): base plans (`single_parent`/`two_parents`/`admin_granted`, duration-based, keyed by `parent_emails`) and standalone Money Masters batch subscriptions (`plan_type='money_masters'`, keyed by `child_user_ids` + `parent_emails`, `end_date` = the batch's own end date). Razorpay create-order/verify-payment shared across both.
- Money Masters batches (`db.money_masters_batches`): admin-managed, per-grade, dated, priced cohorts — buying one includes that batch's live classes and curriculum content, no base plan required.
- Live Classes (`db.live_classes`): admin-managed dated sessions, grade-range + curriculum scoped, visible to child/parent only.
- See `CHANGELOG.md` for the full chronological implementation log and `ROADMAP.md` for the prioritized backlog.
