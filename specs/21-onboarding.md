# 21 — Onboarding (backend, שלב א')

מקור: `backend/src/onboarding/` (`onboarding.controller.ts`, `onboarding.service.ts`, `onboarding-features.ts`, `dto/onboarding.dto.ts`), `backend/prisma/schema.prisma::UserOnboardingState`. החלטות מוצר: `product-backlog/21-onboarding-and-feature-discovery.md` §21.0. סעיף Frontend טרם מומש.

## 1. Data Model

`UserOnboardingState` — 1:1 עם `User` (`userId @unique`, `onDelete: Cascade`): `checklistDismissedAt DateTime?`, `seenFeatureKeys String[] @default([])`, `createdAt`, `updatedAt`. שמור רק מצב ממשק. **התקדמות הצ'קליסט לא נשמרת** — נגזרת בכל קריאה. השורה נוצרת בעצלות בכתיבה הראשונה (upsert); `GET /onboarding/status` רק קורא ולא יוצר שורה. אין backfill למשתמשים קיימים.

## 2. API Contract

כל ה-endpoints קוראים `AuthService.validateToken` ידנית (401 `'Invalid token'` / `'Missing authorization header'`), ופועלים על המשתמש המחובר בלבד.

| Endpoint | תשובה | הערות |
|---|---|---|
| `GET /onboarding/status` | `{ track, steps: [{key, done, optional}], checklistComplete, checklistDismissed, unseenFeatureKeys }` | 200 |
| `POST /onboarding/dismiss-checklist` | `{ checklistDismissed: true }` | 201, upsert |
| `POST /onboarding/restore-checklist` | `{ checklistDismissed: false }` | 201, "הצג שוב" בהגדרות (החלטה #13); לא היה ברשימת §21.1 אבל נדרש ל-§21.2 |
| `POST /onboarding/seen-features` body `{ keys: string[] }` | `{ seenFeatureKeys }` | 201; idempotent; מפתחות לא מוכרים מתעלמים מהם; גוף לא תקין (לא מערך מחרוזות / יותר מ-50) = 400 `'רשימת מפתחות לא תקינה'` |

## 3. מסלול (track) — החלטה #10

- נשקלות רק חברויות `TeamMember.status = 'ACTIVE'` בצוותים `deletedAt = null` ו-`status = 'ACTIVE'` (חברות `PENDING`, צוות שמחכה לאישור וצוות שנמחק לא נספרים).
- `MANAGEMENT` אם יש לפחות חברות אחת עם `isAdmin || role === 'TEAM_LEADER'` (אותה הגדרה כמו `assertCanManageTeamContent`), **או** אם אין שום חברות רלוונטית (משתמש חדש — הצעד הראשון הוא יצירת צוות). אחרת `MEMBER`.
- צעדי הנהלה מתייחסים לצוות ההנהלה הראשון לפי `TeamMember.createdAt` (ואז `id`).
- ידוע: יוצר צוות שעדיין מחכה לאישור, שהוא גם חבר רגיל בצוות פעיל אחר, יקבל מסלול `MEMBER`.

## 4. צעדים (`steps`, לפי סדר תצוגה)

| מסלול | key | `done` כש... | optional |
|---|---|---|---|
| MEMBER | `join-team` | חבר ACTIVE בצוות פעיל (תמיד true במסלול הזה) | לא |
| MEMBER | `first-comment` | קיימת `Comment` של המשתמש (`authorId`) בצוות ובספרינט שלא נמחקו | לא |
| MEMBER | `connect-telegram` | `UserMessagingLink` TELEGRAM עם `isRevoked = false` | כן — לא חוסם `checklistComplete` |
| MANAGEMENT | `create-team` | יש צוות הנהלה פעיל | לא |
| MANAGEMENT | `invite-member` | בצוות הראשון: קיים `TeamInvite` (גם בוטל) או חבר אחר שאינו המשתמש ואינו פנטום (כל סטטוס) | לא |
| MANAGEMENT | `open-sprint` | ספרינט שלא נמחק בצוות | לא |
| MANAGEMENT | `close-sprint` | ספרינט שלא נמחק עם `endDate < now` (הייצוא עצמו לא נגזר) | לא |
| MANAGEMENT | `pick-focus-point` | קיימת `FocusPoint` כלשהי בצוות (כל סטטוס) | לא |

`checklistComplete` = כל הצעדים שאינם `optional` הושלמו. ללא צוות הנהלה כל צעד חוץ מ-`create-team` הוא `false` (ולא נשלחות שאילתות פר-צוות). מספר השאילתות קבוע: חברויות + מצב ממשק, ואז עד 5 `count` במקביל.

## 5. "מה חדש" (`unseenFeatureKeys`)

הרישום בצד שרת: `onboarding-features.ts` (`key`, `audience`, `since`; כותרות/טקסטים/CTA ב-frontend `registry.ts`). מוחזרים רק מפתחות עם `since >= 2026-10-15` (`WHATS_NEW_SINCE`, החלטה #12), שלא ב-`seenFeatureKeys`, ושה-audience שלהם מתאים: `MANAGEMENT` רק למי שיש לו חברות הנהלה פעילה; `MEMBER`/`ALL` לכולם. ממוינים לפי `since` יורד (הרישום שובר שוויון). כרגע רק `focus-points` (הנהלה) עונה על הסף.

## 6. Edge cases לבדיקה

- משתמש חדש בלי צוות: MANAGEMENT, הכל false, `unseenFeatureKeys` ריק.
- שליחה חוזרת של אותו מפתח ב-`seen-features`: לא נכתב דבר, לא כפילות.
- `seen-features` עם `{}` / ללא גוף: 400.
- משתמש שנמחק: `UserOnboardingState` נמחק ב-cascade.
