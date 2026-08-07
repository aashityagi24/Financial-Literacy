# Test Credentials

## Admin
- Email: admin@learnersplanet.com
- Password: finlit@2026

## Test Child (Grade 1)
- Email: child_g1@test.com
- Username: test_child_g1
- Password: testpassword

## Test Child (Progressive Unlock Testing)
- Email: test_progress_child@test.com
- Password: testpassword123
- Grade: 1

## Teacher
- Username: test_teacher_1
- Password: testpassword


## School Admin (Springfield Elementary — QA)
- Login: username `springfield` / password `school123` (via /login → school login, or /api/auth/school-login)
- school_id: school_c0bc3d3734b7
- Used to test "Add Existing" user mapping (email or username) in the School Dashboard.

## Nudge Test Parent (no children linked — for Link-Child walkthrough QA)
- Email: nudge_parent@test.com
- Password: testpass123
- Has active 1-year subscription, ZERO children linked (so the first-time "Link Child" nudge shows)

## Wallet Demo (CoinQuest vs My Wallet split)
- Parent username: wallet_demo_parent  / password: testpass123  (has active 1y subscription)
- Child  username: wallet_demo_child   / password: testpass123  (Grade 3, linked to parent above)
- Seeded ledger: CoinQuest ₹150 (lesson + streak demo rows) + My Wallet ₹175 pending (chore ₹50 + allowance ₹100 + reward ₹25)


## Quest Media Test (images/PDF on quests — QA)
- Teacher: test_teacher_1 / testpassword (owns "Demo Class" / demo_classroom_1)
- Student: classmate_g3 / testpass123 (enrolled active in Demo Class)
- Seeded quest `quest_media_test_001` in Demo Class with a general image + PDF + one MCQ question with an image, and a completion by classmate_g3 (so teacher analytics has data).

## Grade-Aware Test Users (Classmates QA — May 28, 2026)
- `classmate_k` / `testpass123` — Grade 0 (Kindergarten), enrolled in Demo Class
- `classmate_g1` / `testpass123` — Grade 1, enrolled in Demo Class
- `classmate_g2` / `testpass123` — Grade 2, enrolled in Demo Class
- `classmate_g3` / `testpass123` — Grade 3, enrolled in Demo Class
- All flagged `is_test_user: true` (bypasses subscription paywall)

## Homework "Open" highlight QA (Aug 7, 2026)
- Student `classmate_g3` / `testpass123` (Grade 3, Demo Class) has 3 active homework items:
  - "HW Grade-Excluded Worksheet" (content_hwtest_gradeexcl, topic_2731433e0a5b) — content min/max grade 0-0 so it is normally grade-filtered OUT for a grade-3 child; used to verify the Open→highlight fix (backend `?highlight=` param forces inclusion).
  - "Testing" (content_8edef32730e2, topic_2731433e0a5b)
  - "Candy Shop" (content_07aae589c292, topic_cdac2568de6f)
- Clicking "Open" on a homework card must navigate to the content's topic and show the "Your Homework — complete this!" highlight badge on that exact item.
