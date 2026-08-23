# CoinQuest — Roadmap / Backlog

## P0
- **User verification of Live Classes module** — implemented + auto-tested (31/31), awaiting the user's own acceptance pass (admin create/edit/delete a class; child/parent see only entitled grade+curriculum sessions; join/recording links work).
- **Tag Money Masters content** — no topic/content item/live class currently carries `curricula: ['money_entrepreneurship']`. A parent who buys a Money Masters batch today lands on an empty Learn page (graceful empty-state, but no real content). Admin should tag existing/new content via the Content Management curriculum selector, and schedule at least one Money Masters live class per active batch's grade.

## P1
- **Live Razorpay checkout + post-payment setup verification** — run one genuine payment (base plan and/or a Money Masters batch) in production and confirm subscription/access activates and the post-payment account-setup flow completes correctly.
- **Grade 2 Money Garden sell-screen clarity** — show per-kg/per-flower pricing at harvest/sell time with a quantity math helper before selling (`MoneyGardenPage.jsx`).
- **Mobile child UI polish** — ensure child interactive controls are ≥44px touch targets across `Dashboard.jsx`, `MoneyGardenPage.jsx`, wallet/learn pages.
- **PWA / Add to Home Screen** — installable app shell, especially useful for Calendar/live-class and Money Masters purchase conversion.

## P2
- Parent/teacher collaboration portal.
- Collaborative and seasonal events.
- First-use tutorial/onboarding.
- Refactor oversized pages: `ContentManagement.jsx`, `SchoolDashboard.jsx`, `TeacherDashboard.jsx`, `ParentDashboard.jsx`.
- School curriculum badges on admin school list.
- Existing React `useEffect` exhaustive-deps warnings — audit large pages, add only legitimate deps, no blanket lint-disable.
- Money Masters: TTL/cleanup for abandoned pending batch-purchase subscription rows.

## Recently completed (Aug 23, 2026)
- **Hub page content pass 2**: reordered product cards (Entrepreneurship Workshop first, then Financial Literacy Platform), renamed card CTAs to "Guided Workshop" / "DIY Platform", replaced the 4-pill trust strip with an avatar-dots "Trusted by hundreds of children & parents across India" element, added two "How it Works" step sections (Workshop, then Platform) after the product cards, and replaced "For Kids, Parents & Teachers" (3 cards) with "For Parents & Schools" (2 cards, each covering both products).
- **Hub page hero redesign**: replaced the neutral two-product hero with an Entrepreneurship-led hero matching a user-supplied reference — soft green→peach gradient, "Nurture the founder in your child." headline with a marker-highlighted "founder", "Book a free trial class" (deep-links to `/entrepreneurship-workshop?trial=1` which auto-opens the trial dialog) and "See the platform" (scrolls to the two product cards below, `#programs`). Two-product-card section retained below the hero.
- **Landing page split into hub + two product pages**: `/` is now a neutral hub (two product cards: Financial Literacy Platform, Entrepreneurship Workshop), `/financial-literacy` carries the old homepage content + PricingSection, `/entrepreneurship-workshop` is new (highlights, open batches by grade fetched publicly, "Book a Free Trial" lead form). New public endpoints `GET .../money-masters/public-batches` and `POST .../money-masters/trial-enquiry`; new admin "Trial Requests" tab mirroring the school-enquiries pattern (`db.entrepreneurship_trial_leads`).
- Fixed a route-shadowing bug where `DELETE /admin/{subscription_id}` (registered earlier) swallowed `DELETE /admin/trial-enquiries-bulk` — reordered routes, now 19/19 `test_trial_enquiries.py` pass.
- Fixed session-expired toast never appearing on any page (Toaster was mounted after BrowserRouter, missing mount-time toasts) by moving `<Toaster/>` above `<BrowserRouter>` in `App.js`.
- Fixed hub page's two product cards having mismatched height/alignment (`items-stretch` on the grid).

## Blocked (needs manual/external action, not a code fix)
- **Historical missing badge images** — original assets lost; admin must re-upload via Badge Management. Recurrence count 5+.
