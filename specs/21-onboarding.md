# 21 — Onboarding (שלב א')

מקור: `backend/src/onboarding/` (`onboarding.controller.ts`, `onboarding.service.ts`, `onboarding-features.ts`, `dto/onboarding.dto.ts`), `backend/prisma/schema.prisma::UserOnboardingState`. החלטות מוצר: `product-backlog/21-onboarding-and-feature-discovery.md` §21.0. Frontend: `frontend/src/features/onboarding/` (ר' §7).

## 1. Data Model

`UserOnboardingState` — 1:1 עם `User` (`userId @unique`, `onDelete: Cascade`): `checklistDismissedAt DateTime?`, `seenFeatureKeys String[] @default([])`, `guideAutoStartedAt DateTime?` (פיצ'ר 22: מתי המדריך האינטראקטיבי נפתח אוטומטית; פעם אחת בלבד, גם בין מכשירים), `createdAt`, `updatedAt`. שמור רק מצב ממשק. **התקדמות הצ'קליסט לא נשמרת** — נגזרת בכל קריאה. השורה נוצרת בעצלות בכתיבה הראשונה (upsert); `GET /onboarding/status` רק קורא ולא יוצר שורה. אין backfill למשתמשים קיימים.

## 2. API Contract

כל ה-endpoints קוראים `AuthService.validateToken` ידנית (401 `'Invalid token'` / `'Missing authorization header'`), ופועלים על המשתמש המחובר בלבד.

| Endpoint | תשובה | הערות |
|---|---|---|
| `GET /onboarding/status` | `{ track, steps: [{key, done, optional}], checklistComplete, checklistDismissed, unseenFeatureKeys, hints: { teamId, activeSprintId, endedSprintId }, guideAutoStart }` | 200. `endedSprintId` (פיצ'ר 22) = הספרינט האחרון של אותו צוות שהסתיים (`endDate` לפני תחילת היום UTC) ושלא נמחק. `guideAutoStart` = אין `guideAutoStartedAt` **וגם** למשתמש אין שום הערה ואין ספרינט (לא נמחק) באף צוות פעיל שלו — כדי שמשתמש קיים לא יקבל מדריך ביום הפריסה |
| `POST /onboarding/dismiss-checklist` | `{ checklistDismissed: true }` | 201, upsert |
| `POST /onboarding/restore-checklist` | `{ checklistDismissed: false }` | 201, "הצג שוב" בהגדרות (החלטה #13); לא היה ברשימת §21.1 אבל נדרש ל-§21.2 |
| `POST /onboarding/guide-started` | `{ guideAutoStart: false }` | 201 (פיצ'ר 22); idempotent: הקריאה הראשונה רושמת `guideAutoStartedAt`, הבאות לא משנות אותה |
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

`hints` הם יעדי הכפתורים: `teamId` = צוות ההנהלה הראשון (מסלול MANAGEMENT) או החברות הפעילה הראשונה (MEMBER), `null` בלי צוות; `activeSprintId` = ספרינט של אותו צוות שלא נמחק, ש-`startDate <= now` ו-`endDate >= תחילת היום (UTC)` (המאוחר ביותר), או `null`. שאילתה אחת נוספת, רק כשיש צוות.

## 5. "מה חדש" (`unseenFeatureKeys`)

הרישום בצד שרת: `onboarding-features.ts` (`key`, `audience`, `since`; כותרות/טקסטים/CTA ב-frontend `registry.ts`). מוחזרים רק מפתחות עם `since >= 2026-10-15` (`WHATS_NEW_SINCE`, החלטה #12), שלא ב-`seenFeatureKeys`, ושה-audience שלהם מתאים: `MANAGEMENT` רק למי שיש לו חברות הנהלה פעילה; `MEMBER`/`ALL` לכולם. ממוינים לפי `since` יורד (הרישום שובר שוויון). כרגע רק `focus-points` (הנהלה) עונה על הסף.

## 6. Edge cases לבדיקה

- משתמש חדש בלי צוות: MANAGEMENT, הכל false, `unseenFeatureKeys` ריק.
- שליחה חוזרת של אותו מפתח ב-`seen-features`: לא נכתב דבר, לא כפילות.
- `seen-features` עם `{}` / ללא גוף: 400.
- משתמש שנמחק: `UserOnboardingState` נמחק ב-cascade.

## 7. Frontend

- **מקור:** `frontend/src/features/onboarding/` — `use-onboarding.ts` (טוען בעליית הדשבורד וב"רענן" בלבד, לא על פוקוס), `onboarding-logic.ts` (פונקציות טהורות: צעדים, התקדמות, איזה כרטיס "מה חדש", יעד כפתור), `navigate.ts`, `registry.ts` (טקסטים/CTA/`since` לכל פיצ'ר; חייב להישאר זהה במפתחות ל-`backend/src/onboarding/onboarding-features.ts`), רכיבי `onboarding-checklist-{web,native}` ו-`whats-new-card-{web,native}`. משולב ב-`dashboard-{web,native}.tsx` מעל `MyFocusTasksCard`. כרטיס "התחלה מהירה" בהגדרות (`settings/components/quick-start-card*.tsx`) עם "הצג שוב".
- **כפתורי צעדים:** `create-team` / `connect-telegram` → `/settings`; `pick-focus-point` → מסך נקודות לשיפור של צוות ההנהלה הראשון (נקבע מרשימת הצוותים של הדשבורד); `first-comment` → לוח הספרינט הפעיל (`hints`), רק כשיש כזה. שאר הצעדים נעשים בתוך כרטיס הצוות ואין להם route, ולכן אין כפתור (וצעד שהושלם מתכווץ לשורת כותרת, כך שכפתור ל-`close-sprint` לא היה מוצג לעולם).
- **"סיור במערכת" (לפי דרישה, 2026-10-16):** כפתור בכותרת הדשבורד (`TourButton` ב-`features/onboarding/index.tsx`; web: כפתור ghost עם אייקון בלבד בטלפון, native: אייקון) שפותח חלון מדורג (`Modal` מ-`components/ui`, גיליון תחתון בטלפון) — שלב אחר שלב עם הקודם/הבא/סיום, נקודות התקדמות וכפתור פעולה לשלבים שיש להם יעד. השלבים הם הרישום `registry.ts` מהישן לחדש (`tour-logic.ts::getTourSteps`); פיצ'רים של הנהלה (`MANAGEMENT`) מוצגים רק למי שמנהל צוות (`findManagedTeamId`). **בלי מצב בשרת** — זה מציג ולא הודעה חד-פעמית; לא נוגע ב-`seenFeatureKeys`. אירועים: `tour_opened`, `tour_step_next`, `tour_step_back`, `tour_cta_clicked`, `tour_finished` (סגירה בשלב האחרון), `tour_closed` (סגירה באמצע). זה ממש חלקי של מסך "גלה את המערכת" (החלטה #14) — בלי קטלוג נפרד.
- **המדריך האינטראקטיבי (פיצ'ר 22):** ר' `specs/22-interactive-guide.md`. הכפתור "סיור במערכת" עבר מכותרת הדשבורד (web) לתפריט "מדריך" בסרגל העליון, כאחת משלוש האפשרויות (`guide/guide-menu-{web,native}.tsx`); ב-native, שבו לסרגל אין מקום, הוא נשאר בכותרת הדשבורד בתוך אותו תפריט. `TourButton` עדיין מיוצא אבל לא בשימוש; `TourDialog{Web,Native}` הם החלון עצמו.
- **"נראה":** נרשם רק בסגירה או בלחיצה על ה-CTA, לא בטעינה; כרטיס אחד בכל כניסה; מפתח לא מוכר ללקוח מדולג.
- **אנליטיקה:** `onboarding_step_clicked`, `onboarding_checklist_dismissed`, `whats_new_shown/dismissed/cta_clicked`, `onboarding_load_failed`.
- **הוספת פיצ'ר חדש ל"מה חדש":** שורה ב-`onboarding-features.ts` (backend) **וגם** ב-`registry.ts` + מחרוזות ב-`Strings.onboarding.features` (frontend).
