## פיצ'ר 8: תצוגת "משחק זיכרון" ללוח הרטרו — עדיפות מיידית, לממש לפני שאר הפיצ'רים בתור (3, 5, 6, 7)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** אין שינוי — קורא בלבד מ-`Comment` (`content, type, category, isAnonymous, isHighlighted, author`) דרך אותו endpoint קיים.
- **Backend:** אין שינוי כלל — משתמש ב-`GET /sprints/:sprintId/comments` הקיים (`comments.service.ts::getCommentsForSprint`, כולל מיסוך האנונימיות הקיים).
- **Frontend:** `frontend/src/features/retro/components/memory-board-web.tsx`/`-native.tsx`, `memory-card-web.tsx`/`-native.tsx`, `frontend/src/features/retro/comment-display.ts` (חולץ מ-`CommentCardWeb`/`renderCommentCard` — מקור אמת משותף לתווית קטגוריה ולשם כותב), `memory-card-flip.ts` (hook משותף).
- **Endpoints:** אין חדשים.
- **תלוי בפיצ'ר 3:** תווית הקטגוריה על הקלף תעבור למקור-האמת החדש (`TeamCommentCategory`) יחד עם `comment-card-web.tsx` כשפיצ'ר 3 ייבנה — לא תלות עצמאית שצריך לזכור לעדכן בנפרד.
- **תלוי בפיצ'ר 2 (נמצא בביקורת חוצה-פיצ'רים, 2026-09-14):** `isHighlighted` מוחזר מה-API אבל לא מוצג בפועל בלוח הזיכרון — פער פתוח, ר' "ממצאי ביקורת" למטה.


**עדיפות מימוש: נוה ביקש במפורש שהפיצ'ר הזה יתועדף ראשון ויכנס למימוש עכשיו — לפני פיצ'רים 3,
5, 6, 7 שכבר מאופיינים במלואם ומחכים בתור.** כל ההחלטות המוצריות הוכרעו (ר' 8.0 למטה) — הפיצ'ר
מאופיין במלואו ומוכן למימוש. ברגע שה-`feature-orchestrator` יבחר את הפיצ'ר הבא לממש, זה אמור
להיות הפיצ'ר הזה — לא הפיצ'ר עם המספר הנמוך ביותר שמוכן למימוש, כפי שהוא נוהג כברירת מחדל (ר'
`.claude/agents/feature-orchestrator.md` לגבי הסדר הרגיל; אכיפת הסטייה הזו מטופלת בנפרד ולא
באחריות הסעיף הזה).

מטרת הפיצ'ר: להציע תצוגה חלופית ומשחקית ללוח הרטרו — התגובות (`Comment`) של הספרינט מוצגות
כקלפים הפוכים (גב הקלף בלבד, בלי תוכן) פרוסים על "קנבס", בהשראת משחק הזיכרון הקלאסי. לחיצה
בודדת הופכת קלף כדי לחשוף מה כתוב בו; לחיצה כפולה גם מגדילה אותו, כדי שטקסט ארוך יישאר קריא
גם כשהקלפים עצמם קטנים. נוה ביקש במפורש **המון אנימציות** — התחושה המבוקשת היא של משחק, לא
של טופס/רשימה.

**הבהרת scope (לא שאלה פתוחה — נובעת ישירות מתיאור הבקשה):** זו תצוגה חלופית ל"הצגת תגובות
קיימות" בלבד, לא משחק זיכרון אמיתי עם מכניקת התאמת-זוגות/תורות/ניקוד. הבקשה מתארת רק
הפיכה-בלחיצה והגדלה-בלחיצה-כפולה — אין בה זכר לזוגות/ניקוד/מנצח, ולכן הסעיף הזה לא בונה את
זה. אם ירצו מכניקת משחק אמיתית בעתיד — זה scope נפרד, לא הרחבה שקטה של הסעיף הזה.

### 8.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **אין תלות אנימציה חדשה — להשתמש במה שכבר מותקן.** נבדק ב-`frontend/package.json`:
   web כבר תלוי ב-`framer-motion` (`^13.0.0`, כבר ממוקק ב-Jest דרך
   `jest/framer-motion-mock.js` — ר' `frontend/AGENTS.md` §Testing), native כבר תלוי
   ב-`react-native-reanimated` (`4.5.1`) **וגם** ב-`Animated`/`LayoutAnimation` המובנים של
   React Native (בשימוש בפועל היום ב-`sprint-retro-board-native.tsx` שורות 96-163 —
   `wheelScale`, אפקט scale-on-press על מתג KEEP/IMPROVE דרך `Animated.spring`). זה בדיוק
   הדפוס להעתיק/להרחיב עבור אפקט ההפיכה/הגדלה של קלף — אין שום סיבה להתקין ספריית אנימציה
   שלישית (למשל `react-spring`, כפי שנבדק ולא נמצא בקוד).
2. **חריגה מודעת ומוגבלת-בהיקף לעקרון האיפוק ב-`UI-GUIDELINES.md` §6 ("תנועה") — לא ביטול
   הכלל באופן כללי.** הכלל הקיים ("`transition` על hover/focus/press בלבד, 0.15s ease;
   **אין** `Grow`/`Fade`/`Collapse` על טעינת מסך, ואין `animation: pulse`") נכתב עבור מסכי
   טופס/ניהול רגילים בפרויקט. נוה ביקש כאן במפורש "המון אנימציות" ו"תחושה של משחק" — זו
   הרשאה מוצרית מפורשת לחרוג מ-0.15s/no-Grow-Fade, **אבל רק** על אינטראקציות קלף שמופעלות
   ע"י המשתמש עצמו (הפיכה בלחיצה, הגדלה בלחיצה כפולה, ואולי ריחוף קל) — **לא** על טעינת
   *המסך/הלוח עצמו*: מעבר ל-`Page`/`PageHeader` של תצוגת הזיכרון (בלחיצה על הטאב/כפתור
   מעבר-תצוגה, ר' החלטה מוצרית #1) עדיין לא אמור לקבל אנימציית `Grow`/`Fade` על ה-mount, עקבי
   עם שאר האפליקציה. יש לתעד את החריגה הזו בהערת קוד ליד קומפוננטת הקלף החדשה, כדי שסוכן
   `ui-migration` עתידי לא "יתקן" את זה כסטייה מהדיזיין סיסטם.
3. **מקור הנתונים — אותו endpoint קיים, בלי שום שינוי backend.** הוכרע ע"י החלטה מוצרית #4
   (מצב הפוך/גלוי הוא local-בלבד לכל צופה, לא persisted, לא synced ב-MVP — ר' למטה):
   `GET /sprints/:sprintId/comments`
   (`backend/src/comments/comments.controller.ts`+`comments.service.ts::getCommentsForSprint`)
   כבר מחזיר בדיוק את כל השדות שקלף הפוך צריך: `content, type, category, isHighlighted,
   author, createdAt`, **וכבר ממסך תגובות אנונימיות בצד השרת עבור כולם, כולל admin**
   (`comments.service.ts` שורות 94-103, הערת קוד מפורשת: "no one, including admins, can
   unmask it") — כלומר "מי מחבר הקלף" לתגובה אנונימית כבר "אנונימי" ברמת ה-API, בלי צורך
   בהחלטה נפרדת על כך; החלטה מוצרית #3 למטה (הצגת שם הכותב) חלה רק על תגובות
   **לא**-אנונימיות.
4. **גב הקלף לא מציג שום מידע** (לא קטגוריה, לא KEEP/IMPROVE, לא מחבר) — סטנדרט מקובל
   במשחקי זיכרון, ועקבי עם זה שהמידע הזה ממילא לא ידוע למי שרואה קלף הפוך.
5. **מיקום קובץ/שם קומפוננטה:** `frontend/src/features/retro/components/memory-board-web.tsx`
   + `memory-board-native.tsx` (הלוח/קנבס) ו-`memory-card-web.tsx`+`memory-card-native.tsx`
   (קלף בודד) — לצד `comment-card-web.tsx`/`sprint-retro-board-web.tsx` הקיימים, אותה
   מוסכמת שמות ופיצול web/native בדיוק כמו כל שאר `features/retro/components/`.
6. **קריאת נתונים בפתיחה בלבד, בלי auto-refetch, עם כפתור "רענן" מפורש** — עקבי עם המוסכמה
   הקיימת בכל הפרויקט (`sprint-retro-board-web/native.tsx` כבר עושים `fetchComments()`
   פעם אחת ב-mount + כפתור `Strings.common.refreshButton` ידני, שורות 74-76/209 web). קלף
   שכבר נפתח ולא נסגר מחדש כשלוחצים "רענן" — זה מספיק, אין צורך במנגנון "שמור אילו קלפים
   היו פתוחים דרך רענון" בלי בקשה מפורשת לכך.
7. **תווית קטגוריה על הקלף ההפוך (אחרי הפיכה) נקראת באותו דפוס בדיוק כמו
   `comment-card-web.tsx` היום** (`Strings.retroBoard.categories[comment.category]`) —
   **לא** לבנות מקור-נתונים חדש/נפרד. אם פיצ'ר 3 (קטגוריות מותאמות לצוות) ימומש קודם, קלף
   הזיכרון יעבור לאותו מקור-אמת חדש (label מה-API) יחד עם `comment-card-web.tsx`, לא כתלות
   נפרדת שצריך לזכור לעדכן.

**החלטות מוצריות (נוה, 2026-09-06):**

1. **מיקום התצוגה: טאב/טוגל חלופי לצד לוח הרטרו הרגיל, לא מחליף אותו.** כפתור/טאב חדש
   בכותרת `SprintRetroBoard` (ליד "ערוך ספרינט"/"סיכום ספרינט" הקיימים, `sprint-retro-board-
   web.tsx` שורות ~192-217, ואותה שורת כותרת ב-native) שמחליף את גוף המסך ל-`MemoryBoard`
   (אותו דפוס `showSummary`/`<SprintSummary>` הקיים בקובץ, שורות 184-186) — לוח הרטרו הרגיל
   (הרשימה הקיימת) נשאר קיים וזמין, חוזרים אליו באותו כפתור/טאב.
2. **KEEP ו-IMPROVE: נפרדים**, בדיוק כמו בלוח הרטרו הרגיל היום — שני "לוחות זיכרון" נפרדים
   (שני קנבסים/סעיפים, אחד לכל סוג), עקבי עם `keepComments`/`improveComments`
   (`sprint-retro-board-web.tsx` שורות 138-140) שכבר מסננים כך היום.
3. **שם הכותב על קלף שהתהפך: מוצג**, כמו היום — כולל אותה לוגיקת אנונימיות הקיימת כבר
   ב-`comments.service.ts::getCommentsForSprint` (מיסוך בצד השרת, "no one, including admins,
   can unmask it") — **לא לשנות את זה**. לתגובות **לא**-אנונימיות, שם הכותב (`firstName
   lastName`/`username`) מוצג על פני הקלף אחרי ההפיכה, בדיוק כמו ב-`CommentCardWeb`/
   `renderCommentCard` הקיימים.
4. **מצב הפוך/גלוי של קלף: מקומי (local) לכל צופה בנפרד, לא synced, ב-MVP.** state בקומפוננטת
   הקלף בצד הלקוח בלבד (`useState`), לא נשמר בשרת, נעלם ברענון/כניסה מחדש (עקבי עם ברירת
   מחדל טכנית #6 — קלף שכבר נפתח לא נשאר פתוח אחרי "רענן"). **אין שינוי backend נדרש בכלל
   לצורך זה** (ר' ברירת מחדל טכנית #3). כיוון עתידי אפשרי — **לא ב-MVP, לא בסבב הזה** (ר'
   "לא בטיפול" למטה): "מוד תצוגה" משותף שבו כל הצוות נכנס יחד ל-session אחד, וכל אחד
   מהטלפון שלו הופך קלף שכולם רואים בזמן אמת — פיצ'ר נפרד עתידי אפשרי, לא הרחבה שקטה של
   הסבב הזה.
5. **הגדלה בלחיצה כפולה: סקייל-אין בתוך הלוח עצמו** (הקלף גדל במקום בתוך הקנבס, שאר הקלפים
   זזים/מתכווצים סביבו, בלי לצאת מהקנבס) — **לא** מודאל/מסך מלא. אין קומפוננטת Modal/Dialog
   משותפת קיימת ב-web כרגע (נבדק בגריפ מקיף) — ההחלטה הזו חוסכת את הצורך לבנות אחת חדשה
   מאפס.
6. **מובייל: double-tap gesture** (כמו במשחקים) לחיקוי "לחיצה כפולה" — single-tap הופך את
   הקלף, double-tap גם מגדיל. ממומש דרך `react-native-gesture-handler` (כבר מותקן), עם
   `waitFor`/`numberOfTaps(2)` כדי ש-single-tap לא "יורה" גם בלחיצה כפולה (דפוס
   gesture-handler סטנדרטי, לא זיהוי-כפול-נאיבי מבוסס-טיימר) — ר' 8.2/8.3 למימוש/בדיקה
   מדויקים.
7. **הרשאת פתיחה: כל חבר צוות** (לא admin-only) — אין guard מיוחד מעבר לחברות בצוות עצמה,
   זהה להרשאת הצפייה הרגילה של `SprintRetroBoard` כולו. **לא** נדרש `assertCanManageTeamContent`
   (שמשמש פיצ'רים 2/3/5) או כל guard אחר.

### ממצאי מחקר

- **מבנה `Comment` הקיים** (`backend/prisma/schema.prisma:202-217 (עודכן 2026-09-14)`): `content, type
  (KEEP|IMPROVE), category? (CommentCategory enum), isAnonymous, isHighlighted, createdAt,
  authorId, teamId, sprintId` — כל השדות שקלף הפוך צריך כבר קיימים, אין צורך בשדה DB חדש
  לצורך התצוגה עצמה (הוכרע שמצב הפוך/גלוי הוא local-בלבד, ר' החלטה מוצרית #4 — אילו היה
  נבחר "משותף/מסונכרן" היה נדרש שדה/טבלה חדשה, אך זה לא הכיוון שנבחר).
- **תצוגת התגובות הקיימת אינה רשימה שטוחה — היא כבר מחולקת KEEP/IMPROVE בשתי עמודות
  נפרדות** (`sprint-retro-board-web.tsx` שורות 138-140, 345-419: `keepComments`/
  `improveComments` מסוננים מ-`matchesFilters`, מוצגים ב-`<Grid columns={2}>` עם כותרת
  ירוקה/אדומה לכל עמודה). המקבילה ב-native זהה באופן מבני (`sprint-retro-board-native.tsx`,
  `renderCommentCard` בשורות 194-258, ואותו סינון `keepComments`/`improveComments`
  בהמשך הקובץ). זה ממצא ישיר להחלטה מוצרית #2 (KEEP ו-IMPROVE נפרדים, שני "לוחות זיכרון"
  נפרדים).
- **כרטיס תגובה קיים** (`CommentCardWeb`,
  `frontend/src/features/retro/components/comment-card-web.tsx`) מציג: badge קטגוריה
  (מ-`Strings.retroBoard.categories`), כפתור/אייקון כוכב הדגשה (רק ל-`canHighlight`, לפי
  `isAdmin || role==='TEAM_LEADER'`, שורות 24-29/121-123 ב-`sprint-retro-board-web.tsx`),
  תוכן התגובה, שם הכותב (`Strings.retroBoard.anonymousAuthor` אם `isAnonymous`, אחרת
  `firstName lastName` או `username`), ותאריך/שעה. המקבילה ב-native היא `renderCommentCard`
  המוטבע בתוך `sprint-retro-board-native.tsx` (שורות 194-258), אותו תוכן בדיוק. זה בדיוק
  התוכן שאמור להופיע על "פני הקלף" אחרי הפיכה.
- **מיסוך אנונימיות כבר קורה בצד השרת, לא בצד הלקוח** — `comments.service.ts::
  getCommentsForSprint` (שורות 56-103), הערת קוד מפורשת בשורה 94: "masking author if
  comment is anonymous (no one, including admins, can unmask it)". כלומר החלטה מוצרית #3
  (הצגת שם הכותב) חלה רק על תגובות **לא**-אנונימיות; לתגובות אנונימיות אין בכלל החלטה
  לקבל — השם כבר "אנונימי" מגיע מה-API.
- **תשתית אנימציה קיימת ומוכנה לשימוש חוזר:**
  - web: `framer-motion` (`^13.0.0`, `frontend/package.json`) — ממוקק ב-Jest
    (`jest/framer-motion-mock.js`, `frontend/AGENTS.md` §Testing) כך שקומפוננטת קלף שמשתמשת
    ב-`motion.div`/`AnimatePresence` תוכל להיבדק ב-Jest בלי קריסה.
  - native: `react-native-reanimated` (`4.5.1`) **וגם** `Animated` המובנה של React Native
    כבר בשימוש בפועל ב-`sprint-retro-board-native.tsx` (שורות 11, 96-163) — `wheelScale`,
    `Animated.spring` על press-in/press-out של מתג KEEP/IMPROVE. דפוס מדויק להעתיק/להרחיב
    לאפקט "press → scale/flip" של קלף זיכרון (`useNativeDriver: Platform.OS !== 'web'`,
    בדיוק כמו הקוד הקיים).
  - `frontend/UI-GUIDELINES.md` §6 ("תנועה") קובע איפוק (0.15s ease, אין Grow/Fade/pulse על
    טעינת מסך) — ר' ברירת מחדל טכנית #2 למעלה על ההיקף המדויק של החריגה המבוקשת כאן.
- **אין קומפוננטת Modal/Dialog/Lightbox משותפת קיימת ב-web** — גריפ מקיף
  (`Modal|Dialog|overlay|Lightbox`, case-insensitive) בכל `frontend/src` מעלה רק: `Modal`
  המובנה של React Native בתוך `sprint-retro-board-native.tsx` (native בלבד, לבורר
  קטגוריה, שורות 576-617: `transparent`, `animationType="fade"`, `onRequestClose`) ו-
  `comment-filter-bar-native.tsx` (מקביל, לבורר קטגוריות בפילטר). **ב-web אין שום מקבילה** —
  לא רלוונטי יותר בפועל: **הוכרע (החלטה מוצרית #5) שההגדלה היא סקייל-אין בתוך הקנבס, לא
  מודאל** — לכן אין צורך לבנות קומפוננטת Modal חדשה ב-web בכלל.
- **`team.members?.find(m => m.userId === user.id)` הוא הדפוס הקיים לגזירת `isAdmin`/
  `role` של המשתמש הנוכחי בתוך `SprintRetroBoard`** (`sprint-retro-board-web.tsx` שורה 122,
  `sprint-retro-board-native.tsx` שורה 175) — כבר בשימוש עבור `canHighlight`/
  `canExportSummary`/`canEditSprint`. **לא רלוונטי כאן**: הוכרע (החלטה מוצרית #7) שהרשאת
  הפתיחה היא "כל חבר צוות" — אין צורך בבדיקת `isAdmin`/`role` נוספת בכלל, לא בצד frontend
  ולא ב-backend.
- **`trackEvent()`** (`frontend/src/lib/analytics.ts`) — כלל קבוע בפרויקט: כל כפתור/toggle
  חדש (כפתור מעבר לתצוגת הזיכרון, כל הפיכת קלף, כל הגדלת קלף) צריך קריאת `trackEvent()`
  משלו, כמו בכל שאר הפיצ'רים בבאקלוג הזה.
- **`<Grid columns={n}>` הקיים** (`frontend/UI-GUIDELINES.md`) בנוי למספר טורים קבוע של
  בלוקים גדולים (למשל 2 עמודות KEEP/IMPROVE) — לא בהכרח מתאים ללוח-קלפים חופשי עם מספר
  קלפים משתנה (תלוי בכמות התגובות בספרינט). ככל הנראה תידרש פריסת flex-wrap/CSS grid
  ייעודית לקנבס הקלפים (עדיין עם ריווח/רדיוס מ-tokens בלבד, לפי `UI-GUIDELINES.md` §1-2),
  לא שימוש מאולץ ב-`<Grid columns={n}>` הקיים לכל הקנבס עצמו — רק המסך העוטף (`<Page>`)
  חייב עדיין לעטוף את כל התצוגה.

### 8.1 Backend

- [x] **אין נדרש שינוי Backend עבור ה-MVP — אומת בפועל מול הקוד החי (2026-09-06).**
      `backend/src/comments/comments.controller.ts:23-30` (`getCommentsForSprint`) קורא רק
      ל-`validateToken` ולשירות — אין guard נוסף מעבר לחברות בצוות, תואם החלטה מוצרית #7.
      `comments.service.ts::getCommentsForSprint` (שורות 56-109) מחזיר spread מלא של
      `Comment` (לפי `schema.prisma:202-217 (עודכן 2026-09-14)`: `content, type, category, isAnonymous,
      isHighlighted, createdAt` ועוד) יחד עם `author: {id, username, firstName, lastName}`
      — כל שדה שקלף הפוך צריך קיים בפועל. מיסוך האנונימיות (שורות 94-108) מוחלף בקבוע
      `{id:0, username:'Anonymous', firstName:'Anonymous', lastName:''}` ללא יוצא מן הכלל
      ל-admin, בדיוק כפי שתועד. לא בוצע שום שינוי קוד — הטענה מאומתת כלשונה; הרצתי
      `comments.spec.ts` הקיים כבדיקת שפיות (11/11 עוברים, ללא שינוי).

### 8.2 Frontend

- [x] `frontend/src/features/retro/components/memory-board-web.tsx` +
      `memory-board-native.tsx` — קומפוננטת הקנבס: מקבלת את אותה רשימת תגובות שכבר נטענת
      ע"י `SprintRetroBoard` (`fetchComments()` הקיים, בלי endpoint נוסף — ר' ברירת מחדל
      טכנית #3), מציגה **שני קנבסים/סעיפים נפרדים** — "שימור" (KEEP) ו"שיפור" (IMPROVE) —
      לפי אותו סינון `keepComments`/`improveComments` הקיים (`sprint-retro-board-web.tsx`
      שורות 138-140), עם כותרת ירוקה/אדומה כמו בעמודות הקיימות (ר' החלטה מוצרית #2).
      פריסת כל קנבס: flex-wrap/CSS grid ייעודי לקלפים (לא `<Grid columns={n}>` הקיים — ר'
      ממצאי מחקר), עדיין בתוך `<Page>` עוטף.
      **ממומש (2026-09-06):** שני הקבצים נוצרו; כל קנבס עושה `fetchComments()` משלו בעצמו
      (אותו endpoint, אותו דפוס mount-fetch + כפתור רענון ידני כמו `SprintSummary`), הקנבסים
      מוצגים אחד מתחת לשני (לא side-by-side) כדי להימנע מבעיית הדחיסה במובייל שכבר תועדה
      ב-`UI-GUIDELINES.md` §11. פריסת קלפים: `Box`/`View` עם `flexWrap`, לא `Grid`.
- [x] `memory-card-web.tsx`/`memory-card-native.tsx` — קלף בודד עם state מקומי בלבד
      (`useState`, לא persisted, ר' החלטה מוצרית #4): `isFlipped`, `isEnlarged`.
      - **web**: `onClick` הופך (`isFlipped`); `onDoubleClick` הופך **וגם** מגדיל
        (`isEnlarged`, ר' החלטה מוצרית #5). אנימציית הפיכה: `framer-motion` (`motion.div` +
        `rotateY` + `transformStyle:'preserve-3d'`, `AnimatePresence` למעבר גב/פנים).
        אנימציית הגדלה: `motion.div` עם `layout`+`scale`/`zIndex` מוגבר כדי לגדול **בתוך
        הקנבס עצמו** (סקייל-אין-פלייס, לא מודאל), שאר הקלפים מקבלים `layout` transition
        כדי "לזוז"/להתכווץ סביבו.
      - **native**: single-tap הופך; double-tap (ר' החלטה מוצרית #6 — דרך
        `react-native-gesture-handler` שכבר מותקן: `Gesture.Tap().numberOfTaps(2)` +
        `Gesture.Tap().numberOfTaps(1).requireExternalGestureToFail(doubleTapGesture)` כדי
        ש-single-tap לא "יורה" גם בלחיצה כפולה) הופך **וגם** מגדיל. אנימציה:
        `react-native-reanimated`/`Animated.spring` (בהשראת `wheelScale` ב-
        `sprint-retro-board-native.tsx` שורות 96-163) על `rotateY`/`scale`.
      **ממומש (2026-09-06):** web משתמש בזיהוי single/double-click ידני (טיימר ~220ms) במקום
      `onClick`+`onDoubleClick` נפרדים — הדפדפן יורה `click,click,dblclick` על לחיצה כפולה,
      מה שהיה מכפיל את הטיפול ב-click בודד. native משתמש ב-`Animated.spring` (לא reanimated,
      עקבי עם `wheelScale` הקיים) + `Gesture.Tap()` בדיוק לפי המפרט; נוסף `GestureHandlerRootView`
      ב-`_layout.tsx` (נדרש בפועל ל-`GestureDetector`, לא היה קיים בשורש עד כה).
- [x] גב הקלף: עיצוב אחיד מטוקנים בלבד (לפי `UI-GUIDELINES.md`), **בלי שום מידע** — לא
      קטגוריה, לא KEEP/IMPROVE, לא מחבר (ר' ברירת מחדל טכנית #4). פני הקלף (אחרי הפיכה):
      תוכן התגובה, badge קטגוריה (`Strings.retroBoard.categories[comment.category]`, אותו
      דפוס בדיוק כמו `CommentCardWeb`/`renderCommentCard` היום — ר' ברירת מחדל טכנית #7),
      שם הכותב (`Strings.retroBoard.anonymousAuthor` אם `isAnonymous`, אחרת `firstName
      lastName`/`username` — מוצג תמיד לתגובות לא-אנונימיות, ר' החלטה מוצרית #3), תאריך/שעה.
      לחלץ/לייבא תוכן זה משותף עם `CommentCardWeb`/`renderCommentCard` הקיימים אם אפשר, או
      לפחות להעתיק במפורש עם הערת קוד שמצביעה על המקור — כדי לא ליצור כפילות שיוצאת
      מסונכרנת.
      **ממומש (2026-09-06):** נוצר `frontend/src/features/retro/comment-display.ts`
      (`getCommentCategoryLabel`/`getCommentAuthorName`), חולץ מ-`CommentCardWeb` ומ-
      `renderCommentCard` (שניהם עודכנו להשתמש בו במקום הלוגיקה המשוכפלת) וגם משמש את שני
      קומפוננטות הקלף — מקור אמת יחיד במקום 4 עותקים.
- [x] נקודת כניסה: כפתור/טאב חדש "משחק זיכרון" בכותרת `SprintRetroBoard` (ליד "ערוך
      ספרינט"/"סיכום ספרינט" הקיימים, `sprint-retro-board-web.tsx` שורות ~192-217, ואותה
      שורת כותרת ב-native) שמחליף את גוף המסך ל-`MemoryBoard` (אותו דפוס
      `showSummary`/`<SprintSummary>` הקיים, שורות 184-186) — לוח הרטרו הרגיל נשאר זמין,
      חוזרים אליו באותו כפתור/טאב (ר' החלטה מוצרית #1). **בלי** אנימציית `Grow`/`Fade` על
      ה-mount של המסך עצמו (ר' ברירת מחדל טכנית #2 — החריגה חלה רק על אינטראקציות הקלף, לא
      על מעבר המסך).
      **ממומש (2026-09-06):** `showMemoryBoard` state ב-`sprint-retro-board-web/native.tsx`,
      אותו דפוס בדיוק כמו `showSummary`; כפתור/טאב "משחק זיכרון" בשורת הפעולות (אייקון `eye`).
- [x] הרשאת גישה לכפתור/טאב: **כל חבר צוות** (ר' החלטה מוצרית #7) — בלי בדיקת
      `isAdmin`/`role` נוספת, זהה להרשאת הצפייה הרגילה של `SprintRetroBoard` כולו.
      **ממומש (2026-09-06):** אין שום תנאי `canHighlight`/`canExportSummary`/`canEditSprint`
      דומה על הכפתור החדש — מוצג לכל חבר צוות תמיד.
- [x] `trackEvent()` על: פתיחת התצוגה (הכפתור/טאב), כל הפיכת קלף, כל הגדלת קלף — לפי הכלל
      הקבוע בפרויקט.
      **ממומש (2026-09-06):** `memory_board_opened`, `memory_card_flipped`,
      `memory_card_enlarged`.
- [x] `Strings.retroBoard.*` (או `Strings.memoryBoard.*` חדש) — מחרוזות עבריות חדשות: שם
      הכפתור/טאב ("משחק זיכרון"), כותרות שני הקנבסים (שימור/שיפור), טקסט מצב-ריק (ספרינט
      בלי תגובות בכלל, לכל קנבס בנפרד).
      **ממומש (2026-09-06):** `Strings.memoryBoard.*` חדש ב-`constants/strings.ts`.
- [x] הערת קוד מפורשת ליד קומפוננטות הקלף (`memory-card-web.tsx`/`memory-card-native.tsx`)
      על החריגה המוגבלת-בהיקף מ-`UI-GUIDELINES.md` §6 (ר' ברירת מחדל טכנית #2) — כדי
      שסוכן `ui-migration` עתידי לא "יתקן" את זה כסטייה מהדיזיין סיסטם.
      **ממומש (2026-09-06):** הערת בלוק בראש שני הקבצים.

### 8.3 בדיקות

- [x] Playwright e2e (web): כל חבר צוות (כולל חבר רגיל, לא admin/TEAM_LEADER — ר' החלטה
      מוצרית #7) רואה את כפתור/טאב "משחק זיכרון" ויכול לפתוח אותו; רואה שני קנבסים נפרדים
      (שימור/שיפור); קלפים מוצגים הפוכים בלבד (בלי טקסט תגובה גלוי בשום מקום ב-DOM/
      accessibility tree לפני הפיכה — לא רק "מוסתר ויזואלית"); `click` בודד הופך קלף
      וחושף תוכן+שם כותב (לתגובה לא-אנונימית)/"אנונימי" (לתגובה אנונימית); `dblclick` על
      קלף שכבר הפוך מגדיל אותו בתוך הקנבס (לא מודאל/ניווט לעמוד אחר — לוודא ש-URL/מבנה
      הקנבס לא משתנה, רק scale/z-index של הקלף); חזרה ללוח הרטרו הרגיל דרך אותו כפתור/טאב.
      **ממומש (2026-09-06):** `frontend/e2e/memory-board.spec.ts`, טסט ראשון — משתמש שנוסף
      כ-`DEVELOPER` רגיל (לא admin/leader) פותח את הלוח, רואה 2 קנבסים, קלפים הפוכים
      (`getByText(commentContent)` מחזיר count=0 לפני הפיכה — לא CSS-hidden), הופך קלף KEEP
      לא-אנונימי (תוכן+קטגוריה+שם משתמש אמיתי נחשפים) וקלף IMPROVE אנונימי (מוצג "אנונימי"),
      dblclick על הקלף שכבר הפוך מגדיל אותו (`boundingBox().width` גדל) בלי שינוי `page.url()`
      ותוך שהכותרות של שני הקנבסים עדיין על המסך, וחזרה ללוח הרגיל דרך כפתור "חזרה ללוח".
      Desktop+Mobile Chrome, שניהם עוברים.
- [x] Playwright e2e: הפיכת קלף אינה persisted — טעינה מחדש של העמוד (או פתיחה בהקשר
      דפדפן/משתמש שני) מציגה את כל הקלפים הפוכים מחדש (מאמת בפירוש את החלטה מוצרית #4 —
      local, לא synced).
      **ממומש (2026-09-06):** `memory-board.spec.ts`, טסט שני. גילוי אגב הכתיבה: ניווט
      צוות/ספרינט/לוח באפליקציה הזו הוא state של React בלבד, לא route תחת `src/app/` — לכן
      `page.reload()` תמיד מחזיר לרשימת הצוותים (לא רק מאפס את מצב ההפיכה), והטסט צריך
      לנווט מחדש עד ללוח הזיכרון אחרי הרענון לפני שבודקים שהקלפים חזרו להיות הפוכים; זה עדיין
      מוכיח את הדבר הנכון (אין שום state של הפיכה ששרד בשום מקום). כיסוי גם למשתמש שני
      (`browser.newContext()` נפרד, ה-leader) שרואה את אותו ספרינט הפוך-לגמרי, בלי קשר
      להפיכות של המשתמש הראשון. Desktop+Mobile Chrome, שניהם עוברים. **תיקון (2026-09-06):**
      הטסט הזה עושה שלושה round-trip מלאים של login+ניווט (נביגציה ראשונית, reload+ניווט
      מחדש, ואז context שני עם ניווט משלו) — נמדד ~24-26 שניות גם בהרצה מבודדת ונקייה, קרוב
      מדי ל-timeout ברירת המחדל של Playwright (30s), וקורס כשהוא רץ מאוחר בתוך ריצה ארוכה
      ורציפה (`workers: 1`) של כל הסוויטה. נוסף `test.setTimeout(60_000)` לטסט הזה בלבד —
      לא באג במימוש, רק מרווח timeout צר מדי לכמות הצעדים האמיתית בטסט הזה.
- [x] Jest לקומפוננטת הקלף (`memory-card-web.tsx`): מצב התחלתי הפוך; `click` בודד →
      `isFlipped=true`; `dblclick` על קלף הפוך → `isEnlarged=true` בנוסף; תוכן/badge
      קטגוריה/שם כותב מוצגים נכון אחרי הפיכה, כולל מקרה `isAnonymous`.
      **ממומש (2026-09-06):** `frontend/src/features/retro/components/__tests__/memory-card-
      web.test.tsx`, 5 טסטים, כולם עוברים. אין `@testing-library/react` בפרויקט (רק
      `/react-native`, `/jest-dom`, `/user-event`) והקומפוננטה הזו MUI+framer-motion בלבד —
      הטסט מרכיב ישירות עם `react-dom/client` + `act` תחת `@jest-environment jsdom` (override
      per-file, כי ה-preset הגלובלי `jest-expo` הוא `node`, בלי `document`). **גילוי אגב
      הכתיבה, לא באג ייצור:** `jest/framer-motion-mock.js` (המוק המשותף ל-`framer-motion`)
      בונה `React.forwardRef` חדש בכל גישה ל-`motion.div` (Proxy `get`), כלומר טיפוס
      קומפוננטה חדש בכל render — מה שגורם ל-React להחליף/למחוק ולבנות מחדש את ה-DOM node בכל
      עדכון state; רפרנס ל-`motion.div` שנתפס פעם אחת (למשל דרך `querySelector`) הופך stale
      אחרי כל אינטראקציה שמשנה state. אין לזה השפעה בפרויקט האמיתי (`motion.div` האמיתי הוא
      קומפוננטה יציבה וממוקדת-זיכרון) — רק ארטיפקט של המוק ב-Jest; הטסטים כתובים כך שכל
      אינטראקציה שולפת מחדש את האלמנט החי (`getCard()`) במקום להחזיק רפרנס ישן.
- [x] Jest ל-hook המשותף (`useMemoryCardFlip`, `memory-card-flip.ts`) ולפונקציות התצוגה
      המשותפות (`getCommentCategoryLabel`/`getCommentAuthorName`, `comment-display.ts`) —
      נוסף בנפרד מריצת `feature-tests` המקורית, אחרי שהלוגיקה המשותפת חולצה מ-`memory-card-
      web.tsx`/`memory-card-native.tsx` לקובץ אחד (כדי לצמצם כפילות/לאפשר שימוש חוזר).
      **ממומש (2026-09-06):** `frontend/src/features/retro/__tests__/memory-card-flip.test.ts`
      (9 טסטים — מצב התחלתי, flip/flipAndEnlarge בכל הכיוונים, קריאות `trackEvent` המדויקות,
      וסדר קריאה ל-`onFlip`/`onResize` שהגרסה native מסתמכת עליו) ו-`comment-display.test.ts`
      (8 טסטים — מיפוי קטגוריה ידועה/לא ידועה/חסרה, הרכבת שם מלא/חלקי/fallback ל-username,
      ומקרה `isAnonymous`). **גילוי אגב הכתיבה:** `renderHook`/`act` בגרסת
      `@testing-library/react-native` המותקנת כאן הן אסינכרוניות בפועל — `act(() => ...)`
      לא-awaited עלול להשאיר את `result.current` stale/null באינטראקציה הבאה; הפתרון
      העקבי שאומת היה `await act(async () => { ... })` לכל אינטראקציה.
- [x] בדיקת מובייל — `Mobile Chrome` project ב-Playwright, עקבי עם כל שאר הפיצ'רים
      בבאקלוג — כולל אימות ספציפי למחוות ה-double-tap (לא ניתן "להעתיק" בדיקת web
      `dblclick` בלי אימות שהמחווה בפועל עובדת על viewport מובייל דרך
      `react-native-gesture-handler`): single-tap הופך, double-tap הופך+מגדיל, בלי
      להתנגש עם double-tap-to-zoom של הדפדפן במובייל.
      **ממומש (2026-09-06):** `memory-board.spec.ts`, טסט שלישי, מדלג (`test.skip`) על
      Desktop Chrome ורץ רק תחת `Mobile Chrome` (`hasTouch`), משתמש ב-`page.touchscreen.tap()`
      אמיתי (לא `dblclick()` של עכבר) — tap בודד הופך, שני tap-ים רצופים על אותו קלף מגדילים
      אותו (`boundingBox().width` גדל), ו-`window.visualViewport.scale` נשאר 1 (לא זום). **הבהרה
      עובדתית חשובה, לא סתם ניואנס טכני:** `frontend/e2e` תמיד רץ מול `npm run web:e2e` (בניית
      Expo web דרך Metro) — כלומר `Platform.OS === 'web'` **תמיד**, בלי קשר לאמולציית ה-device
      של הפרויקט (`devices['Pixel 7']` היא רק viewport+`hasTouch`+UA, לא build native). לכן
      `MemoryBoard`/`memory-board.tsx` תמיד בוחר את ה-branch של `MemoryBoardWeb`/
      `MemoryCardWeb` — **הקוד של `memory-card-native.tsx` (`Gesture.Tap()`,
      `requireExternalGestureToFail`, `react-native-gesture-handler`) לעולם לא רץ תחת
      Playwright, בשום project, כולל "Mobile Chrome"**, ולכן לא ניתן לאמת אותו קוד ספציפית
      עם הכלים הקיימים בריפו (אין Detox/Maestro/native test runner). הטסט כאן מאמת את
      **ההתנהגות המבוססת-מגע של גרסת ה-web** (זיהוי single/double click הידני מבוסס-טיימר
      ב-`memory-card-web.tsx`) תחת viewport מובייל אמיתי עם `touchscreen.tap()`, לא dblclick
      עכבר מועתק — זה המקסימום הניתן לאימות בכלי הבדיקה הקיימים, ועקבי עם איך שכל שאר הפיצ'רים
      בבאקלוג הזה כבר משתמשים ב-project "Mobile Chrome" (בדיקת responsive/מגע על ה-web build,
      לא native אמיתי).

### ממצאי ביקורת חוצה-פיצ'רים (2026-09-14)

- **פיצ'ר 2 (הדגשת הערות) × לוח הזיכרון: תגובה מודגשת לא מסומנת ככזו בלוח הזיכרון בפועל.**
  `GET /sprints/:sprintId/comments` מחזיר `isHighlighted` במלואו (ר' touchpoints למעלה), אבל
  אין שום שימוש ב-`isHighlighted` בפועל ב-`memory-board-web.tsx`/`memory-card-web.tsx`/
  `memory-card-native.tsx`/`comment-display.ts` — תגובה שסומנה "מודגשת" ע"י מנהל תיראה
  בלוח הזיכרון בדיוק כמו כל תגובה אחרת, בזמן שבתצוגת הלוח הרגילה (`comment-card-web.tsx`)
  היא כן מסומנת. **זו לא הייתה החלטה מוצרית מפורשת בשום מקום** (לא כאן ולא בפיצ'ר 2) —
  ולכן זו לא תוקנה בשקט. **שאלה פתוחה לנוה:** האם תגובה מודגשת צריכה להיראות אחרת גם
  כשהיא מוצגת דרך לוח הזיכרון (המשחקי/הפוך-כברירת-מחדל), או שזו אי-התאמה מכוונת (למשל כי
  גב הקלף ההפוך ממילא לא מציג מידע, ור' החלטה #4 למעלה — "עקבי עם זה שהמידע הזה ממילא לא
  ידוע למי שרואה קלף הפוך" עשוי לחול גם על הדגשה, אך זה לא נאמר במפורש)?
- **פיצ'ר 8 עצמו לא מתעד תלות בפיצ'ר 2** — סעיף ה-touchpoints למעלה מזכיר רק תלות בפיצ'ר 3
  (קטגוריות), לא בפיצ'ר 2 — למרות שהוא כן קורא/מציג `isHighlighted`. תוקן ב-touchpoints.

### לא בטיפול (פיצ'ר 8)

- **מכניקת משחק זיכרון אמיתית** (זוגות/תורות/ניקוד) — מחוץ לתחולה, ר' "הבהרת scope" למעלה.
- **session משותף/synced (multiplayer) למצב הפוך/גלוי** — כיוון עתידי אפשרי שנוה הזכיר
  במפורש, אך **לא** חלק מהסבב הזה (ר' החלטה מוצרית #4). אם ייבנה בעתיד: כל הצוות נכנס יחד
  ל"מוד תצוגה" משותף, וכל אחד מהטלפון שלו הופך קלף שכולם רואים בזמן אמת — זה ידרוש **state
  בצד השרת per-comment** (טבלה חדשה, למשל `CommentCardReveal`: `commentId` FK ל-`Comment`
  cascade, `isRevealed Boolean`, `revealedAt DateTime?`) **וגם** מנגנון broadcast/polling
  בין צופים (אין שום תשתית WebSocket/SSE קיימת בפרויקט היום) — לא רק state מקומי
  בקומפוננטה כמו במימוש הנוכחי. לתעד כפיצ'ר נפרד דרך `product-manager` כשהצורך בזה יעלה
  בפני עצמו.
- **מודאל/מסך מלא להגדלת קלף** — נדחה במפורש (החלטה מוצרית #5), סקייל-אין-פלייס בתוך
  הקנבס בלבד.
