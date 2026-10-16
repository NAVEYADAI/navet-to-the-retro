## פיצ'ר 21: הטמעה וגילוי פיצ'רים (Onboarding + Feature Discovery) — מומש (שלב א', 2026-10-16) — `db push` מול Neon רץ

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** מודל חדש `UserOnboardingState` (1:1 עם `User`, `userId @unique`, `onDelete: Cascade`; שדות מוצעים: `checklistDismissedAt DateTime?`, `seenFeatureKeys String[]`, `createdAt`/`updatedAt`). **אין שינוי** ב-`User`/`TeamMember`/`Team`. ההתקדמות בצ'קליסט **נגזרת** מנתונים קיימים (צוותים, חברים, ספרינטים, הערות), לא נשמרת.
- **Backend:** מודול חדש `backend/src/onboarding/` (controller + service, נרשם ב-`app.module.ts`). קורא (קריאה בלבד) מ-`TeamMember`, `Sprint`, `Comment`, `TeamInvite`, `UserMessagingLink`, `GoogleCalendarConnection`, `FocusPoint`. משתמש ב-`AuthService.validateToken` ידנית בראש כל method (אין Guards). הגדרת "הנהלה" נגזרת מ-`team-permissions.util.ts` (`isAdmin || role === 'TEAM_LEADER'`, `status === 'ACTIVE'`).
- **Frontend:** פיצ'ר חדש `frontend/src/features/onboarding/` — רכיב צ'קליסט (web + native), כרטיס "מה חדש" (web + native), רישום פיצ'רים אחד `registry.ts` (מקור אמת יחיד: מפתח, כותרת, תיאור, קהל, מסלול ניווט, תאריך). משולב ב-`features/dashboard/components/dashboard-{web,native}.tsx` (מעל `MyFocusTasksCard`), וב-`constants/strings.ts` (קטע `onboarding`). נקודת כניסה קבועה לחזרה לתוכן (החלטות #13/#14).
- **Endpoints:** חדשים — `GET /onboarding/status` (התקדמות נגזרת + מסלול + פיצ'רים שלא נראו), `POST /onboarding/dismiss-checklist`, `POST /onboarding/seen-features` (גוף: מפתחות).
- **חולק touchpoint עם:** פיצ'ר 20 (הדשבורד כבר משלב `MyFocusTasksCard`; ו"נקודות לשיפור" הוא הפיצ'ר הראשון שמוצג רק להנהלה — `dashboard-web.tsx`, `dashboard-native.tsx`, `strings.ts` מקבלים בו־זמנית שינויים משני הפיצ'רים), פיצ'ר 18 (אינדיקציות "ממתין לי" — אותו משטח בדשבורד, צריך להחליט מי מקבל את המקום הבולט), פיצ'ר 10 (טלגרם) ופיצ'ר 6 (יומן Google) — שניהם כרטיסי הגדרות ש"מוסתרים" היום ומועמדים ראשונים לגילוי, פיצ'רים 3/9/19/1 (קטגוריות, פנטום, לוגו, ייצוא מצגת — מועמדים לכרטיסי "מה חדש"/קטלוג), פיצ'ר 17 (סשן בלייב — עתידי, יידרש רישום ברגע שימומש), `lib/analytics.ts::trackEvent` (כל לחיצה חדשה חייבת אירוע).

מטרת הפיצ'ר: היום משתמש חדש מקבל "ברוך הבא" ואז מסך ריק עם "צור צוות", ואין שום מנגנון שמראה למשתמשים (חדשים או קיימים) מה המערכת יודעת לעשות — גם לנו קשה לעקוב אחרי כל מה שבנינו. הפיצ'ר מוסיף שתי שכבות: (א) **צ'קליסט התחלה** שמוביל משתמש חדש לערך האמיתי (ספרינט ראשון עם הערות), ו-(ב) **גילוי פיצ'רים** — כרטיס "מה חדש" שמציג פיצ'ר פעם אחת, וכל זה בשני מסלולים: **חבר צוות** ו**הנהלה** (ראש צוות/מנהל), כך שאפשר לחשוף להנהלה פיצ'רים שרק היא רואה (למשל נקודות לשיפור, פיצ'ר 20). הרישום האחיד של הפיצ'רים משמש גם כרשימה חיה של "מה יש במערכת".

### 21.0 החלטות

**מה שנקבע ע"י נוה (2026-10-15):**

1. **מנגנון: צ'קליסט + "מה חדש"** (ולא סיור מודרך עם בועות על המסך ולא רק מסכים ריקים). הסיבה: סיור בועות שביר ברספונסיב/RTL/נייטיב וקשה לתחזוקה כשמסכים משתנים; צ'קליסט מבוסס פעולות אמיתיות לא נשבר כשהעיצוב משתנה.
2. **שני מסלולים — חבר והנהלה.** ההנהלה (ראש צוות ומנהל) רואה בנוסף פיצ'רים ופעולות שמיועדים רק לה, ובראשם נקודות לשיפור (פיצ'ר 20).
3. **שני קהלי יעד:** (א) מי שיוצר/מנהל צוות, (ב) חבר שהוזמן לצוות. לכל אחד מסלול משלו.

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול עליהן):**

1. **התקדמות נגזרת, לא נשמרת.** כל צעד בצ'קליסט מחושב מנתונים שכבר קיימים ("יש לי צוות פעיל", "הזמנתי חבר", "פתחתי ספרינט", "כתבתי הערה"), כמו שפיצ'ר 14/20 נגזרים מהמצב ולא מדגלים. כך אין סטייה בין מה שהמשתמש עשה למה שמוצג, וצעד שהושלם לפני שהפיצ'ר קיים נספר אוטומטית.
2. **מה שנשמר ב-DB הוא רק מצב ממשק:** האם הצ'קליסט נסגר, ואילו מפתחות פיצ'רים כבר הוצגו. בשרת ולא ב-`localStorage`, כי המשתמש נכנס מ-web ומנייטיב ומכמה מכשירים (ר' הסעיף על אחסון דפדפן).
3. **רישום פיצ'רים אחד בקוד (`registry.ts`), לא טבלה ב-DB.** פיצ'ר חדש = שורה חדשה ברישום + מחרוזות. מונע צורך ב-admin UI ונשאר בדיוק כמו שאר המחרוזות באפליקציה. כל רשומה: `key`, `audience` (`MEMBER`/`MANAGEMENT`/`ALL`), `title`, `description`, `cta` (מסלול ניווט), `since` (תאריך).
4. **"נראה" נרשם כשהמשתמש סוגר או לוחץ על ה-CTA, לא כשהכרטיס נטען** — אחרת רענון מסך שורף את ההצגה.
5. **כרטיס "מה חדש" אחד בכל פעם**, לפי סדר העדיפות/התאריך, כדי שלא להציף.
6. **טעינה בעליית המסך בלבד + כפתור רענון קיים** (כלל הפרויקט: אין auto-refetch-on-focus).
7. **כל כפתור חדש עם `trackEvent`** (כלל הפרויקט), כולל: צעד נלחץ, צ'קליסט נסגר, כרטיס נראה/נסגר/CTA. זה גם מה שמאפשר למדוד אם ההטמעה עובדת (ר' ממצאי מחקר).
8. **בדיקות e2e ב-Playwright (Desktop+Mobile)** על DB מבודד, לפי הכלל הקבוע — לא מזינים כלום מול ה-DB האמיתי.
9. **משתמשי פנטום (`isPhantom`) לא נכנסים למערכת**, ולכן אין להם מסלול ואין צורך לסנן אותם מעבר לבדיקה שאין בהם התחברות.

**החלטות מוצר שנסגרו (2026-10-15, לפי ההמלצות שנוסחו באיפיון; נוה יכול לשנות כל אחת):**

10. **מסלול למשתמש מעורב (הנהלה בצוות אחד, חבר באחר):** מסלול ההנהלה מוצג אם המשתמש הוא הנהלה (`isAdmin || role === 'TEAM_LEADER'`, `status === 'ACTIVE'`) ב**לפחות צוות פעיל אחד**. צעדי ההנהלה מתייחסים לצוות הראשון שבו הוא הנהלה (לפי `TeamMember.createdAt`). פיצ'רים של "הנהלה בלבד" מוצגים רק עם הקשר צוות שבו יש לו הרשאה. בלי צוות בכלל (עדיין לא יצר/הצטרף) — מסלול ההנהלה, כי הצעד הראשון הוא יצירת צוות.
11. **הצעדים (עד 5 לכל מסלול):**
    - *חבר:* (1) הצטרפות לצוות [נגזר: חבר `ACTIVE` בצוות], (2) כתיבת הערה ראשונה בספרינט פעיל [קיימת `Comment` של המשתמש], (3) חיבור טלגרם [`UserMessagingLink`] — צעד אופציונלי, מסומן "מומלץ" ולא נחשב לסיום.
    - *הנהלה:* (1) יצירת צוות [צוות `ACTIVE`], (2) הזמנת חבר [`TeamInvite` או חבר נוסף בצוות], (3) פתיחת ספרינט [`Sprint` בצוות], (4) סגירת ספרינט וייצוא מצגת [ספרינט שהסתיים — הייצוא עצמו לא נגזר ולכן הצעד נספר בסגירה, עם הפנייה למצגת בטקסט], (5) בחירת נקודה לשיפור [`FocusPoint` בצוות, פיצ'ר 20].
12. **משתמשים קיימים:** צ'קליסט מוצג רק אם חסר להם צעד כלשהו (נגזר, כך שמשתמש פעיל לא יראה אותו כלל). כרטיסי "מה חדש" מוגבלים לרשומות שה-`since` שלהן מ-**2026-10-15** ואילך, כדי שלא להציף בפיצ'רים ישנים. פיצ'רים ישנים נגישים דרך הרישום בשלב ב' (ר' החלטה #14).
13. **סגירת הצ'קליסט:** כפתור "הסתר" שומר `checklistDismissedAt` ב-DB. צ'קליסט שהושלם במלואו מוסתר אוטומטית. נקודת חזרה: כרטיס "התחלה מהירה" בהגדרות (`settings`) עם כפתור "הצג שוב" שמאפס את `checklistDismissedAt`.
14. **מסך "גלה את המערכת" נדחה לשלב ב'.** שלב א' בונה את הרישום (`registry.ts`) כך שיהיה מוכן לתצוגה כזו, אבל לא את המסך עצמו. הנימוק: להתחיל קטן ולמדוד עם PostHog אם הצ'קליסט והכרטיס משנים משהו לפני שמשקיעים בקטלוג.
15. **קצב "מה חדש":** כרטיס אחד בכל כניסה לדשבורד, עד שהמשתמש סוגר אותו או לוחץ על ה-CTA; הבא בתור מופיע בכניסה הבאה.
16. **טון וניסוח:** קצר, יבש-חם, בלי סימני קריאה מרובים ובלי אימוג'י (כלל העיצוב של הפרויקט). נוה לא מאשר ניסוח מראש; ברירת המחדל היא לכתוב ולתקן אחרי סקירה במסך.
17. **מיקום בדשבורד:** צ'קליסט וכרטיס "מה חדש" מעל `MyFocusTasksCard` ומתחת לכותרת הדף. כשמתווסף פיצ'ר 18 (אינדיקציה לדברים שממתינים) הוא יקבל את המקום הבולט יותר, והצ'קליסט ירד מתחתיו — ההכרעה הסופית שם, לא כאן.

### ממצאי מחקר

- **אין היום שום מנגנון הטמעה בקוד.** חיפוש `onboarding|tour|coachmark|first.?time` ב-`frontend/src` לא מצא כלום, מלבד מחרוזות רגילות. הדבר היחיד הקרוב הוא `strings.ts::dashboard.welcomeTitle`/`welcomeSubtitle` ("התחברת בהצלחה למערכת Retro") ו-`createFirstTeamTitle`/`createFirstTeamDesc` — מצב ריק יחיד בדשבורד.
- **יצירת צוות גרה בהגדרות** (`dashboard-web.tsx` — הכפתור "צוות חדש" מנווט ל-`/settings`), כלומר הצעד הראשון הקריטי מוסתר מהמסך הראשי של משתמש חדש. צעד "יצירת צוות" בצ'קליסט צריך להוביל לשם ישירות.
- **פיצ'רים שמוסתרים היום בהגדרות/בתוך מסכים:** טלגרם (`telegram-link-card.tsx`), יומן Google (`google-calendar-card.tsx`), מראה (`appearance-card.tsx`), צוותים שנמחקו (`deleted-teams-card.tsx`); בתוך צוות — קטגוריות, לוגו, פנטום, ייצוא מצגת. אלה המועמדים הראשונים לרישום.
- **הרשאות פר־צוות:** `TeamMember.isAdmin` + `TeamMember.role` (`TeamRole` enum כולל `TEAM_LEADER`); `User.role` הוא מחרוזת חופשית ("תפקיד מקצועי") ולכן **לא** מתאים לקביעת מסלול. הגדרת "הנהלה" הקיימת ב-`team-permissions.util.ts::assertCanManageTeamContent` (`isAdmin || role === 'TEAM_LEADER'`, `status === 'ACTIVE'`) — להשתמש בה, לא להמציא הגדרה נוספת.
- **פיצ'ר 20 הוא התקדים לפיצ'ר שרק להנהלה:** הציונים והמגמות נחשפים רק לה (`20-issue-tracking.md`), ו-`MyFocusTasksCard` כבר יושב בדשבורד — אותו דפוס מיקום ישמש לצ'קליסט.
- **בדשבורד יש כבר שני קבצים שמשתנים עכשיו בענף `feature/20-focus-points`** (לא נדחף): `dashboard-web.tsx`, `dashboard-native.tsx`, וגם `strings.ts` ו-`app.module.ts`. המימוש של פיצ'ר 21 צריך לחכות למיזוג של 20 או להיות מבוסס על הענף, אחרת יהיו קונפליקטים.
- **אין תשתית התראות/מיילים זמינה:** מיילים חסומים (BUG-59 — Resend דוחה נמענים שאינם בעל החשבון), לכן תזכורות למשתמשים שנשרו (מייל/טלגרם) **מחוץ לשלב א'**.
- **אנליטיקה:** PostHog קיים (`lib/analytics.ts::trackEvent`, פרויקט 264206); נתונים לפני 12.10 מזוהמים, ולכן מדידת "הצלחת הטמעה" צריכה להתחיל מתאריך שחרור הפיצ'ר. מדד מוצע: אחוז צוותים חדשים שהגיעו לספרינט עם הערות תוך 7 ימים.
- **מחסור ב-seed למצב ריק:** ב-`backend/scripts/` יש `seed-focus-points-demo.js` — דפוס שאפשר להרחיב אם יוחלט על "צוות לדוגמה" (ר' "לא בשלב א'").

### 21.1 Backend

- [x] `backend/prisma/schema.prisma`: מודל `UserOnboardingState` (`userId @unique`, `checklistDismissedAt DateTime?`, `seenFeatureKeys String[] @default([])`, `createdAt`, `updatedAt`; `onDelete: Cascade` מול `User`) + יחס הפוך על `User`. `db push` על `postgres-test` בלבד; מול Neon רק באישור מפורש של נוה. — נעשה: מודל `UserOnboardingState` + יחס הפוך `User.onboardingState`; `db push` רץ על `postgres-test` בלבד (localhost:5433/navet_test). **`db push` מול Neon רץ ב-2026-10-16 באישור מפורש של נוה** (טבלה חדשה בלבד, בלי אזהרות data-loss).
- [x] מודול `backend/src/onboarding/` (`onboarding.module.ts`, `.controller.ts`, `.service.ts`, `dto/onboarding.dto.ts`), נרשם ב-`app.module.ts`. כל method מתחיל ב-`AuthService.validateToken`. — נעשה: `onboarding.module/controller/service.ts`, `dto/onboarding.dto.ts`, וגם `onboarding-features.ts` (רישום key/audience/since בצד שרת); נרשם ב-`app.module.ts`.
- [x] `GET /onboarding/status`: מחזיר `{ track: 'MEMBER' | 'MANAGEMENT', steps: [{ key, done }], checklistDismissed, unseenFeatureKeys }`. התקדמות נגזרת בשאילתות בודדות (לא N+1 לכל צעד). קביעת מסלול לפי החלטה #10; רשימת הצעדים לפי החלטה #11; סינון "מה חדש" לפי `since` (החלטה #12). שורה ב-`UserOnboardingState` נוצרת בעצלות (upsert) ולא בהרשמה — כך אין צורך ב-backfill למשתמשים קיימים. — נעשה: מוסיף לתשובה גם `optional` לכל צעד ו-`checklistComplete`; GET רק קורא (לא יוצר שורה), ה-upsert בכתיבה. מפתחות צעדים: `join-team`/`first-comment`/`connect-telegram`, `create-team`/`invite-member`/`open-sprint`/`close-sprint`/`pick-focus-point`. פירוט: `specs/21-onboarding.md`.
- [x] `POST /onboarding/dismiss-checklist` ו-`POST /onboarding/seen-features` (הוספת מפתחות ל-`seenFeatureKeys` ללא כפילויות; מפתח לא מוכר מתעלמים ממנו ולא נכשלים, כדי שגרסת לקוח ישנה/חדשה לא תשבור). — נעשה; נוסף גם `POST /onboarding/restore-checklist` (איפוס `checklistDismissedAt`, ל-"הצג שוב" בהגדרות, החלטה #13). גוף לא תקין ב-`seen-features` = 400; מפתח לא מוכר מתעלמים.
- [x] סינון: צוותים שנמחקו (`deletedAt != null`, פיצ'ר 14) ו-`TeamMember.status === 'PENDING'` לא נספרים כהתקדמות. — נעשה בשאילתת החברויות (`status: ACTIVE`, `team.deletedAt: null`, צוות `ACTIVE`) ובספירות (ספרינטים/הערות שלא נמחקו).
- [x] Jest unit: חישוב צעדים לפי מצב (ללא צוות / צוות בלי חבר / ספרינט בלי הערות / הכל הושלם), קביעת מסלול (חבר, הנהלה, ערבוב צוותים), idempotency של `seen-features`, מפתח לא מוכר. — נעשה: `backend/src/onboarding/onboarding.service.spec.ts` (28 בדיקות); בדיקת e2e חד-פעמית מול `postgres-test` אימתה את ה-endpoints (נמחקה; קובץ ה-e2e הקבוע שייך ל-§21.3).
- [x] `specs/` ו-`product-backlog/README.md`: לעדכן עם סיום המימוש. — נעשה: `specs/21-onboarding.md`, `specs/README.md`, `backend/AGENTS.md` (רשימת מודולים), שורת הטבלה ב-`product-backlog/README.md`.

### 21.2 Frontend

- [x] `features/onboarding/registry.ts` — רשימת הפיצ'רים (לפחות: נקודות לשיפור [הנהלה], טלגרם, יומן Google, קטגוריות, לוגו צוות, חברי פנטום [הנהלה], ייצוא מצגת) עם `audience`, `cta`, `since`. — נעשה: 7 רשומות (`focus-points`, `team-logo`, `telegram`, `comment-categories`, `google-calendar`, `phantom-members`, `pptx-export`) עם אותם key/audience/since כמו `backend/src/onboarding/onboarding-features.ts`; `cta`: `settings` / `focus-points` / `none`; הטקסטים ב-`Strings.onboarding.features`.
- [x] `features/onboarding/` hook `use-onboarding.ts` (טעינה בעליית המסך בלבד, לא על פוקוס) + רכיבי `onboarding-checklist-{web,native}.tsx` ו-`whats-new-card-{web,native}.tsx` מרכיבי `components/ui` הקיימים (`Card`, `Button`, `Badge`), בלי hex ובלי אימוג'י על כפתורים, לפי `UI-GUIDELINES.md`. — נעשה: `hooks/use-onboarding.ts` (טעינה בעליית המסך + שינוי `refreshKey`; כשל טעינה = שקט), `hooks/use-quick-start.ts`, `onboarding-logic.ts` (פונקציות טהורות), `onboarding-api.ts`, `onboarding-changed-signal.ts`, `navigate.ts`; web על `Card`/`Button`/`Badge`; native על `components/native-parts.tsx` (אין מקבילה native ל-`Card`/`Badge`, אותו דפוס כמו `focus-points/native-parts.tsx`). אין כפתור `primary`.
- [x] שילוב ב-`dashboard-{web,native}.tsx` לפי החלטה #17; כפתור "רענן" הקיים מרענן גם את הצ'קליסט. — נעשה: `<OnboardingSection>` (צ'קליסט ואז "מה חדש") מעל `MyFocusTasksCard` ומתחת לכותרת/שגיאת הטעינה; מחובר ל-`myTasksRefreshKey` הקיים. הדשבורד מעביר `teams`+`userId` כדי לקבוע את הצוות הראשון שהמשתמש מנהל (`findManagedTeamId`, אותו predicate כמו בשרת) ליעד של "נקודות לשיפור".
- [x] כל צעד בצ'קליסט הוא קישור לפעולה האמיתית (למשל "צור צוות" → `/settings`); צעד שהושלם מסומן ומוסתר/מכווץ לפי החלטה. — נעשה בחלקו, בכוונה: כפתור יעד רק לצעדים עם יעד ניווט אמיתי — `create-team` ו-`connect-telegram` → `/settings`, `pick-focus-point` → מסך נקודות לשיפור של הצוות המנוהל. `first-comment` → לוח הספרינט הפעיל (נוסף `hints: { teamId, activeSprintId }` לתשובת `GET /onboarding/status`; הכפתור מוצג רק כשיש ספרינט פעיל). `invite-member`/`open-sprint` נעשים בתוך כרטיס הצוות בדשבורד ואין להם route, ו-`close-sprint` מתכווץ ברגע שהושלם (אז כפתור אליו לא היה מוצג לעולם), ולכן כולם מוצגים עם הסבר בלי כפתור. צעד שהושלם מכווץ לשורת כותרת + תג "הושלם".
- [x] `constants/strings.ts`: קטע `onboarding` — כל הטקסטים בעברית, בלי מחרוזות בקומפוננטות. — נעשה: `Strings.onboarding` (צעדים, פיצ'רים, "התחלה מהירה"); הניסוח כתוב ולא אושר מראש (החלטה #16) — לסקירה במסך.
- [x] `trackEvent` על כל לחיצה: `onboarding_step_clicked`, `onboarding_checklist_dismissed`, `whats_new_shown`, `whats_new_dismissed`, `whats_new_cta_clicked` (עם `featureKey`, `track`). — נעשה: `onboarding_step_clicked {stepKey, track, done}`, `onboarding_checklist_dismissed {track, done, total}`, `whats_new_shown/dismissed/cta_clicked {featureKey, track}` (`shown` נורה פעם אחת לכל מפתח לכל mount, לא ברענון), ובהגדרות `onboarding_restore_clicked {screen}` + `onboarding_checklist_restored`; כשל טעינה: `onboarding_load_failed {status}`.
- [x] נגישות ו-RTL: בדיקה ידנית ב-375px וב-desktop, ושימוש ב-`row` מול `row-reverse` לפי כלל ה-RTL הקיים. — נעשה (2026-10-16): צילומי מסך ב-375px של מסלול ההנהלה ושל מסלול החבר מול הסטאק המבודד (5006/8086) — כותרת מימין ותג ההתקדמות משמאלה, טקסטים מיושרים לימין, כפתורים בשורה נפרדת, אין גלילה אופקית, אזורי מגע תקינים. מבנה: web — `row` + `flexWrap` + `minWidth:0`, מאפיינים לוגיים בלבד; native — `row-reverse`/`textAlign:'right'`, אזור מגע 44. **לא נבדק:** native בפועל (סימולטור/מכשיר).
- [x] כרטיס "התחלה מהירה" בהגדרות (`settings-screen-{web,native}.tsx`) עם כפתור "הצג שוב" (החלטה #13) + `trackEvent`. — נעשה: `settings/components/quick-start-card.tsx` + `native/quick-start-card-native.tsx` (אחרי כרטיס הפרופיל); הכפתור מופיע רק כשהצ'קליסט מוסתר, קורא `POST /onboarding/restore-checklist` ומודיע לדשבורד הטעון דרך `onboarding-changed-signal`.
- [x] **לא** בונים את מסך "גלה את המערכת" בשלב זה (החלטה #14). — לא נבנה; `registry.ts` מוכן להזנתו בשלב ב'.

### 21.3 בדיקות

- [x] Jest frontend: הצגת צ'קליסט לפי מסלול, הסתרה אחרי "הסתר", כרטיס "מה חדש" אחד בכל פעם, סגירה רושמת `seen` ולא כשהכרטיס נטען. — נסקר ואומת (11 סוויטות, 58 בדיקות ירוקות עם הגדרות): `features/onboarding/__tests__/` (logic, `use-onboarding`, web, native) מכסה מסלול חבר/הנהלה, "הסתר" (POST + נשאר מוסתר אחרי remount), כרטיס אחד בלבד, ו-seen רק בסגירה/CTA ולא בטעינה/רענון; `settings/.../quick-start-card{,-native}.test.tsx` מכסה "הצג שוב". לא נדרשה תוספת.
- [x] Playwright e2e (Desktop+Mobile Chrome) על DB מבודד, קובץ `frontend/e2e/onboarding.spec.ts`: משתמש חדש רואה צ'קליסט; יוצר צוות → הצעד מסומן; חבר שהוזמן רואה מסלול חבר; ראש צוות רואה כרטיס נקודות לשיפור וחבר רגיל לא; סגירת הכרטיס לא מחזירה אותו אחרי רענון. — נעשה: 4 בדיקות × 2 פרויקטים = 8 ירוקות (backend 5006 / postgres-test). משתמש חדש: 5 צעדי הנהלה בסדר, 0 מתוך 5, בלי כרטיס "מה חדש", בלי גלילה אופקית, כותרת מימין ל"הסתר" (`boundingBox`, RTL); CTA של "יצירת צוות" → `/settings`; "הסתר" נשאר אחרי רענון, ו"הצג שוב" בהגדרות מחזיר אותו. יצירת צוות: צוות שממתין לאישור לא נספר, אחרי אישור `create-team` מסומן ומכווץ, ספרינט מסמן `open-sprint`. חבר מוזמן: מסלול חבר (3 צעדים, טלגרם "מומלץ"), 5 צעדי ההנהלה והכרטיס "להנהלה בלבד" **נעדרים מה-DOM**, הערה ראשונה מעלימה את הצ'קליסט. ראש צוות: כרטיס נקודות לשיפור (אחד, לא נשרף ברענון), סגירה לא מחזירה אותו אחרי רענון (+ אימות `unseenFeatureKeys` ריק בשרת), וכפתור ה-CTA פותח `/team/:id/focus-points` ונחשב כנראה. הערות "נעדר" ממתינות לתשובת `/onboarding/status` לפני האימות.
- [x] backend e2e מול `postgres-test`: מסלול נגזר נכון למשתמש הנהלה/חבר/מעורב, ו-`seen-features` נשמר בין סשנים. — נעשה: `backend/test/onboarding.e2e-spec.ts` (13 בדיקות ירוקות; כל סוויטת ה-e2e: 8 סוויטות, 126 בדיקות). 401 בכל ה-endpoints; משתמש חדש = MANAGEMENT, הכל false, GET לא יוצר שורת מצב; צוות שממתין לאישור / צוות שנמחק (soft delete) לא נספרים; ראש צוות: צעדי הנהלה נגזרים מהזמנה/ספרינט עתידי/ספרינט שהסתיים/נקודת מיקוד; חבר מוזמן = MEMBER (הערה משלימה צעדים נדרשים, טלגרם אופציונלי וקישור שבוטל לא נספר); מעורב (חבר בצוות אחד, ראש בשני) = MANAGEMENT עם צעדים של הצוות שהוא מנהל; `seen-features` idempotent, מתעלם ממפתח לא מוכר, 400 לגוף לא תקין בלי כתיבה, ונשמר אחרי login חדש (וכך גם dismiss/restore); מחיקת משתמש מוחקת את שורת המצב ב-cascade.
- [x] לא נוגעים ב-DB האמיתי (פורט 5005) לשום seed או בדיקה. — נשמר: backend e2e עובד דרך `assertTestDatabase()` (`.env.test`, postgres-test), Playwright מול backend 5006; אחרי ההרצה 0 משתמשי `test_e2e_ob_*`/`e2e_pw_*` ו-0 שורות `UserOnboardingState` נשארו ב-postgres-test. `db push` מול Neon רץ ב-2026-10-16 באישור נוה.

### לא בשלב א' (מועמד ל-`IDEAS.md`)

- צוות לדוגמה עם נתונים מדומים, כדי שמשתמש חדש יראה לוח רטרו מלא לפני שיש לו הערות משלו.
- תזכורות למשתמשים שנשרו (טלגרם/מייל) — חסום עד שיטופל BUG-59.
- סיור בועות על המסך (tooltips) למסכים הכבדים: לוח הרטרו וסיכום הספרינט.
- מצבים ריקים עשירים בכל מסך (קטגוריות, נקודות, משימות) עם CTA ייעודי.
- מסך הרשמה/הזמנה שמסביר ערך לפני יצירת חשבון.
- מדידת הטמעה בדשבורד PostHog ("הפעלה": הרשמה → צוות → ספרינט → הערות).
