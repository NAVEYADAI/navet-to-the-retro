## פיצ'ר 3: קטגוריות מותאמות לצוות

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `TeamCommentCategory` (חדש) — `id, teamId (FK cascade), label, isDefault, isEnabled, createdById?, createdAt`; `Comment.category` (enum) **מוחלף** ב-`Comment.categoryId Int?` (FK); `enum CommentCategory` מוסר מה-schema.
- **Backend:** מודול חדש `backend/src/team-categories/` (על תבנית `backend/src/invites/`), `backend/src/comments/comments.service.ts::create` (ולידציית `categoryId`), משתמש ב-`assertCanManageTeamContent` (`team-permissions.util.ts`, נוצר בפיצ'ר 2).
- **Frontend:** `category-management-panel.tsx` (חדש, web+native, על תבנית `invite-links-panel.tsx`), `team-card.tsx` (הטמעה), `sprint-retro-board-web.tsx`/`-native.tsx` (בורר קטגוריה בטופס), `comment-filter-bar-web.tsx`/`-native.tsx`, `comment-card-web.tsx` (תווית קטגוריה).
- **Endpoints:** `GET/POST /teams/:teamId/categories`, `PATCH /teams/:teamId/categories/:categoryId`.
- **משפיע על:** פיצ'ר 1 (אגרגציית מצגת עדיין מול ה-enum הישן — חוב טכני פתוח לעדכון), פיצ'ר 8 (תווית קטגוריה על קלף זיכרון עוברת לאותו מקור-אמת חדש כשזה יבנה).
- **סיכון migration:** backfill חד-פעמי ל-13 קטגוריות דיפולטיות לכל צוות קיים + מיפוי `Comment.category` הישן ל-`categoryId` — לתכנן בזהירות, לא לסמוך על `@default()`.


מטרת הפיצ'ר: לאפשר לראש צוות ולמנהל צוות לקבוע אילו קטגוריות תגובה זמינות לצוות שלהם —
להתחיל מרשימת קטגוריות דיפולטיות, לכבות כאלה שלא רלוונטיות, ולהוסיף קטגוריות מותאמות-אישית
משלהם. **לפי צוות, לא לפי המשתמש הספציפי שהגדיר** — כל חברי הצוות רואים את אותה רשימה.

### 3.0 החלטות (חלק מפורש מנוה, חלק ברירת-מחדל טכנית סבירה מסומנת בפירוש)

1. **היקף — לפי צוות** (מפורש מנוה): קטגוריה חדשה/כיבוי קטגוריה דיפולטית נשמרים על
   `teamId`, נראים לכל חברי הצוות זהה, לא תלויים במי שביצע את הפעולה.
2. **הרשאה לניהול (ברירת מחדל טכנית, עקבי עם פיצ'ר 2):** `isAdmin===true ||
   role==='TEAM_LEADER'`, אותה הגדרה בדיוק כמו ב"הדגשת הערות" (פיצ'ר 2). **הguard כבר קיים
   בקוד** — `backend/src/teams/team-permissions.util.ts::assertCanManageTeamContent` (נוצר
   בזמן מימוש פיצ'ר 2) — להשתמש בו ישירות, לא לשכפל את הבדיקה.
3. **מחיקה מול השבתה (ברירת מחדל טכנית):** קטגוריות דיפולטיות **לא נמחקות**, רק מושבתות
   (`isEnabled=false`) — כדי לא לאבד את השיוך ההיסטורי של תגובות ישנות שכבר תויגו בהן.
   קטגוריות מותאמות-אישית — MVP תומך רק ביצירה+השבתה, לא מחיקה, לאותה סיבה.
4. **Seeding לצוותים קיימים (סיכון שדורש תשומת לב מפורשת):** צוותים חדשים יקבלו את 13
   הקטגוריות הדיפולטיות אוטומטית ביצירה. **צוותים קיימים** צריכים מיגרציה חד-פעמית: לזרוע
   13 קטגוריות דיפולטיות לכל צוות קיים, ואז למפות כל `Comment.category` (ה-enum הישן) ל-
   `categoryId` המתאים בטבלה החדשה של אותו צוות ספציפי. זהו בדיוק אותו סוג סיכון שכבר תועד
   קודם בפרויקט — backfill לא-זהיר עלול לשייך תגובות לקטגוריה הלא-נכונה או להשאיר
   `categoryId` ריק. לתכנן סקריפט מיגרציה ידני, לא להסתמך על `@default()` של Prisma.

### ממצאי מחקר

- **המצב הקיים הוא enum גלובלי, לא טבלה.** `CommentCategory` ב-`schema.prisma` הוא enum
  Prisma קבוע (13 ערכים), לא נתון DB לפי-צוות. `Comment.category` הוא שדה מה-enum הזה ישירות.
  Frontend לא בכלל מתייחס אליו כ-TS type — כל רשימת הקטגוריות (תיוג, בורר בטופס כתיבה,
  ה-filter bar) נשלפת מ-`Strings.retroBoard.categories` (`frontend/src/constants/strings.ts`
  ~שורות 121-134), אובייקט קבוע וגלובלי, לא ממאגר נתונים.
- **נקודות מגע קונקרטיות שישתנו:**
  - בורר קטגוריה בטופס כתיבת תגובה: `sprint-retro-board-web.tsx` (`Field type="select"`,
    `categoryOptions` בשורות ~100-102) ו-`sprint-retro-board-native.tsx` (pill/modal, שורה
    ~359) — שניהם בונים את האפשרויות מ-`Object.entries(Strings.retroBoard.categories)`.
  - `comment-filter-bar-web.tsx` (שורה ~56) ו-`-native.tsx` (שורה ~131) — אותו דבר בדיוק.
  - תווית קטגוריה על כרטיס תגובה: `comment-card-web.tsx` (שורה ~23) ו-הבלוק המקביל ב-native
    board — היום `Strings.retroBoard.categories[comment.category]`, יצטרך לקרוא את השם
    ישירות מנתון שמגיע מה-API (לא מ-`Strings` יותר).
  - `backend/src/comments/comments.service.ts::create` מעביר `dto.category` ישירות ל-Prisma
    בלי שום ולידציה מפורשת (`CreateCommentDto.category?: CommentCategory` ללא
    class-validator decorators) — האכיפה כרגע רק ברמת ה-enum constraint של Postgres. זה
    יצטרך ולידציה אמיתית ברגע שהופך לטבלה (לוודא שה-`categoryId` שייך לצוות של הספרינט וגם
    מסומן `isEnabled`).
  - שום שירות backend אחר לא נוגע ב-`category` (נבדק בגריפ מקיף) — רק `comments.service.ts`.
- **תבנית מבנית קיימת שמתאימה כמעט אחד-לאחד — `TeamInvite`.**
  `backend/prisma/schema.prisma` (שורות ~60-76): ישות פר-צוות עם `teamId` (cascade),
  `createdById`, ודגל בוליאני לביטול-רך (`isRevoked`) במקום מחיקה. ה-guard ב-
  `backend/src/invites/invites.service.ts` (`assertIsTeamAdmin()`, שורה ~14, בודק
  `TeamMember.isAdmin`) וה-controller המלא (`POST/GET/PATCH teams/:teamId/invites`) הם תבנית
  מוכנה להעתקה עבור טבלת קטגוריות פר-צוות.
- **תבנית UI קיימת שמתאימה אחד-לאחד — `InviteLinksPanel`.**
  (`team-list-web/invite-links-panel.tsx` + מקבילה native): פאנל admin-gated עם toggle
  expand/collapse (שליפת נתונים רק כשנפתח, לא ב-mount), טופס "+ יצירה" מוטבע, ורשימת
  פריטים עם badge סטטוס + כפתורי פעולה. מוטבע ב-`team-card.tsx` (שורות ~129-131) מיד אחרי
  שורת החברים, מותנה ב-`isTeamAdmin && !isPending`. פאנל "ניהול קטגוריות" חדש יושב באותו
  מקום בדיוק, באותו דפוס אינטראקציה.

### 3.1 Backend

- [ ] מודל Prisma חדש `TeamCommentCategory` (או שם דומה): `id, teamId (FK, cascade), label,
      isDefault: Boolean, isEnabled: Boolean @default(true), createdById: Int?, createdAt`.
- [ ] `Comment.category` (enum) **מוחלף** ב-`Comment.categoryId Int?` (FK ל-
      `TeamCommentCategory`, nullable כמו היום). הסרת `enum CommentCategory` מה-schema.
- [ ] מיגרציית backfill חד-פעמית: לכל צוות קיים — יצירת 13 השורות הדיפולטיות + מיפוי
      `Comment.category` הישן ל-`categoryId` החדש של אותו צוות. **לתכנן ולבדוק בזהירות**
      לפני הרצה על נתוני production.
- [ ] Seeding אוטומטי ל-13 הדיפולטיביים בזמן יצירת צוות חדש (ב-`teams.service.ts::create`).
- [ ] מודול חדש `backend/src/team-categories/` (controller+service+dto), על תבנית
      `backend/src/invites/`: `GET /teams/:teamId/categories` (כל הקטגוריות, כולל מושבתות —
      לשימוש פאנל הניהול; אפשר פרמטר `?enabledOnly=true` לשימוש טופס כתיבת תגובה),
      `POST /teams/:teamId/categories` (יצירת קטגוריה מותאמת, guard לפי החלטה 3.0.2),
      `PATCH /teams/:teamId/categories/:categoryId` (toggle `isEnabled`, אותו guard).
- [ ] `comments.service.ts::create` + `CreateCommentDto`: ולידציה אמיתית (לא רק constraint
      של DB) — `categoryId` (אם קיים) חייב להשתייך לאותו `teamId` של הספרינט וגם להיות
      `isEnabled===true`, אחרת שגיאה ברורה במקום כישלון Prisma סתום.
- [ ] `getCommentsForSprint` מחזיר את שם הקטגוריה (label) בתגובה (join, לא רק id) — כדי
      שהפרונט לא יצטרך לשלוף רשימת קטגוריות בנפרד רק כדי להציג תווית קיימת.

### 3.2 Frontend

- [ ] פאנל חדש "ניהול קטגוריות" (`category-management-panel.tsx`, web+native), מבוסס ישירות
      על דפוס `invite-links-panel.tsx`: toggle expand/collapse, שליפה בפתיחה, רשימת
      קטגוריות עם badge (דיפולטית/מותאמת) ו-switch הפעלה/כיבוי לכל שורה, טופס "+ הוסף
      קטגוריה" מוטבע ליצירת מותאמת-אישית. הרשאה: לפי החלטה 3.0.2 (לא `isTeamAdmin` בלבד —
      לוודא ש-`team-card.tsx` מחשב גם דגל `canManageCategories` חדש, לא רק `isTeamAdmin`
      הקיים).
- [ ] הוספת הפאנל ל-`team-card.tsx` (web+native), מיד אחרי `InviteLinksPanel`, אותו תנאי
      `!isPending`.
- [ ] בורר הקטגוריה בטופס כתיבת תגובה (`sprint-retro-board-web.tsx`/`-native.tsx`) עובר
      משליפה סטטית מ-`Strings.retroBoard.categories` לשליפה דינמית של קטגוריות הצוות
      (`enabledOnly=true`) — אותו widget (`Field type="select"` ב-web, pill/modal ב-native),
      רק מקור הנתונים משתנה.
- [ ] `comment-filter-bar-web.tsx`/`-native.tsx`: אותו מעבר לשליפה דינמית — אבל **כולל
      קטגוריות מושבתות** אם יש תגובות קיימות שמתויגות בהן (אחרת תגובה ישנה הופכת בלתי
      ניתנת-לסינון ברגע שהקטגוריה שלה כובתה).
- [ ] `comment-card-web.tsx` + הבלוק המקביל ב-native: תווית קטגוריה נקראת מנתון שמגיע עם
      התגובה מה-API (label מוחזר מ-`getCommentsForSprint`), לא יותר מ-`Strings` לפי מפתח.
- [ ] `Strings.retroBoard.categories` נשאר כרשימת ה-**seed** הדיפולטיבית בלבד (משמש את
      ה-backfill/ה-seeding ב-backend), מפסיק להיות מקור האמת ל-UI ב-runtime.

### 3.3 בדיקות

- [ ] Playwright e2e: admin/ראש-צוות יכול לכבות קטגוריה דיפולטית ולהוסיף קטגוריה מותאמת;
      חבר צוות רגיל **לא** רואה את פאנל הניהול; טופס כתיבת תגובה מציג רק קטגוריות מופעלות;
      קטגוריה שכובתה עדיין ניתנת לסינון בתגובות קיימות.
- [ ] Jest לרכיבים החדשים ולשינויים ב-board/filter-bar.
- [ ] בדיקה ידנית של המיגרציה על עותק/סביבת פיתוח לפני production — לא לסמוך על בדיקה
      אוטומטית בלבד לצעד הזה.

### לא בטיפול (פיצ'ר 3)

- מחיקה קשיחה של קטגוריה מותאמת-אישית שאין לה תגובות — אפשר להוסיף בעתיד, לא ב-MVP.
- שינוי שם (rename) לקטגוריה קיימת — MVP תומך רק הפעלה/כיבוי/יצירה.
