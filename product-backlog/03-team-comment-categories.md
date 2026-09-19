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

- [x] מודל Prisma חדש `TeamCommentCategory`: `id, teamId (FK, cascade), label, isDefault:
      Boolean, isEnabled: Boolean @default(true), createdById: Int?, createdAt`. הוסף
      `backend/prisma/schema.prisma`, כולל יחס `createdBy` ל-`User` (`SetNull`).
- [x] `Comment.category` (enum) **הוחלף** ב-`Comment.categoryId Int?` (FK ל-
      `TeamCommentCategory`, `onDelete: SetNull`, nullable כמו היום). `enum CommentCategory`
      הוסר מה-schema. נבדק סוף-לסוף מול `postgres-test`: `\d "Comment"`/`pg_type` מאמתים
      שהעמודה/ה-enum הישנים נעלמו ושה-FK החדש קיים.
- [x] מיגרציית backfill חד-פעמית: `backend/scripts/backfill-team-comment-categories.js`
      (dry-run כברירת מחדל, `--confirm` לכתיבה בפועל; אידמפוטנטי — ריצה חוזרת היא no-op).
      **נבדק בפועל** מול `postgres-test`: הורץ מצב schema ביניים (גם `category` הישן וגם
      `categoryId` החדש קיימים יחד), זרעתי 2 צוותי-בדיקה + הערות עם ערכי enum ישנים
      (כולל צוות עם קטגוריה דיפולטית אחת שכבר קיימת מראש, לבדוק אי-כפילות), הרצתי את
      הסקריפט, ואימתתי ב-SQL ישיר שכל הערה מוצאת את ה-`categoryId` הנכון **בטווח הצוות שלה**,
      שלא נוצרו קטגוריות כפולות, ושהערה ללא קטגוריה נשארה ללא שינוי. נתוני הבדיקה נוקו
      בסוף. **הסקריפט הורץ בהצלחה גם מול Neon האמיתי** (`--confirm`) ואומת באופן עצמאי
      (`TeamCommentCategory`: 104 שורות/8 צוותים, `Comment.categoryId`: 14 שורות מאוכלסות) —
      אין עוד צעד ידני פתוח.
- [x] Seeding אוטומטי ל-13 הדיפולטיביים בזמן יצירת צוות חדש — `teams.service.ts::create`,
      קריאת `teamCommentCategory.createMany` נפרדת מיד אחרי יצירת הצוות. מקור הרשימה:
      `comment-category-labels.ts::DEFAULT_CATEGORY_LABELS` (אותם 13 label בדיוק, גם
      לסקריפט ה-backfill). מכוסה ב-`teams.service.spec.ts`.
- [x] מודול חדש `backend/src/team-categories/` (controller+service+dto), על תבנית
      `backend/src/invites/`: `GET /teams/:teamId/categories` (`?enabledOnly=true` לשימוש
      טופס כתיבת תגובה, ברירת מחדל כוללת מושבתות לשימוש פאנל הניהול — הצפייה עצמה **אינה**
      guard-מוגבלת ל-admin/leader, בניגוד ל-invites, כי כל חבר צוות צריך לראות את הרשימה),
      `POST /teams/:teamId/categories` (יצירת קטגוריה מותאמת, `assertCanManageTeamContent`),
      `PATCH /teams/:teamId/categories/:categoryId` (toggle `isEnabled`, אותו guard). מכוסה
      ב-`team-categories.service.spec.ts`.
- [x] `comments.service.ts::create` + `CreateCommentDto`: ולידציה אמיתית — `categoryId` (אם
      קיים) חייב להשתייך לאותו `teamId` של הספרינט (`NotFoundException` אחרת) וגם להיות
      `isEnabled===true` (`BadRequestException` אחרת). מכוסה ב-`comments.service.spec.ts`.
- [x] `getCommentsForSprint` מחזיר `category: { id, label }` (join, לא רק `categoryId`) —
      כדי שהפרונט לא יצטרך לשלוף רשימת קטגוריות בנפרד רק כדי להציג תווית קיימת (גם אם
      הקטגוריה כבר הושבתה בינתיים — היא עדיין מחזירה label). אותו join גם ב-
      `sprints.service.ts::exportSummaryPptx` (תוקן כדי שימשיך להתקמפל אחרי הסרת ה-enum —
      חוב טכני פיצ'ר 1 עדיין קיים במובן שאין UI לבחור template/aggregation חדש, אבל הקוד
      עצמו עכשיו קורא מהמקור-אמת החדש, לא מה-enum הישן).

**הערה לרכז/למשתמש:** ה-schema הועבר בהצלחה (`db push`) גם מול `postgres-test` וגם מול Neon
האמיתי (production). ה-`db push` וסקריפט ה-backfill (`backend/scripts/backfill-team-comment-
categories.js --confirm`) הורצו בפועל מול Neon ואומתו באופן עצמאי: `TeamCommentCategory` קיימת
(104 שורות, 8 צוותים), `Comment.categoryId` קיימת ומאוכלסת (14 שורות), ו-`enum CommentCategory`
+ עמודת `Comment.category` הישנים הוסרו לגמרי. אין עוד צעד ידני פתוח בנושא הזה.

### 3.2 Frontend

- [x] פאנל חדש "ניהול קטגוריות" (`category-management-panel.tsx`, web+native) — נוצר תחת
      `features/teams/components/team-list-{web,native}/`. משלב את מבנה הרשימה+badge+טופס
      "+ הוסף קטגוריה" המוטבע של `invite-links-panel.tsx` עם דפוס ה-`isExpanded` + שליפה-
      רק-בפתיחה של `sprint-length-history-panel-{web,native}.tsx` (שכבר עדכני יותר מ-
      `invite-links-panel.tsx` עצמו, שכיום שולף ב-mount). switch הפעלה/כיבוי: `Switch` מ-
      `@/components/ui` ב-web, RN `Switch` הגולמי ב-native (אותו דפוס בדיוק כמו
      `team-member-row.tsx`). נוסף אייקון `tag` חדש ל-`icon.tsx`/`icon.native.tsx`
      (REGISTRY+IconName) לכפתור הפתיחה. הרשאה: `team-card.tsx` מחשב `canManageCategories`
      כדגל נפרד (alias ל-`canManageTeamContent` הקיים, אותו predicate בדיוק לפי החלטה 3.0.2)
      — עוקב אחרי דפוס ה-alias הקיים כבר ב-`sprint-retro-board-*.tsx`
      (`canHighlight`/`canViewLengthHistory`/`canPostOnBehalf`). כל switch/כפתור שולח
      `trackEvent`.
- [x] הפאנל מוטמע ב-`team-card.tsx` (web+native). הערה: `InviteLinksPanel` עצמו כבר לא יושב
      ישירות ב-`team-card.tsx` נכון לעכשיו (מוזג לתוך `AddMemberForm` ב-2026-09-14, מצב שהיה
      אחרי כתיבת הבאקלוג) — הפאנל הוצב במקום המקביל: מיד אחרי `AddPhantomMemberForm`/לפני
      `TeamSprintsManager`, עדיין מותנה ב-`canManageCategories && !isPending`.
- [x] בורר הקטגוריה בטופס כתיבת תגובה (`sprint-retro-board-web.tsx`/`-native.tsx`) עבר
      לשליפה דינמית מ-`GET /teams/:teamId/categories` (state חדש `categoryId`/`teamCategories`,
      נשלף פעם אחת ב-mount לפי `team.id` — לא בכל focus, עקבי עם כלל ה-freshness של הפרויקט).
      נשלף ללא `enabledOnly=true` (הרשימה המלאה) כדי לשרת גם את הפילטר-בר מאותה קריאה אחת
      (ר' הפריט הבא); הבורר עצמו מסנן `isEnabled` בצד לקוח לפני בניית האופציות. אותו widget
      בדיוק (`Field type="select"` ב-web, pill+modal ב-native) — רק מקור הנתונים והreset אחרי
      פרסום (`setCategoryId('')`) השתנו. ה-payload שנשלח לשרת עבר מ-`category` ל-`categoryId`
      (תואם ל-`CreateCommentDto` המעודכן).
- [x] `comment-filter-bar-web.tsx`/`-native.tsx` קיבלו prop חדש `categoryOptions` (מחליף את
      ה-`Object.entries(Strings.retroBoard.categories)` הפנימי). ההורה (`sprint-retro-board-*`)
      מחשב את הרשימה: `teamCategories.filter(c => c.isEnabled || usedCategoryIds.has(c.id))`
      כאשר `usedCategoryIds` נגזר מה-`categoryId` של התגובות שכבר נטענו — כך קטגוריה שכובתה
      נשארת ברשימת הפילטר כל עוד יש לפחות תגובה קיימת שמתויגת בה.
- [x] `comment-card-web.tsx` + `renderCommentCard` ב-`sprint-retro-board-native.tsx`: שניהם
      כבר עברו דרך `getCommentCategoryLabel` המשותף (`comment-display.ts`) — עודכן שם בלבד
      (מקור יחיד): קורא כעת `comment.category?.label` (האובייקט המצורף מה-API) במקום
      `Strings.retroBoard.categories[comment.category]`. אותו עדכון תבנית `DisplayableComment`
      השפיע גם על לוח הזיכרון (`memory-card-flip.ts`, פיצ'ר 8) ששולף מאותו endpoint ומשתמש
      באותה פונקציה משותפת — קיבל את התווית הנכונה בחינם, ללא שינוי לוגיקה משלו.
- [x] `Strings.retroBoard.categories` נשאר במקום (הערה נוספה בקוד) כרשימת ה-seed הדיפולטיבית
      בלבד לצורך ה-backend; אף קומפוננטת UI לא קוראת ממנו יותר ב-runtime.

### 3.3 בדיקות

- [x] Playwright e2e (`frontend/e2e/team-comment-categories.spec.ts`, Desktop+Mobile Chrome):
      ראש-צוות מכבה קטגוריה דיפולטית ("בדיקות") ומוסיף קטגוריה מותאמת-אישית דרך ה-UI האמיתי;
      חבר צוות רגיל **לא** רואה את פאנל הניהול בכלל (נבדק `toHaveCount(0)`, לא רק חבוי); טופס
      כתיבת תגובה מציג רק קטגוריות מופעלות (גם לראש-צוות וגם לחבר רגיל); קטגוריה שכובתה נשארת
      ניתנת לסינון על תגובה קיימת שכבר תויגה בה דרך ה-filter bar, למרות שהיא נעדרת מבורר
      הקומפוזיציה של תגובה חדשה — בדיוק מקרה הקצה ש-§3.2 בנה לו תמיכה. עובר על שני הפרויקטים.
      **תוך כדי כתיבת הבדיקות התגלה רגרסיה אמיתית** (לא קשורה לקובץ החדש): ארבע בדיקות e2e
      קיימות מפיצ'רים אחרים (`comment-highlighting.spec.ts`, `retro-comment-filters.spec.ts`,
      `sprint-summary-export.spec.ts`, `memory-board.spec.ts`) עדיין יצרו תגובות עם השדה הישן
      `category: 'STRING_ENUM'` בגוף הבקשה — לאחר המעבר ל-`categoryId` (§3.1) השדה הזה פשוט
      מתעלם בשקט (אין ולידציה, `backend/AGENTS.md`), אז התגובות נוצרו בלי קטגוריה בכלל ואיפסו
      את ה-assertions. תוקנו כל ארבעת הקבצים לשלוף את מזהה הקטגוריה האמיתי מ-
      `GET /teams/:teamId/categories` ולשלוח `categoryId`. כל הסוויטה (12 קבצים, 30
      טסטים/2 פרויקטים) ירוקה אחרי התיקון.
- [x] **נמצא ותוקן באג אמיתי (לא רק טסט שגוי):** `frontend/src/features/sprint-summary/stats.ts`
      (`computeSprintSummaryStats`) עדיין קרא ל-`comment.category` כמפתח למחרוזת enum ישנה
      (`Strings.retroBoard.categories[comment.category]`) — אבל ה-API כבר מחזיר `category` כאובייקט
      מצורף `{ id, label }` (§3.1). התוצאה בפועל: מסך "סיכום ספרינט" **קרס** (React "Objects are
      not valid as a React child") בכל ספרינט עם הערה מקוטלגת — נתפס דרך
      `sprint-summary-export.spec.ts` שנשבר. תוקן לקרוא דרך ה-util המשותף הקיים
      `getCommentCategoryLabel` (`features/retro/comment-display.ts`), אותו מקור שכבר משמש את
      כרטיסי התגובה. `frontend/src/features/sprint-summary/__tests__/stats.test.ts` עודכן לפיקסצ'רים
      בצורת ה-API החדשה (כולל טסט לקטגוריה מותאמת-אישית/מושבתת) ומאמת את התיקון.
- [x] Jest לרכיבים החדשים ולשינויים ב-board/filter-bar:
      `frontend/src/features/teams/components/team-list-native/__tests__/category-management-panel.test.tsx`
      (חדש) — fetch-on-expand בלבד, יצירת קטגוריה מותאמת + `trackEvent`, toggle
      isEnabled עם PATCH + `trackEvent`, rollback אופטימי על כשל PATCH, ולידציית שם ריק.
      `frontend/src/components/__tests__/sprint-retro-board.test.tsx` — נוספה
      `describe('disabled-category edge case...')`: מוודא שבורר הקומפוזיציה **לעולם** לא מציע
      קטגוריה מושבתת (בשימוש או לא), בעוד ה-filter bar כן ממשיך להציע קטגוריה מושבתת שנמצאת
      בשימוש בתגובה טעונה, ושהיא אכן שמישה לסינון בפועל. הכיסוי הקיים לסינון לפי קטגוריה
      (`filters by category`, `supports selecting multiple categories` וכו') כבר נכתב בסבב
      frontend-feature הקודם ונשאר ירוק. כל 15 הטסטים בקובץ עוברים.
      בדיקת `trackEvent`: כל control חדש בפאנל הניהול (show/hide, פתיחת טופס יצירה, יצירה,
      toggle) שולח `trackEvent` — נבדק במפורש בטסטים החדשים, אין פער.
- [x] בדיקה ידנית של המיגרציה על עותק/סביבת פיתוח לפני production: כבר בוצעה בפועל ואומתה
      באופן עצמאי (ר' ההערה תחת §3.1 ותמצית הסטטוס ב-README) — `db push` + סקריפט ה-backfill
      (`--confirm`) רצו מול Neon האמיתי; `TeamCommentCategory` (104 שורות/8 צוותים) ו-
      `Comment.categoryId` (14 שורות מאוכלסות) אומתו דרך read-only introspection, וה-enum/עמודה
      הישנים אינם קיימים יותר. אין צעד ידני נוסף פתוח בנושא הזה — סעיף זה מתעד שזה קרה, לא
      מריץ אותו מחדש.

### לא בטיפול (פיצ'ר 3)

- מחיקה קשיחה של קטגוריה מותאמת-אישית שאין לה תגובות — אפשר להוסיף בעתיד, לא ב-MVP.
- שינוי שם (rename) לקטגוריה קיימת — MVP תומך רק הפעלה/כיבוי/יצירה.
