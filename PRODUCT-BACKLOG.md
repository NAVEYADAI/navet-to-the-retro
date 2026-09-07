# באק לוג מוצרי

מקום אחד ומתמשך לאיפיון תכולות עתידיות לאפליקציה — כל פיצ'ר נכנס כאן כסעיף עצמאי, בסדר
שנוח לאפיין אותו (לא לפי סדר מימוש). אפשר לאפיין כמה פיצ'רים מבלי לממש אף אחד מהם, ולחזור
בהמשך להריץ מימוש של סעיף ספציפי מתי שנוח.

**הבחנה מ-`UI-MIGRATION-BACKLOG.md`:** הקובץ הזה הוא לתכולות מוצר חדשות (פיצ'רים). הקובץ
השני הוא checklist טכני נפרד למעבר עיצוב של מסכים קיימים לדיזיין סיסטם — לא חלק מהבאק לוג
הזה, ולא מתמזג אליו.

**שום פריט בקובץ הזה לא מומש**, אלא אם צוין אחרת בפירוש בתוך סעיף ספציפי.

**הקובץ הזה עבר לשורש הריפו (היה קודם ב-`frontend/`)** כי הוא חוצה backend+frontend. מונע על ידי שלושה subagents תחת `.claude/agents/`: `backend-feature` (מסעיף "Backend" של הפיצ'ר הבא), `frontend-feature` (מסעיף "Frontend", רק אחרי שה-Backend שלו סגור), ו-`feature-orchestrator` (מריץ את שניהם ברצף לפיצ'ר הבא). כדי שהם יזהו נכון מה בוצע — כל תת-סעיף (`### X.1 Backend` / `### X.2 Frontend` / `### X.3 בדיקות`) צריך checklist עם `- [ ]`/`- [x]`, לא רק פרוזה חופשית.

---

## תמצית סטטוס — שורה אחת לכל פיצ'ר

טבלה זו היא **נגזרת** מהסעיפים המלאים למטה — לא מקור אמת עצמאי. מטרתה לאפשר לדעת אילו תכולות
כבר מאופיינות ואפשר להוסיף/לממש בלי לקרוא את כל הקובץ. כל סוכן שמוסיף/סוגר פיצ'ר (`product-manager`,
`backend-feature`, `frontend-feature`, `feature-tests`) מעדכן כאן את השורה שלו כחלק מהעבודה שלו —
אם השורה כאן לא תואמת את הסעיף המלא, הסעיף המלא הוא הנכון (ר' `PRODUCT-BACKLOG.md` §<N> לפרטים).

| # | פיצ'ר | סטטוס |
|---|-------|-------|
| 1 | ייצוא ספרינט למצגת (Sprint Summary) | מומש (MVP) — נשארו 3 פריטים תלויי-פיצ'ר 2/3 + אימות ידני מול תוכנת מצגות אמיתית |
| 2 | הדגשת הערות | מומש ✅ |
| 3 | קטגוריות מותאמות לצוות | מאופיין במלואו, מוכן למימוש — טרם הותחל |
| 4 | עריכת ספרינט לאחר יצירה | מומש ✅ |
| 5 | תיעוד היסטוריית שינויי אורך ספרינט (Audit Log) | מאופיין במלואו, מוכן למימוש — טרם הותחל |
| 6 | שילוב עם יומן Google — שלב א' | מאופיין במלואו, **חסום** עד שנוה ייצור Google Cloud OAuth client (ר' §6.0.1) |
| 7 | אימות כתובת דואר אלקטרוני (Email Verification) | מאופיין במלואו, מוכן למימוש — טרם הותחל |
| 8 | תצוגת "משחק זיכרון" ללוח הרטרו — **עדיפות מיידית** | מומש ✅ |

---

## פיצ'ר 1: ייצוא ספרינט למצגת (Sprint Summary)

מטרת הפיצ'ר: להפיק ערך מהתוכן שנאסף ברטרו — מי שיצר את הצוות יכול להוריד מצגת (PowerPoint)
שמציגה את כל מה שקרה בספרינט, מאורגן לפי קטגוריות, דרך אזור "סיכום ספרינט" ייעודי שנפתח מתוך
לוח הרטרו. כמה עיצובים מוגדרים-מראש ניתנים לבחירה.

### 1.0 החלטות שנקבעו מראש — לקרוא לפני שמתחילים

1. **נקודת כניסה:** כפתור בתוך הכותרת של `SprintRetroBoard` (web+native) שפותח מסך/אזור סיכום
   חדש — לא פריט נפרד ברשימת הספרינטים (`sprint-list-web/native.tsx`).
2. **הרשאת גישה — יוצר הצוות **או** מנהל צוות (`isAdmin===true`), לא לפי `role`.** נבדק
   בקוד: `Team.creatorId` (`backend/prisma/schema.prisma`, מודל `Team`) הוא שדה FK אמיתי
   ומפורש שנקבע פעם אחת בזמן יצירת הצוות. `TeamMember.role` (כולל הערך `TEAM_LEADER`, המוצג
   כ"ראש צוות") הוא — לפי הערת קוד מפורשת ב-`backend/src/teams/teams.service.ts`
   (ליד `addMember`) — **"role is just a free-text job title, isAdmin is the actual permission
   flag"**, לכן לא משמש כאן. **עודכן (2026-09-01) לבקשת נוה:** בהתחלה ההרשאה הייתה `creatorId`
   בלבד; הורחבה כך שגם `isAdmin===true` מספיק (`team.creatorId === user.id ||
   membership.isAdmin`) — ב-web/native (`sprint-retro-board-*.tsx`, `canExportSummary`) וב-
   backend (`sprints.service.ts::exportSummaryPptx`, בודק `TeamMember.isAdmin` כשלא היוצר).

   (הערה: בפיצ'ר 2 למטה — "הדגשת הערות" — נוה כן בחר להשתמש ב-`role==='TEAM_LEADER'` בתור
   קריטריון הרשאה, לצד `isAdmin`. זו החלטת מוצר שונה לפיצ'ר שונה, לא סתירה: `role` פשוט לא
   אמין מספיק בתור "האם זה יוצר הצוות" הספציפי הזה, אבל בהחלט שימושי בתור "מישהו עם תפקיד
   ניהולי" לצורך פיצ'ר אחר.)
3. **פורמט וארכיטקטורה:** PPTX, נוצר **בצד השרת** (Node), לא client-side. סיבה: native לא
   יכול להפיק קובץ pptx בדפדפן (אין Blob-download כמו ב-web), אבל כן יכול לקרוא ל-endpoint
   ולשמור/לשתף קובץ בינארי שחוזר ממנו — כך web ו-native חולקים את אותה לוגיקת ייצור. **שום**
   ספריית ייצוא מסמכים (pptx/pdf/docx) לא מותקנת כרגע באף `package.json` בפרויקט — תידרש
   התקנה חדשה (למשל `pptxgenjs`, שתומכת גם בהרצת Node.js בצד שרת).

### ממצאי מחקר תומכים

- **מודל נתונים** (`backend/prisma/schema.prisma`): `Comment` = `content, type: CommentType
  (KEEP|IMPROVE), category?: CommentCategory`. `CommentCategory` הוא enum בן 13 ערכים:
  `SPRINT_SETUP, PRE_PLANNING, PLANNING, ONGOING_WORK, TESTING, AVAILABILITY, ESTIMATIONS,
  SPECIFICATIONS, TASK_DISTRIBUTION, PERSONAL, FUN, GENERAL, TECHNICAL` — שדה אופציונלי, בלי
  טבלת Category נפרדת. ל-`Sprint` אין שדה "סגור" ב-DB בכלל — "סגור" נגזר בצד הלקוח מהשוואת
  תאריכים (`getSprintState()` ב-`sprint-list-web.tsx`).
- **Endpoint קיים לשימוש חוזר:** `GET /sprints/:sprintId/comments`
  (`backend/src/comments/comments.controller.ts` + `comments.service.ts::getCommentsForSprint`)
  כבר מחזיר את כל התגובות של ספרינט ממוינות לפי `createdAt`, כולל `author` (עם מיסוך
  "אנונימי" כש-`isAnonymous`). אין בו pagination או סינון קטגוריה בצד שרת כרגע.
- **תוויות עברית לקטגוריות** כבר קיימות ב-`frontend/src/constants/strings.ts` (סביבות שורות
  121-135), אין צורך לכתוב אותן מחדש.
- **נקודת ההשחלה:** `SprintRetroBoard` (`frontend/src/features/retro/index.tsx`) מקבל היום
  `{sprint, team, token, user, onBack}` בלבד — צריך לוודא ש-`team.creatorId` באמת מגיע דרך
  שרשרת ה-props/API הזו (או להוסיף אותו לתשובת ה-API אם חסר). כותרת ה-web היא
  `<PageHeader title={sprint.name} action={<Button onPress={onBack}>...} />` ב-
  `sprint-retro-board-web.tsx` (סביבות שורה 107) — יש מקום טבעי לפעולה נוספת שם. כותרת
  ה-native היא שורה ידנית עם `flexWrap` (`sprint-retro-board-native.tsx`, שורות ~192-227,
  תוקנה כבר בסבב מובייל קודם) — כפתור חדש יצטרך להצטרף לשורה הזו או לשבת מתחתיה.
- אין שום תשתית export/pdf/pptx/report קיימת בקוד — נבדק בגריפ מקיף בבאקאנד ובפרונטאנד.

### 1.1 Backend — תשתית ייצור PPTX (MVP, תבנית עיצוב אחת) — done

- [x] הותקנה `pptxgenjs` ב-`backend/package.json` (דרך `npm install --workspace=backend
      --legacy-peer-deps` — ה-workspace הכללי דורש `--legacy-peer-deps` בגלל התנגשות peer
      לא-קשורה של `react-test-renderer` בפרונטאנד).
- [x] `backend/src/sprints/sprint-summary.builder.ts` — מקבץ תגובות לפי `category` (כולל
      `null` כ"ללא קטגוריה") ובתוך כל קטגוריה לפי `type`. תוויות קטגוריה משוכפלות ב-
      `backend/src/comments/comment-category-labels.ts` (אין חבילה משותפת בין frontend
      ל-backend, מתועד בקוד כטעון סנכרון ידני).
- [x] אותו קובץ בונה את המצגת בפועל: שקף כותרת, שקף לכל קטגוריה (KEEP ירוק/IMPROVE אדום),
      שקף "סיכום מספרי" עם טבלה. `rtlMode: true` על כל המצגת. **תקלה שנייה שנתפסה ותוקנה
      (2026-09-01, לפי דיווח נוה):** `pptx.rtlMode` ברמת המצגת **לא** מספיק כדי להפוך את
      התבליטים (bullets) ברשימות KEEP/IMPROVE — ה-hanging indent (`marL`/`indent`) של
      pptxgenjs תמיד יחסי לשמאל אלא אם ה-**פסקה עצמה** מסומנת `rtl="1"` (אומת ע"י פירוק ה-
      XML בפועל: לפני התיקון לא היה `rtl="1"` בכלל על פסקאות עם bullet, למרות `algn="r"`).
      תוקן ע"י הוספת `rtlMode: true` לכל item ב-`bulletsFor()` (לא רק ברמת המצגת) — אומת שוב
      ב-XML שהתבליטים מקבלים `rtl="1"` בפועל.
- [x] `GET /teams/:teamId/sprints/:sprintId/summary/export`
      (`backend/src/sprints/sprints.controller.ts`+`sprints.service.ts::exportSummaryPptx`).
      Guard: יוצר הצוות **או** מנהל צוות (`isAdmin`) → אחרת 403 (הורחב מ-creator-בלבד,
      2026-09-01, ר' סעיף 1.0.2 למעלה). **תקלה שנתפסה ותוקנה באימות ידני:**
      עם `@Res({passthrough:true})` NestJS מסדרר את ה-Buffer המוחזר ל-JSON
      (`{"type":"Buffer","data":[...]}`) במקום לשלוח בייטים גולמיים — קובץ שהורד היה "JSON
      data" לא-תקין. תוקן ל-`@Res() res: Response` + `res.send(buffer)` ישירות, בלי להחזיר
      ערך מה-handler. אומת ע"י פתיחת קובץ pptx שהורד בפועל בדפדפן ואישור שהוא zip תקין עם
      3 שקפים ותוכן נכון.
- [x] **שם הקובץ המורד (2026-09-01, לפי בקשת נוה):** במקום `sprint-summary-{id}.pptx` —
      `{שם הספרינט} - {תאריך ההפקה}.pptx` (`buildExportFileName()` ב-
      `sprint-summary.builder.ts`, מסנן תווים לא-חוקיים בשם קובץ מתוך שם ספרינט חופשי).
      נשלח דרך `Content-Disposition` עם `filename*=UTF-8''...` (RFC 5987) כי השם בעברית —
      `filename=` הרגיל תומך רק ASCII. דרש גם `app.enableCors({exposedHeaders:
      ['Content-Disposition']})` ב-`main.ts` — הכותרת הזו לא ב-CORS safelist כברירת מחדל,
      אז ה-frontend לא היה יכול לקרוא אותה בלי זה. web קורא את השם מהכותרת (`extractFileName()`
      ב-`sprint-summary-web.tsx`); native מקבל אותו אוטומטית דרך `File.downloadFileAsync`
      (שקורא Content-Disposition בעצמו). אומת בהורדה אמיתית בדפדפן.
- [x] ספרינט בלי תגובות מקבל שקף "אין עדיין תגובות בספרינט זה" (נבדק בקוד, לא נבדק ידנית
      עם ספרינט ריק בפועל — סיכון נמוך, לוגיקה פשוטה).
- [ ] **שקף/סעיף ייעודי לתגובות מודגשות** (`Comment.isHighlighted`) — עדיין תלוי בפיצ'ר 2,
      לא מומש.
- [ ] **תלות חוצה-פיצ'רים לפיצ'ר 3 (קטגוריות מותאמות לצוות):** לא מומש — האגרגציה עדיין
      מול ה-`enum CommentCategory` הישן. **חוב טכני פתוח**: לעדכן ל-join מול
      `TeamCommentCategory` כשפיצ'ר 3 ייבנה.

### 1.2 Frontend — נקודת כניסה + מסך סיכום בסיסי (MVP, חוסם ע"י 1.1) — done (web+native)

- [x] `team.creatorId` כבר מגיע ל-`SprintRetroBoard` בלי שינוי — `teams.service.ts::
      getTeamsForUser` עושה `...m.team spread` שכולל את כל השדות הסקלריים של `Team`, כולל
      `creatorId`. לא נדרש שינוי API.
- [x] כפתור "סיכום ספרינט" נוסף ל-`action` של `PageHeader` (web) ולשורת הכותרת (native, לצד
      כפתור החזרה), מוצג רק כש-`team.creatorId === user.id`. נוספו אייקונים חדשים
      `presentation`+`download` ל-`components/ui/icon.tsx`+`icon.native.tsx`.
- [x] נוצר `frontend/src/features/sprint-summary/` (`index.tsx` + `components/
      sprint-summary-web.tsx` + `components/sprint-summary-native.tsx` + `stats.ts` משותף
      לשני הפלטפורמות לחישוב הסטטיסטיקות).
- [x] מסך סיכום: סה"כ תגובות, פילוח KEEP/IMPROVE, פירוט לפי קטגוריה, כפתור הורדה.
- [x] הורדה במימוש מלא: **web** — `axios` עם `responseType:'blob'` + `URL.createObjectURL`
      + קישור זמני; **native** — `File.downloadFileAsync` (מה-API החדש של
      `expo-file-system`, לא ה-legacy) עם `Authorization` header ישירות ל-`Directory`, ואז
      `expo-sharing`. שתי הספריות הותקנו (`npx expo install expo-file-system expo-sharing
      -- --legacy-peer-deps`, אותה סיבה כמו ב-backend). **תקדים ראשון להורדת קובץ ב-native
      בקוד הזה** — לא תועד עדיין ב-UI-GUIDELINES (פריט פתוח, ראה "לא בטיפול" למטה).
- [x] `Strings.sprintSummary.*` נוסף.
- [ ] בחירת תבנית עיצוב (סעיף 1.3) — עדיין לא מומש, תבנית עיצוב יחידה בלבד כרגע.

### 1.3 תבניות עיצוב לבחירה — done (2026-09-01)

הוחלט מול נוה (שאלת "כמה מורכב זה?") ללכת על **swatch צבע + שם**, לא thumbnail חזותי מלא —
תואם את מה שסוכם כברירת המחדל.

- [x] 3 ערכות עיצוב מוגדרות-מראש ב-`SPRINT_SUMMARY_TEMPLATES`
      (`backend/src/sprints/sprint-summary.builder.ts`): `classic` (קלאסי, ברירת מחדל, הצבעים
      המקוריים), `dark` (כהה — רקע שקף כהה בפועל דרך `slide.background`, לא רק צבעי טקסט),
      `vibrant` (צבעוני — כחול/טורקיז/כתום). `resolveTemplateId()` נופל בחזרה ל-`classic`
      עבור כל ערך לא-מוכר, כולל `undefined`.
- [x] פרמטר `template` נוסף ל-endpoint הקיים (`GET
      .../summary/export?template=<id>`, `@Query('template')` ב-controller) — לא endpoint
      נפרד. מועבר עד ל-`buildSprintSummaryPptx`.
- [x] UI: swatch עגול-צבע + שם ("קלאסי"/"כהה"/"צבעוני"), לא thumbnail — ב-
      `sprint-summary-web.tsx` (`Box component="button"`) וב-`sprint-summary-native.tsx`
      (`TouchableOpacity`). מטא-דאטת ה-UI (`id, label, swatch`) כפולה במכוון ב-
      `frontend/src/features/sprint-summary/templates.ts`, מסונכרנת ידנית מול הבאקאנד (אותו
      דפוס כמו `comment-category-labels.ts`).
- [x] אומת בהורדה אמיתית: נבחרה תבנית "כהה", הקובץ שהורד נפתח ונבדק ב-XML — `slide.background`
      אכן כהה (`1B1B2F`) וטקסטים בהתאם (`F5F5F5`/`66BB6A`/`EF5350`), לא רק שינוי קוד בלי אימות.

**הרחבה (2026-09-02, לבקשת נוה): תבניות עם מעברים, פריסות שונות ופונטים — לא רק צבע — done.**

לפני המימוש נבדקה בפועל היכולת האמיתית של `pptxgenjs`: **אין לה שום תמיכה במעברי שקופיות**
(אף לא אזכור אחד של "transition" בכל החבילה) — נדרשה הזרקת XML ידנית. אופציית `fontFace`
אומתה כקובעת גם `<a:cs>` (complex script) ולא רק `<a:latin>`, כלומר משפיעה בפועל על טקסט
עברי. פריסה שונה-לכל-שקף התאפשרה ברמת **פאנל/באנר קבוע-מיקום** (לא ליד כל שורת תבליט בנפרד
— `pptxgenjs` לא חושף מיקום שורות בטקסט זורם).

- [x] `backend/package.json`: `jszip` נוסף כתלות ישירה (הייתה קיימת טרנזיטיבית דרך
      `pptxgenjs` בלבד).
- [x] `backend/src/sprints/pptx-post-process.util.ts` (קובץ חדש): `applySlideTransitions()` —
      פותח את קובץ ה-pptx כ-zip עם JSZip, מזריק `<p:transition>` (OOXML) ממש לפני `</p:sld>`
      בכל שקף, אורז מחדש. אומת שההזרקה נוחתת במקום הנכון (אחרי `</p:cSld><p:clrMapOvr>...`).
- [x] כל תבנית קיבלה `fontFace` (`classic`=Calibri, `dark`=Tahoma, `vibrant`=Arial — כולם
      סטנדרטיים ב-Windows/Mac ותומכי עברית, כי אין הטמעת פונטים בקובץ), `transitionXml`
      (`classic`=fade, `dark`=push שמאלה, `vibrant`=wipe ימינה), ו-`layout`
      (`'plain'|'cards'|'banner'`).
- [x] `decorateTitleSlide()`/`decorateCategorySlide()` ב-`sprint-summary.builder.ts`: `cards`
      מוסיף פס דקורטיבי מתחת לכותרת בשקף הפתיחה, ושני פאנלים (`roundRect`, שקיפות 88%) מאחורי
      עמודות שימור/שיפור בשקפי הקטגוריה; `banner` מוסיף רצועת `rect` צבעונית מלאה מאחורי
      הכותרת (טקסט לבן עליה) גם בשקף הפתיחה וגם בכל שקף קטגוריה. `classic` (`plain`) ללא שינוי.
- [x] `vibrant` (`banner`) גם מקבל תו-תבליט שונה (`■`, ריבוע מלא) במקום הנקודה הרגילה של
      `classic`/`dark` — פרט עיצובי שכן נתמך ברמת-ריצה (per-run), בניגוד לצורות ליד כל שורה.
- [x] **אומת מבנית (לא ויזואלית — אין PowerPoint בסביבה הזו) עבור שלוש התבניות**: נוצרו 3
      קבצים אמיתיים דרך סקריפט חד-פעמי, כל אחד נפתח כ-zip ונבדק ב-XML: תג `<p:transition>`
      הנכון בכל שקף, `<a:cs typeface="...">` בהתאם לתבנית, מספר צורות `roundRect`/`rect`
      התואם בדיוק למספר הצפוי (למשל `vibrant`: 3 ב-slide פתיחה, 6 ב-slide קטגוריה — 5
      תיבות-טקסט + 1 באנר), ותו התבליט הנכון (`&#x2022;` מול `&#x25A0;`). חזרה על אותה בדיקה
      גם על קובץ שהורד בפועל מהדפדפן (לא רק מהסקריפט) — תוצאה זהה.
- [ ] **לא אומת חזותית בתוכנת מצגות אמיתית** (PowerPoint/Keynote/Google Slides) — אין גישה
      לכזו בסביבת הפיתוח הזו. אם המעברים/הפריסות לא נראים כמצופה בפועל, ייתכן שיידרש כיוונון
      (למשל ערכי `spd`/`dir` של המעבר, או מיקומי הפאנלים) — לבדוק בפעם הראשונה שנפתח קובץ
      אמיתי בתוכנה אמיתית.

### 1.4 בדיקות ותיעוד (אחרי ש-1.1-1.2 עובדים; 1.3 לא חוסם)

- [x] Playwright e2e — `frontend/e2e/sprint-summary-export.spec.ts` (Desktop+Mobile Chrome,
      שניהם עוברים): יוצר-צוות פותח ספרינט → רואה כפתור "סיכום ספרינט" → מוריד קובץ בפועל
      (`page.waitForEvent('download')`, מאמת את שם הקובץ) ← חבר-צוות רגיל (לא יוצר, נוסף
      ע"י `POST /teams/:id/members` ומאשר הזמנה) נכנס לאותו ספרינט ורואה שהכפתור **לא**
      קיים בכלל. **עודכן (2026-09-01):** נוספו 2 תגובות עם קטגוריות (`PLANNING`, `TESTING`)
      לצד תגובה ללא קטגוריה — מאמת שסעיף "לפי קטגוריה" מציג את כולן עם הספירה הנכונה. נוסף
      גם אימות RTL אוטומטי: `boundingBox()` על שורת קטגוריה (label מימין ל-count, לא נשברת
      אף פעם) ועל שורת הסטטיסטיקות (סה"כ/שימור/שיפור, רק כשלא נשברת ל-flexWrap במובייל —
      נתפס ותוקן: הבדיקה הראשונית נכשלה ב-Mobile Chrome כי השורה ההיא כן עוטפת בטלפון,
      וזו התנהגות תקינה, לא באג — הבדיקה עודכנה להתעלם מסדר-X כששורה עטפה).
- [x] Jest (2026-09-02): `frontend/src/features/sprint-summary/__tests__/stats.test.ts`
      (`computeSprintSummaryStats` — קיבוץ לפי קטגוריה, מיון, ערך לא-מוכר). בצד ה-backend:
      `sprint-summary.builder.spec.ts` (resolve/filename + **הרצה אמיתית** של
      `buildSprintSummaryPptx` לכל 3 התבניות — מספר שקפים, transition, פונט, תו-תבליט, כל
      אחד נבדק דרך פירוק ה-zip בפועל, לא mock) ו-`pptx-post-process.util.spec.ts` (הזרקת
      ה-transition למקום הנכון, על כל שקף, בלי לפגוע בקבצים אחרים בארכיון). **תקלת סביבה
      שנתפסה ותוקנה**: הרצת `buildSprintSummaryPptx` בפועל תחת Jest נכשלה
      (`TypeError: A dynamic import callback was invoked without --experimental-vm-modules`)
      — `pptxgenjs` עושה `import('node:fs')`/`import('node:https')` דינמי פנימי (ללא קשר
      לתמונות בכלל, קורה תמיד ב-Node) ש-Jest לא תומך בו כברירת מחדל. תוקן בקביעות ב-
      `backend/package.json`: `test`/`test:watch`/`test:cov` מריצים
      `NODE_OPTIONS=--experimental-vm-modules jest`.
- [x] Jest ל-`comments.service.spec.ts` (חדש) — `create`/`getCommentsForSprint`/
      `setHighlighted` (כולל ה-guard `isAdmin||TEAM_LEADER`), ול-`team-permissions.util.spec.ts`
      (חדש) — הפונקציה המשותפת שגם `setHighlighted` וגם עתידית פיצ'ר 3 ישתמשו בה. הרחבת
      `sprints.service.spec.ts` הקיים עם `exportSummaryPptx` (יוצר/מנהל/חבר-רגיל,
      resolveTemplateId נופל ל-classic, `buildSprintSummaryPptx` ממוקק שם כדי לבודד את בדיקת
      ה-guard מבדיקת יצירת הקובץ עצמה).
- [x] בדיקת מובייל — `Mobile Chrome` project ב-Playwright (Pixel 7, רוחב ~412px אמיתי, לא
      מוגבל למגבלת שינוי-גודל-חלון שתועדה קודם ב-Chrome ידני) עבר במלואו על כל המסך החדש.

### לא בטיפול (פיצ'ר 1)

- תיעוד דפוס "הורדת קובץ ב-native" (`File.downloadFileAsync`+`expo-sharing`) ב-
  `UI-GUIDELINES.md` — זה התקדים הראשון בקוד להורדת קובץ ב-native; שווה לתעד כדפוס קבוע
  לפני שהפיצ'ר הבא (למשל בחירת תבנית, או פיצ'ר עתידי אחר) צריך את אותו הדבר וממציא מחדש.

- אין תמיכה בעריכת/מחיקת תוכן מהמצגת אחרי ההפקה — זו הפקה חד-כיוונית מהנתונים הקיימים.
- אין שמירת "היסטוריית מצגות שהופקו" — כל הורדה מייצרת קובץ טרי מהנתונים העדכניים.
- שיתוף המצגת ישירות (מייל/קישור) — כרגע רק הורדה מקומית; להוסיף כפרק נפרד אם יידרש בעתיד.

---

## פיצ'ר 2: הדגשת הערות

מטרת הפיצ'ר: לאפשר למנהלי צוות ולראשי צוותים לסמן תגובות רטרו ספציפיות כ"מודגשות", כדי
שיבלטו ויזואלית ללוח לכל חברי הצוות — למשל תגובות חשובות במיוחד שכדאי שלא יאבדו בין שאר
התגובות.

### 2.0 החלטות שנקבעו

- **הרשאה:** רק מי ש-`TeamMember.isAdmin === true` **או** `TeamMember.role === 'TEAM_LEADER'`
  (בעברית: "מנהלי צוות וראשי צוותים") יכול להדגיש/לבטל הדגשה של תגובה. זו החלטה מפורשת של
  נוה. **הערה חשובה לתיעוד בקוד:** כפי שהוסבר בפיצ'ר 1 סעיף 1.0 — `role` הוא לדברי
  `teams.service.ts` "free-text job title" שכל admin יכול לשנות בחופשיות, כך ש-`TEAM_LEADER`
  יכול תיאורטית "לדלוף" למישהו שאינו ראש הצוות המקורי (או להיעלם ממי שהוא כן). זה סיכון
  מקובל שהמשתמש מודע לו ובחר בו במפורש עבור הפיצ'ר הזה — לא באג לתקן.
- **שילוב עתידי עם פיצ'ר 1 (ייצוא למצגת):** תגובות מודגשות יקבלו שקף/סעיף ייעודי משלהן
  במצגת שמופקת בפיצ'ר 1 (ראו פריט תלוי ב-1.1 למעלה) — לממש את פיצ'ר 2 **קודם** לפיצ'ר 1
  אם רוצים את השילוב הזה בפועל, או לפחות לפני שקף התגובות המודגשות הספציפי שם.

### ממצאי מחקר

- **אין שום מנגנון mutation קיים על Comment היום.** `backend/src/comments/` חושף רק
  `POST /sprints/:sprintId/comments` ו-`GET /sprints/:sprintId/comments` — אין PATCH/DELETE/
  edit/react/pin בכלל. הדגשה תהיה ה-mutation הראשונה על תגובה קיימת.
- **מודל `Comment`** (`backend/prisma/schema.prisma:127-141`): `id, content, type, category?,
  isAnonymous, createdAt, authorId, teamId, sprintId` — אין שדה הדגשה/pin/star קיים, ואין
  טבלת junction. יידרש שדה חדש.
- **`CommentCardWeb`** (`frontend/src/features/retro/components/comment-card-web.tsx`) הוא
  קומפוננטה תצוגתית טהורה — `{comment, index}` בלבד, בלי שום prop הרשאה ובלי שום כפתור
  פעולה קיים (לא עריכה, לא מחיקה, שום דבר). המקבילה ב-native היא `renderCommentCard` מוטמע
  בתוך `sprint-retro-board-native.tsx` (שורות ~138-183), באותו מצב — בלי כפתורי פעולה.
- **`isAdmin` לא מגיע ל-`SprintRetroBoard` היום** (`props: {sprint, team, token, user,
  onBack}` בלבד, `frontend/src/features/retro/index.tsx`) — אבל הנתון הגולמי כן קיים על
  אובייקט `team` שכבר מגיע לשם: או `team.roleInTeam` (משורת `teams.service.ts:311-316`), או
  `team.members.find(m => m.user.id === user.id)` (מערך `members` מלא, כולל `role`+
  `isAdmin`), **בדיוק אותו דפוס שכבר בשימוש** ב-`team-list-web/team-card.tsx:29`
  (`myMembership?.isAdmin`). כלומר אין צורך בשינוי API כדי לדעת בצד הלקוח האם המשתמש
  הנוכחי יכול להדגיש — רק בהוספת prop חדש שמעביר את זה הלאה עד לכרטיס התגובה.
- **`comment-filter-bar-web.tsx`/`-native.tsx`** כיום: `{categories: string[],
  onCategoriesChange, searchText, onSearchTextChange}` — צורת state שטוחה. הוספת
  `highlightedOnly: boolean` + `onHighlightedOnlyChange` מתאימה בקלות לאותו דפוס, בלי
  שינוי מבני.

### 2.1 Backend — done

- [x] שדה חדש `Comment.isHighlighted Boolean @default(false)` ב-`schema.prisma`. **אין
      migrations בפרויקט הזה** (workflow הוא `prisma db push`, לא `prisma migrate`) —
      הורץ `npx prisma db push` הן מול ה-DB האמיתי (Neon `neondb` — זה גם ה-DB של הפיתוח
      המקומי, אין DB נפרד לדב) והן מול `postgres-test` (`.env.test`). שדה תוסף גרידא עם
      `@default(false)` — בלי סיכון סמנטי (בניגוד למקרה שתועד ב-
      [[feedback-prisma-schema-defaults]] — שם ברירת המחדל טענה עובדה עסקית שגויה על שורות
      קיימות; כאן "לא הודגש" הוא באמת נכון לכל תגובה ישנה).
- [x] `guard` משותף נוצר בפועל (לא רק המלצה): `backend/src/teams/team-permissions.util.ts`
      → `assertCanManageTeamContent(prisma, teamId, requesterId)` — `isAdmin===true ||
      role==='TEAM_LEADER'`. ישמש גם את פיצ'ר 3.
- [x] `PATCH /comments/:commentId/highlight` (לא `/sprints/:sprintId/comments/:commentId` —
      פשוט יותר, ה-`commentId` כבר מספיק כדי לשלוף את ה-`teamId` שלו).
      `backend/src/comments/comments.controller.ts` + `comments.service.ts::setHighlighted`.
- [x] `getCommentsForSprint` כבר מחזיר `isHighlighted` בלי שינוי (אין `select` מצומצם על
      Comment, כל השדות הסקלריים חוזרים ממילא).

### 2.2 Frontend — done (web+native)

- [x] `canHighlight` מחושב ב-`SprintRetroBoardWeb`/`Native` (`team.members?.find(m =>
      m.userId === user.id)`, בדיוק אותו דפוס כמו `team-card.tsx`), מועבר ל-`CommentCardWeb`
      / ל-`renderCommentCard` הפנימי ב-native.
- [x] כפתור/אייקון "כוכב" (`Icon name="star"`, כבר קיים ברשימת האייקונים) — לחיץ ופעיל רק
      כש-`canHighlight` (עם `PATCH` + עדכון אופטימי + rollback בשגיאה); כשה-תגובה
      `isHighlighted` וללא `canHighlight` — כוכב סטטי (לא כפתור) כדי שכולם יראו שהיא מודגשת.
      עיצוב הכרטיס המודגש: `backgroundColor: t.color.accent.subtle` +
      `border: 1px solid t.color.accent.border` — מטוקנים בלבד, בלי hex ידני.
- [x] אותו מימוש ב-`renderCommentCard` הפנימי של `sprint-retro-board-native.tsx`.
- [x] `highlightedOnly` toggle נוסף ל-`comment-filter-bar-web.tsx`/`-native.tsx` ("מודגשות
      בלבד").
- [x] מחרוזות: `Strings.retroBoard.highlightButton`/`unhighlightButton`/
      `highlightedOnlyFilterLabel`.

### 2.3 בדיקות — done

- [x] Playwright e2e — `frontend/e2e/comment-highlighting.spec.ts` (Desktop+Mobile Chrome,
      שניהם עוברים): ראש-צוות מדגיש/מבטל הדגשה ומסנן "מודגשות בלבד" בהצלחה; חבר-צוות רגיל
      (DEVELOPER, לא admin ולא TEAM_LEADER) נכנס לאותו ספרינט ורואה שאין בכלל כפתור הדגשה
      (לא רק מוסתר-אבל-קיים — `getByRole('button', ...)` מחזיר 0 תוצאות). **עודכן
      (2026-09-01):** התגובה המודגשת מקבלת קטגוריה (`TESTING`) — מוודא שה-badge והכפתור
      מתקיימים יחד באותה שורה בלי להתנגש. נוסף אימות RTL: `boundingBox()` מוודא שה-badge
      (ראשון ב-JSX) נמצא ממש מימין לכפתור ההדגשה (שני ב-JSX) — לא רק "נראה טוב" בצילום מסך.
- [x] Jest (2026-09-02): `backend/src/comments/comments.service.spec.ts` (חדש) — `setHighlighted`
      עם guard `isAdmin===true || role==='TEAM_LEADER'` (כולל: אין הרשאה כלל, admin מותר,
      team-leader-לא-admin מותר, ביטול הדגשה). לא נכתב Jest לרכיבי ה-UI עצמם (כרטיס
      התגובה/סרגל הפילטרים) — הכיסוי שם נשאר דרך e2e+`tsc`.
- [x] אומת ידנית בדפדפן אמיתי (לא רק Playwright): לחיצה על הכוכב שולחת `PATCH
      /comments/:id/highlight` (200, נבדק ב-Network tab), הכרטיס מקבל את הרקע/מסגרת
      המודגשים, הכוכב עובר לצבע accent, והפילטר "מודגשות בלבד" בפועל מסנן נכון.

---

## פיצ'ר 3: קטגוריות מותאמות לצוות

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

## פיצ'ר 4: עריכת ספרינט לאחר יצירה — הושלם ✅

מטרת הפיצ'ר: לפני כן, אחרי יצירת ספרינט אי-אפשר היה לערוך שום שדה שלו (שם, תיאור,
תאריכים) — טעות בזמנים בזמן היצירה נשארה קבועה. נוה ביקש שנוסיף עריכה, בפירוש **בלי**
מחיקה בסבב הזה (מחיקה נחשבת פעולה שונה ומסוכנת — מה קורה לתגובות/סיכום קיימים — ותידון
בנפרד).

**הרשאה:** אותו guard בדיוק כמו יצירת ספרינט — `TeamMember.isAdmin` בלבד (לא `creatorId`,
לא `TEAM_LEADER`) — כדי שלא ייווצר מצב שמישהו יכול לערוך ספרינט שהוא לא יכול היה ליצור.

**מומש:**
- Backend: `PATCH /teams/:teamId/sprints/:sprintId` (`UpdateSprintDto` — כל השדות
  אופציונליים, עדכון חלקי), guard זהה ל-`create`, 404 אם הספרינט לא שייך לצוות.
- Frontend (web+native): אשכול כפתורי כותרת הלוח עוצב מחדש — "ערוך ספרינט" ו"סיכום
  ספרינט" מקובצים יחד (`isAdmin`-בלבד לעריכה), מופרדים ויזואלית מכפתור "חזרה". טופס עריכה
  מוטבע (לא modal) עם כל השדות; שמירה מעדכנת state מקומי מיד, בלי refetch/ניווט מחדש.
- בדיקות: Jest ל-`sprints.service.ts::update` (guard, 404, עדכון חלקי, המרת תאריכים),
  Playwright e2e (`e2e/sprint-editing.spec.ts`, Desktop+Mobile) — admin עורך ורואה עדכון
  מיידי; חבר לא-admin לא רואה את כפתור העריכה בכלל.

### לא בטיפול (פיצ'ר 4) — לעתיד

- **מחיקת ספרינט** — נדחתה במפורש ע"י נוה לסבב נפרד (דורשת מחשבה על מה קורה לתגובות/סיכום
  קיימים של ספרינט שנמחק).
- **מעקב היסטוריית עריכות (audit log)** — נוה ציין את זה כאופציה עתידית: מי ערך אילו שדות
  ומתי, על כל שינוי בהגדרות ספרינט. לא ממומש כעת; כשיתחילו לבנות, מודל דומה ל-`TeamInvite`
  (טבלה נפרדת עם `sprintId`, `editedById`, `changedFields` JSON, `createdAt`) הוא הכיוון
  הטבעי, בהשראת אותה תבנית שכבר שימשה לפיצ'רים 2-3 בבאקלוג הזה.
- שיתוף/העתקת רשימת קטגוריות בין צוותים — כל צוות עצמאי לחלוטין.

---

## פיצ'ר 5: תיעוד היסטוריית שינויי אורך ספרינט (Audit Log)

מטרת הפיצ'ר: כל שינוי בתאריכי ההתחלה/סיום של ספרינט קיים (מהם נגזר "אורך" הספרינט) יתועד
אוטומטית — מתי בוצע השינוי, מה היה האורך הישן, מה האורך החדש, ומי ביצע אותו — ותהיה בממשק
נקודת צפייה בהיסטוריה הזו. זהו בדיוק הפריט שנוה כבר סימן כעתידי ב"לא בטיפול" של פיצ'ר 4
(ר' שם), עכשיו ממוקד ספציפית לשינויי אורך/תאריכים.

**ממצא מחקר קריטי לפני כל החלטה אחרת:** "אורך ספרינט" **אינו שדה קיים בשום מקום בקוד**.
`Sprint` (`backend/prisma/schema.prisma:114-125`) מכיל רק `name, description, startDate,
endDate` — אין `Team.sprintLengthDays` ואין `Sprint.length`/`Sprint.durationDays`. "אורך"
הוא ולהיה תמיד ערך **נגזר** (`endDate - startDate`), בדיוק כמו ש"ספרינט סגור" נגזר בצד
הלקוח ולא נשמר כשדה (`getSprintState()`, מתועד כבר בממצאי מחקר פיצ'ר 1). היכולת הקיימת
"לשנות אורך ספרינט" שהוזכרה בבקשה = עריכת `startDate`/`endDate` של ספרינט קיים, שנוספה
בפיצ'ר 4 (`PATCH /teams/:teamId/sprints/:sprintId`, `UpdateSprintDto`,
`sprints.service.ts::update`) — **אין שדה נפרד "אורך" שנערך ישירות**. כל הסעיף הזה ממשיך
לפעול על ההנחה הזו: "שינוי אורך" = שינוי בפועל של `startDate` ו/או `endDate` של ספרינט קיים
דרך אותו PATCH.

### 5.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **מקור האמת לאורך — נגזר, לא מאוחסן.** רשומת ההיסטוריה תשמור את התאריכים הישנים
   והחדשים בפועל (`previousStartDate/previousEndDate/newStartDate/newEndDate`), לא מספר
   ימים מחושב ומאוחסן בנפרד — עקבי עם הדפוס הקיים בקוד (אורך/מצב ספרינט תמיד נגזרים, לא
   persisted). מספר הימים (`length = endDate - startDate`) מחושב בזמן תצוגה, גם ב-API
   response (שדה נוסף מחושב, לא עמודת DB) וגם ב-UI, כדי לא ליצור מקור-אמת כפול שעלול
   להתבדות מהתאריכים עצמם.
2. **תבנית הטבלה — להעתיק את `TeamInvite`, לא להמציא מבנה חדש** (כפי שגם `backend/AGENTS.md`
   §"Per-team-owned entities" מנחה במפורש): טבלה נפרדת `SprintLengthChange` עם `sprintId`
   FK (cascade), `changedById` FK ל-`User` (cascade — **עקבי** עם `TeamInvite.createdBy` ו-
   `Comment.author`, שתיהן כבר cascade על מחיקת המשתמש; לא סטייה חדשה), `createdAt
   @default(now())`. רשומות **append-only** — אין endpoint לעדכון/מחיקה של רשומת היסטוריה
   אף פעם (אחרת זה לא audit log אמיתי).
3. **מי כותב ללוג (permission על ה-write path) — לא שאלה פתוחה.** הכתיבה קורית כתופעת-לוואי
   אוטומטית בתוך `sprints.service.ts::update` הקיים, שכבר בדוק ב-guard
   `requesterMembership.isAdmin` (זהה ל-create, ר' פיצ'ר 4) — **אין החלטת הרשאה חדשה כאן**,
   רק תיעוד של מי שכבר הורשה לערוך.
4. **טווח: רק שינוי בתאריכים נכנס ללוג הזה**, לא כל PATCH. אם ה-PATCH משנה רק `name`/
   `description` בלי לגעת ב-`startDate`/`endDate` בפועל (השוואת ערך-ישן מול ערך-חדש, לא רק
   "השדה נשלח בבקשה") — לא נוצרת רשומת היסטוריה. זה תואם את שם הפיצ'ר ("שינויי אורך
   ספרינט"), לא "כל עריכת ספרינט" (זה scope רחב יותר, שכבר תועד כאופציה נפרדת ב"לא בטיפול"
   של פיצ'ר 4 — "מי ערך אילו שדות").
5. **אין מחיקה/retention אוטומטי כרגע** — לתמיד, עד שיוחלט אחרת. אין שום מנגנון ניקוי/TTL
   דומה בפרויקט הזה היום שאפשר להעתיק ממנו.

**החלטות מוצריות (נוה, 2026-09-06):**

1. **מיקום ב-UI: פאנל מתקפל בלוח הרטרו**, על דפוס `InviteLinksPanel`
   (`frontend/src/features/teams/components/team-list-web/invite-links-panel.tsx` —
   `isExpanded` + `useEffect` ששולף רק בפתיחה, לא ב-mount; מקבילת native קיימת גם היא).
   ה-endpoint הוא **per-sprint** (לא ברמת-צוות) — `GET
   /teams/:teamId/sprints/:sprintId/length-history`.
2. **הרשאת צפייה: admin או ראש-צוות (TEAM_LEADER)**, לא כל חבר צוות. יש כבר תבנית מדויקת
   לזה בקוד — `assertCanManageTeamContent` (`backend/src/teams/team-permissions.util.ts`),
   שכבר משמשת שני פיצ'רים אחרים ("מנהלי צוות וראשי צוותים") ומיישמת בדיוק
   `isAdmin || role === 'TEAM_LEADER'`. **להשתמש בפונקציה הקיימת, לא לכתוב guard חדש.**
   (שים לב: זו הרשאת *צפייה* — הרשאת *כתיבה*/עריכה נשארת admin-בלבד, ר' ברירת מחדל 3 למעלה,
   שונה במכוון מהצפייה.)
3. **Scope: רק שינויי תאריך** (לא כל עריכת ספרינט) — מאשר את ברירת המחדל הטכנית 5.0.4.
   מבנה הטבלה נשאר עם עמודות תאריך ספציפיות, לא `changedFields JSON` גנרי.
4. **Baseline: כן** — יצירת ספרינט (`sprints.service.ts::create`) יוצרת גם היא רשומת
   `SprintLengthChange` ראשונה, כך שההיסטוריה תמיד מתחילה מ"שורה ראשונה" עם התאריכים
   המקוריים ומי יצר, לא ריקה עד לשינוי הראשון.
5. **שדה "סיבה לשינוי" (reason): כן, אופציונלי.** טקסט חופשי בטופס העריכה, נשמר על
   `SprintLengthChange.reason` ומוצג בהיסטוריה. לא רלוונטי/ריק ברשומת ה-baseline (אין
   "שינוי" ביצירה עצמה).
6. **טווח שמירה: לתמיד** — מאשר את ברירת המחדל הטכנית 5.0.5, אין צורך במדיניות מחיקה.

### ממצאי מחקר

- **אין "אורך ספרינט" כשדה עצמאי בשום מקום** — ר' "ממצא מחקר קריטי" למעלה. גרפ מקיף
  (`sprintLength`, `SprintLength`, `duration`, `days`) לא העלה שום זכר לקונספט הזה לא
  ב-backend ולא ב-frontend, לא ב-`schema.prisma`, לא ב-`sprints.dto.ts`.
- **נקודת הכתיבה היחידה שרלוונטית: `sprints.service.ts::update`**
  (`backend/src/sprints/sprints.service.ts:47-79`) — כבר קיימת ומיושמת (פיצ'ר 4), כולל
  ה-guard (`requesterMembership.isAdmin`, שורות 56-61) וטעינת הספרינט הקיים לפני העדכון
  (שורות 63-67, `const sprint = await this.prisma.sprint.findFirst(...)`) — **הערכים
  הישנים כבר נטענים בקוד לפני שהם נדרסים**, כך שהשוואת ישן/חדש לצורך יצירת רשומת היסטוריה
  היא תוספת ישירה בתוך הפונקציה הזו, לא צריך שאילתה נוספת.
- **`UpdateSprintDto`** (`backend/src/sprints/dto/sprints.dto.ts:8-13`): `name?, description?,
  startDate?, endDate?` — כל השדות אופציונליים (עדכון חלקי). ה-DTO לא מבחין בין "לא נשלח"
  ל"נשלח אבל זהה לישן" — ההשוואה לצורך הלוג חייבת להיות מול הערך **בפועל** (`sprint.startDate`
  הישן מול `dto.startDate` החדש), לא מול "האם השדה קיים ב-body".
- **התבנית להעתקה — `TeamInvite`** (`schema.prisma:60-76` + `backend/src/invites/
  invites.service.ts`): טבלה נפרדת עם `teamId`/FK-מקביל cascade, `createdById` FK ל-User,
  ובלי mutation על רשומות קיימות (רק `isRevoked` toggle, לא מחיקה/עריכה של תוכן ההזמנה עצמה)
  — בדיוק אותו רוח append-only שדרוש כאן. גם `backend/AGENTS.md` §"Per-team-owned entities"
  מפנה במפורש ל-`invites` כתבנית לכל משאב פר-צוות חדש.
- **דפוס UI לפאנל-נפרד-שנשלף-בפתיחה — `InviteLinksPanel`**
  (`frontend/src/features/teams/components/team-list-web/invite-links-panel.tsx:27-55`):
  `isExpanded` state + `useEffect(() => { if (isExpanded) fetchInvites(); }, [isExpanded])`
  — נתונים נשלפים רק כשהפאנל נפתח, לא ב-mount. אם ההחלטה בשאלה פתוחה #1 היא "פאנל נפרד",
  זה הדפוס להעתיק ישירות (יש גם מקבילת native: `frontend/src/features/teams/components/
  team-list-native/invite-links-panel.tsx`).
- **טופס העריכה הקיים (רלוונטי לשאלה פתוחה #1, אופציה "מוטבע")**:
  `sprint-retro-board-web.tsx` — `isEditingSprint` state (שורה 32), `canEditSprint =
  !!myMembership?.isAdmin` (שורה 151), טופס מוטבע (לא modal) עם `Field type="date"` לכל
  אחד מ-`editStartDate`/`editEndDate` (שורות 236-237), שולח PATCH (שורה 172). מקבילת
  native קיימת (`sprint-retro-board-native.tsx`) באותה רוח.
- **הרשאת עריכה (write path) כבר קיימת ומיושמת** — `canEditSprint`/guard ה-backend זהים,
  `isAdmin` בלבד (לא `creatorId`, לא `TEAM_LEADER` — שונה במפורש מפיצ'רים 1-3, ר' הסבר
  בפיצ'ר 4 למעלה: "כדי שלא ייווצר מצב שמישהו יכול לערוך ספרינט שהוא לא יכול היה ליצור").
  אין החלטה חדשה נדרשת כאן לכתיבה — ר' ברירת מחדל 5.0.3.
- **track events (PostHog) הם נפרדים לחלוטין מהצורך הזה, לא תחליף.**
  `frontend/src/lib/analytics.ts::trackEvent` שולח ל-PostHog (שירות אנליטיקס חיצוני) —
  fire-and-forget, בלי טבלה בבסיס הנתונים של האפליקציה, בלי אפשרות query-back מובנית
  בממשק שלנו, ובלי קשר בין "מי" ל"איזה שינוי בדיוק בוצע" ברמת דיוק שדורש audit log אמיתי.
  כשמוסיפים UI חדש לפיצ'ר הזה (למשל כפתור/טאב "היסטוריה") — עדיין נדרש `trackEvent()` על
  הפתיחה שלו, לפי הכלל הקבוע בפרויקט, אבל זה **בנוסף** ל-`SprintLengthChange` ולא במקומו.

### 5.1 Backend

- [ ] מודל Prisma חדש `SprintLengthChange`: `id, sprintId (FK ל-Sprint, cascade),
      changedById (FK ל-User, cascade — עקבי עם TeamInvite.createdBy/Comment.author),
      previousStartDate DateTime?, previousEndDate DateTime?, newStartDate DateTime, newEndDate
      DateTime, reason String?, createdAt DateTime @default(now())`. `previous*` הן nullable
      כדי לתמוך ברשומת ה-baseline (יצירת ספרינט — אין "קודם"); ברשומות עדכון רגילות שתיהן
      תמיד ממולאות.
- [ ] `npx prisma db push` מול `postgres-test` (בטוח לביצוע ישיר) — **לא** מול Neon
      dev/prod בלי אישור מפורש של נוה קודם (ר' `backend/AGENTS.md` §Database).
- [ ] `sprints.service.ts::update`: לפני העדכון בפועל, להשוות
      `sprint.startDate`/`sprint.endDate` (הערכים הישנים, כבר נטענים בקוד הקיים שורה 64) מול
      `dto.startDate`/`dto.endDate` שסופקו בפועל — אם יש שינוי אמיתי באחד מהם, ליצור רשומת
      `SprintLengthChange` (`previousStartDate/previousEndDate` = הערכים הישנים,
      `newStartDate/newEndDate` = הערכים אחרי העדכון, `reason` = `dto.reason` אם סופק) בתוך
      `prisma.$transaction` יחד עם ה-`update` עצמו, כדי שלא תיווצר רשומת היסטוריה בלי שהעדכון
      עצמו הצליח או להפך.
- [ ] `sprints.service.ts::create`: לאחר יצירת הספרינט, ליצור גם רשומת `SprintLengthChange`
      ראשונה (baseline) — `previousStartDate/previousEndDate = null`,
      `newStartDate/newEndDate` = ערכי היצירה, `changedById = requesterId`, `reason = null`.
      גם זה בתוך אותה `$transaction` שיוצרת את הספרינט.
- [ ] הוספת `reason String?` ל-`UpdateSprintDto` (`backend/src/sprints/dto/sprints.dto.ts`).
- [ ] `GET /teams/:teamId/sprints/:sprintId/length-history` — endpoint חדש ב-
      `sprints.controller.ts`/`sprints.service.ts`. Guard: **`assertCanManageTeamContent`**
      (`backend/src/teams/team-permissions.util.ts`, ייבוא ישיר — לא guard חדש) — admin או
      TEAM_LEADER בלבד. מחזיר רשימה ממוינת `createdAt desc`, כולל שם/שם-משתמש של `changedBy`
      (לא רק `changedById`, `include: { changedBy: true }`) — **לא** לשמור/להחזיר מספר ימים
      כעמודת DB, האורך מחושב בזמן תצוגה בצד הלקוח (ר' ברירת מחדל 5.0.1).

### 5.2 Frontend

- [ ] פאנל מתקפל בלוח הרטרו, בהעתקה ישירה של מבנה `invite-links-panel.tsx`
      (`isExpanded` state + `useEffect(() => { if (isExpanded) fetch...() }, [isExpanded])` —
      נשלף רק בפתיחה, לא ב-mount) — גם web (`frontend/src/features/teams/components/
      team-list-web/`) וגם native (`team-list-native/`), ליד/בתוך לוח הרטרו הקיים.
- [ ] הצגת כל רשומה: תאריך/שעת השינוי (`createdAt`), שם מבצע השינוי (`changedBy`), אורך ישן
      → אורך חדש בימים (מחושב בצד הלקוח מהתאריכים שחוזרים מה-API — `previousStartDate` null
      ברשומת ה-baseline מוצג כ"נוצר לראשונה" ולא כ"שינוי מ-X ל-Y"), תאריכי ההתחלה/סיום
      הישנים והחדשים בפועל, וה-`reason` אם קיים.
- [ ] הפאנל מוצג רק למי שעומד ב-`assertCanManageTeamContent` (admin/TEAM_LEADER) — עקבי עם
      ה-guard בצד השרת; חבר צוות רגיל לא רואה את כפתור/פאנל ההיסטוריה בכלל.
- [ ] `Field` טקסט חופשי אופציונלי "סיבה לשינוי" בטופס עריכת הספרינט הקיים
      (`sprint-retro-board-web.tsx`/`-native.tsx`, ליד `editStartDate`/`editEndDate`), נשלח
      כ-`reason` ב-PATCH.
- [ ] כפתור פתיחת הפאנל מקבל `trackEvent()` חדש, לפי הכלל הקבוע בפרויקט (ר' ממצאי מחקר —
      track events נפרד מה-audit log עצמו, לא תחליף).
- [ ] `Strings.retroBoard.*` — מחרוזות עבריות חדשות: כותרת הפאנל, "נוצר לראשונה", תוויות
      "אורך קודם"/"אורך חדש", תווית שדה "סיבה לשינוי (אופציונלי)".

### 5.3 בדיקות

- [ ] Jest ב-`sprints.service.spec.ts` (מורחב): `create` יוצר גם רשומת `SprintLengthChange`
      baseline אחת (`previousStartDate/previousEndDate = null`); PATCH ששינה תאריכים בפועל
      יוצר רשומה נוספת עם הערכים הישנים/חדשים הנכונים ו-`reason` אם סופק; PATCH ששינה רק
      `name`/`description` **לא** יוצר רשומה (ר' 5.0.4); PATCH עם תאריך זהה לישן (נשלח אבל
      לא השתנה בפועל) גם לא יוצר רשומה.
- [ ] Jest ל-endpoint הקריאה החדש: `assertCanManageTeamContent` חוסם חבר-צוות רגיל
      (403), מאפשר admin ו-TEAM_LEADER; מיון `createdAt desc`; כולל baseline + כל העדכונים.
- [ ] Playwright e2e: admin יוצר ספרינט ואז עורך את תאריכיו פעמיים ברצף (עם ובלי `reason`)
      → פותח את פאנל ההיסטוריה → רואה 3 רשומות (baseline + 2 עדכונים) בסדר כרונולוגי הפוך עם
      הערכים הנכונים; חבר-צוות רגיל (לא admin, לא TEAM_LEADER) נכנס לאותו ספרינט ו**לא** רואה
      את כפתור/פאנל ההיסטוריה בכלל.
- [ ] בדיקת מובייל — אותו e2e תחת `Mobile Chrome` project (עקבי עם כל שאר הפיצ'רים בבאקלוג
      הזה).

---

## פיצ'ר 6: שילוב עם יומן Google — שלב א' מוגדר, חסום עד ליצירת Google Cloud OAuth client

מטרת הפיצ'ר: לסמן ביומן Google את מועדי הספרינטים הקיימים במערכת, כדי שחברי צוות יראו אותם
בלוח השנה הרגיל שלהם בלי לבדוק את האפליקציה בנפרד. הפיצ'ר מחולק לשני שלבים מפורשים: **שלב
א'** — סנכרון טווח תאריכי הספרינט (`startDate`/`endDate`) עצמו ליומן; **שלב ב' (עתידי, לא
ב-MVP)** — הוספת אירוע נפרד לתאריך שבו מתוכנן להתקיים הרטרו, נפרד מטווח הספרינט.

**כל החלטות המוצר לשלב א' נקבעו (ראו 6.0 למטה). המכשול היחיד שנותר לפני שאפשר להתחיל
לממש הוא פעולה חיצונית: יצירת Google Cloud project + OAuth consent screen + client
ID/secret על ידי נוה, ושמירתם ב-infisical (ר' שאלה פתוחה #1 למטה). `backend-feature` לא
יכול להתחיל לפני שזה קיים — אין דרך לבדוק את זרימת ה-OAuth בלי client id/secret אמיתיים.**

### 6.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **ספריית אינטגרציה: `googleapis` (החבילה הרשמית של Google ל-Node.js), לא קריאות REST
   ידניות.** נבדק בגריפ מקיף (`google`, `oauth`, `calendar`, case-insensitive) בכל הריפו —
   ההתאמות היחידות הן אזכור לא-קשור של Google Fonts ב-`frontend/AGENTS.md`/
   `global-web-styles.ts`/`global.css`. אין שום תלות קיימת ב-`backend/package.json` או
   ב-`frontend/package.json` בשם שמכיל "google" — זו תלות חדשה לגמרי, באותה רוח שבה
   `pptxgenjs` נוספה עבור פיצ'ר 1 (ראו שם 1.0.3).
2. **אירוע יומן מסוג "כל היום" (all-day), לא אירוע עם שעה.** נבדק בקוד: שדות התאריך של
   ספרינט הם date-only הלכה למעשה — טופס העריכה (`sprint-retro-board-web.tsx` שורות 236-237)
   משתמש ב-`Field type="date"` ושומר state כ-`toISOString().slice(0,10)` (שורות 156-157),
   בלי שום קלט שעה. `Sprint.startDate/endDate` ב-`schema.prisma` הם אמנם `DateTime`, אבל
   בפועל תמיד חצות. אין הגיון להמציא שעה שלא קיימת במקור.
3. **כשלון סנכרון ליומן לא חוסם יצירה/עריכה של ספרינט.** יש כבר תקדים מדויק לזה בקוד:
   `EmailService` (`backend/src/email/email.service.ts`, שורות 37-49) עוטף כל קריאה חיצונית
   ב-try/catch, מתעד אזהרה ב-logger, ולא זורק החוצה — יצירת/עדכון צוות ממשיכים גם אם השליחה
   נכשלה. אותו דפוס בדיוק עבור קריאות ל-Google Calendar API מתוך `sprints.service.ts::create`/
   `update`.
4. **סודות OAuth (client id/secret) דרך משתני סביבה + infisical, לא hardcoded.** תקדים מדויק:
   `EmailService` קורא `process.env.RESEND_API_KEY`/`EMAIL_FROM`, מזהיר בלוג ולא שולח בפועל
   אם חסר (שורות 8-15) — **בלי** fallback קבוע בקוד (בניגוד ל-`JWT_SECRET` שכן נופל ל-secret
   קשיח, מתועד כ"Bug candidate" ב-`specs/00-shared-conventions.md` §3 — **לא** לחזור על
   האנטי-פטרן הזה עבור `GOOGLE_CLIENT_SECRET`). `npm run dev` כבר עובר דרך `infisical run`
   (`package.json` שורש) — משתנים חדשים (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`) מתווספים לאותה סביבת infisical, לא לקובץ `.env` מקומי.
5. **בדיקות אוטומטיות לא קוראות ל-Google API האמיתי.** `googleapis` client ממוקק ב-Jest (כמו
   ש-`pptxgenjs`/`resend` client כבר לא נקראים באמת בטסטים רלוונטיים) — אין דרך סבירה
   להריץ OAuth אמיתי מול חשבון Google בסביבת e2e מבודדת.

**החלטות מוצריות לשלב א' (נוה, 2026-09-06):**

1. **Google Cloud project / OAuth client — טרם נוצר.** זו פעולה חיצונית לקוד (קונסולת
   Google Cloud) שנוה יבצע בהמשך ויספק client id/secret דרך infisical (ר' ברירת מחדל טכנית
   #4). **זהו החוסם היחיד לתחילת מימוש שלב א'** — שאר ההחלטות המוצריות הוכרעו.
2. **חיבור אישי לכל משתמש**, לא יומן משותף לצוות. כל חבר צוות מחבר את חשבון ה-Google
   **שלו**, והאירוע נוצר בלוח השנה האישי שלו — אם כמה חברי צוות מחוברים, אותו ספרינט יוצר
   אירוע אחד לכל חיבור פעיל. ה-FK בטבלת החיבורים החדשה הוא `userId` (לא `teamId`).
3. **מי מורשה לחבר/לנתק: כל חבר צוות**, לא רק admin/TEAM_LEADER — עקבי עם היות זה חיבור אישי
   (כל אחד מחבר/מנתק רק את שלו). **אין guard מיוחד** מעבר לחברות בצוות עצמה —
   `assertCanManageTeamContent` **לא** רלוונטי כאן (בניגוד לפיצ'רים 2/3/5).
4. **עדכון תאריכי ספרינט קיים מעדכן את האירוע הקיים ביומן** (`events.patch`), לא מחיקה
   ויצירה מחדש. עקבי עם פיצ'ר 5 (`SprintLengthChange`) — אותה נקודת-כניסה ב-
   `sprints.service.ts::update` שכבר משווה ערך-ישן-מול-חדש ויוצרת רשומת היסטוריה, מפעילה גם
   את עדכון היומן (לכל חיבור Google פעיל של כל חבר צוות).
5. **UI לחיבור/ניתוק: כרטיס חדש בהגדרות** (`frontend/src/features/settings/`, ליד
   `ProfileFormCard`/`AppearanceCard`) — נובע ישירות מהחלטה #2 (חיבור אישי, לא פאנל בתוך
   `team-card.tsx`).
6. **מחיקת ספרינט — לא רלוונטי כרגע.** מחיקת ספרינט לא קיימת במערכת בכלל (נדחה במפורש
   בפיצ'ר 4). ברירת מחדל טכנית: כשתתווסף מחיקת ספרינט בעתיד, למחוק גם את האירוע ביומן
   (`events.delete`) — לא להשאיר יתום. אין צורך בהחלטת נוה נפרדת על זה עכשיו.

**שלב ב' (תאריך רטרו נפרד) — נשאר עתידי/לא ב-MVP** לפי בחירת נוה, ולא רק בגלל חוסר החלטה:
אין כרגע מודל "רטרו" עצמאי במערכת (ר' ממצאי מחקר) שאפשר לחבר אליו תאריך, כך שכל פירוט טכני
של שלב ב' יידחה עד שהצורך בישות כזו יעלה בפני עצמו (למשל דרך `product-manager` נפרד, לא
כהמשך אוטומטי של שלב א').

### ממצאי מחקר

- **אין שום אינטגרציית Google קיימת בקוד.** גריפ מקיף (`google|oauth|calendar`,
  case-insensitive) על כל הריפו העלה רק שלוש התאמות לא-קשורות (Google *Fonts*, לא Google
  *Calendar/OAuth*): `frontend/AGENTS.md` (טעינת גופן Rubik), `frontend/src/constants/
  global-web-styles.ts`, `frontend/src/global.css`. אין `googleapis`/`google-auth-library`
  בשום `package.json` (שורש/backend/frontend).
- **`User` (schema.prisma:10-24) אין לו שום שדה אחסון טוקן OAuth/refresh token.** רק
  `id, username, email, password, firstName?, lastName?, role, createdAt` + יחסים
  (`createdTeams, pendingApprovals, members, comments, createdInvites`). כל אחסון סוד חיצוני
  בקוד היום (JWT secret, Resend API key) הוא ברמת **process.env**, לא בטבלת DB — חיבור
  Google Calendar יהיה **הפעם הראשונה** שצריך לשמור סוד per-user/per-team ב-Postgres עצמו
  (access token + refresh token), לא רק ב-env גלובלי. אין תשתית הצפנה-במנוחה (encryption at
  rest) קיימת בקוד לעמודה כזו — שווה תשומת לב נוספת בזמן המימוש, גם אם לא נשאל כשאלה פתוחה
  במפורש.
- **`Sprint` (schema.prisma:114-125):** `id, name, description?, startDate, endDate, teamId,
  createdAt` — בדיוק כמו שתועד כבר בממצאי מחקר פיצ'ר 5. אין שום שדה קיים לקישור לאירוע יומן
  חיצוני (`googleEventId` וכו') — יידרש שדה/טבלה חדשה.
- **תאריכי ספרינט הם date-only בפועל, לא datetime עם שעה משמעותית** — ר' ברירת מחדל טכנית
  #2 למעלה, מבוסס על `sprint-retro-board-web.tsx` שורות 156-157, 236-237.
- **אין שום מודל "רטרו" עצמאי בנתונים.** גריפ אחר `retro|Retro` ב-`schema.prisma` לא העלה
  שום תוצאה — "רטרו" קיים רק כמסך/פיצ'ר frontend (`SprintRetroBoard`,
  `frontend/src/features/retro/`) שנפתח לתוך `Sprint` קיים ומציג תגובות (`Comment`) ששייכות
  אליו; אין `Retro.date`/`Retro.scheduledAt` או כל דבר דומה. זה בדיוק מה שהופך את שאלה פתוחה
  #7 לחוסמת: שלב ב' לא יכול "לסמן תאריך רטרו" בלי שקודם יוחלט אם/איך תאריך כזה בכלל נשמר.
- **תבנית מדויקת ל-"per-team-owned entity עם FK cascade + guard admin" — `TeamInvite`**
  (`schema.prisma:60-76` + `backend/src/invites/invites.service.ts`), **מונחית במפורש**
  ע"י `backend/AGENTS.md` §"Per-team-owned entities": "copy `invites`, not `teams`". טבלת
  חיבורי Google (בין אם per-user ובין אם per-team, תלוי בשאלה פתוחה #2) צריכה לעקוב אחרי
  אותו מבנה: FK cascade לישות הבעלים, לא hard-delete אלא דגל ביטול/ניתוק.
- **guard לפעולות ניהול-תוכן-צוות כבר קיים ומוכן לשימוש חוזר:**
  `backend/src/teams/team-permissions.util.ts::assertCanManageTeamContent(prisma, teamId,
  requesterId)` — `isAdmin===true || role==='TEAM_LEADER'`, כבר משמש פיצ'רים 2, 3 ו-5.
  מועמד ישיר לשאלה פתוחה #3 (מי מורשה לחבר/לנתק) אם התשובה היא "לא כל חבר צוות".
- **דפוס טיפול-חן בכשל שירות-חיצוני-אופציונלי כבר קיים ומאומת ב-Jest:**
  `backend/src/email/email.service.spec.ts` — בודק בפירוש מה קורה כש-`RESEND_API_KEY` חסר
  (לוג בלבד, לא זריקת שגיאה). אותה גישה מדויקת מתאימה לחיבור Google Calendar (שורה 5 בברירות
  המחדל הטכניות למעלה).
- **מקום UI טבעי לחיבור "אישי" (אם שאלה פתוחה #2 נענית כך) כבר קיים:**
  `frontend/src/features/settings/` (`ProfileFormCard`, `AppearanceCard`, `AdminTeamsCard`,
  מוצגים דרך `frontend/src/app/settings.tsx`) — מסך "הגדרות" קיים עם דפוס card-per-concern
  מדויק, כרטיס "חיבור יומן Google" חדש ישב שם באותה רוח בלי לבנות מסך חדש מאפס.
- **מקום UI טבעי לחיבור "משותף-לצוות" (אם שאלה פתוחה #2 נענית כך):** אותו דפוס פאנל-מתקפל
  שכבר שימש את פיצ'ר 3 (`category-management-panel`, מתוכנן) ופיצ'ר 5
  (פאנל היסטוריית שינויי תאריכים) — מבוסס על `invite-links-panel.tsx` (web+native), מוטבע
  ב-`team-card.tsx` מיד אחרי הרכיבים הקיימים.

### 6.1 Backend — שלב א' (סימון תאריכי ספרינט ביומן) — חסום עד ליצירת Google Cloud OAuth client (ר' 6.0.1)

- [ ] התקנת `googleapis` ב-`backend/package.json` (תלות חדשה — ראו ברירת מחדל טכנית #1).
- [ ] מודל Prisma חדש `GoogleCalendarConnection`: `userId` FK ל-`User` (cascade — חיבור אישי,
      ר' החלטה 6.0.2), `accessToken, refreshToken, expiresAt DateTime, googleAccountEmail
      String, calendarId String @default("primary"), isRevoked Boolean @default(false),
      createdAt`. לבנות על תבנית `TeamInvite` (FK cascade, דגל ביטול-רך, לא מחיקה) בדיוק כפי
      ש-`backend/AGENTS.md` §"Per-team-owned entities" מנחה.
- [ ] `npx prisma db push` מול `postgres-test` בלבד לפיתוח/בדיקות; **לא** מול Neon dev/prod
      בלי אישור מפורש של נוה (`backend/AGENTS.md` §Database).
- [ ] מודול חדש `backend/src/google-calendar/` (controller+service), בהשראת מבנה `invites`:
      endpoint ליזום OAuth (`GET .../google/connect`, מפנה ל-consent screen של Google עם
      `scope=https://www.googleapis.com/auth/calendar.events`), ו-callback
      (`GET .../google/callback`, מחליף `code` ב-access+refresh token, שומר ב-DB עם
      `userId` של המשתמש המחובר). משתני סביבה
      `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` דרך infisical (ברירת
      מחדל טכנית #4).
- [ ] חיבור/ניתוק: **אין guard מיוחד** מעבר לבדיקת חברות-בצוות פעילה של המשתמש המבצע (ר'
      החלטה 6.0.3) — כל חבר צוות מחבר/מנתק רק את חיבור ה-Google **שלו**.
- [ ] `sprints.service.ts::create`: אחרי יצירת הספרינט (לא חוסם את התשובה ל-client) — לכל
      חיבור Google פעיל (`isRevoked=false`) של כל חבר בצוות, קריאה ל-Google Calendar API
      ליצירת אירוע all-day (`start.date`/`end.date`, לא `dateTime`, ר' ברירת מחדל טכנית #2)
      בלוח השנה האישי שלו, title=שם הספרינט, description כולל שם הצוות. עטוף ב-try/catch
      לפי דפוס `email.service.ts` (ברירת מחדל טכנית #3) — כשלון סנכרון מתועד בלוג, לא זורק
      שגיאה החוצה; שמירת `googleEventId` שהוחזר לכל חיבור (כדי לאתר את האירוע לעדכון ב-
      `update`).
- [ ] `sprints.service.ts::update`: כשמתעדכן `startDate`/`endDate` בפועל (אותה השוואת
      ערך-ישן-מול-חדש שכבר מתועדת בפיצ'ר 5, §5.0.4) — לכל חיבור Google פעיל עם
      `googleEventId` קיים לספרינט הזה, קריאת `events.patch` לעדכון האירוע הקיים בתאריכים
      החדשים (ר' החלטה 6.0.4). כשלון מטופל כמו ב-`create` — לוג בלבד.
- [ ] Endpoint לניתוק חיבור (`DELETE`/`PATCH .../google-calendar/disconnect`) — מסמן
      `isRevoked=true`, לא מוחק את הרשומה (עקבי עם `TeamInvite`).

### 6.2 Frontend — שלב א'

- [ ] כרטיס חדש בהגדרות (`frontend/src/features/settings/`, ליד `ProfileFormCard`/
      `AppearanceCard`, מוצג דרך `frontend/src/app/settings.tsx`) — כפתור "חבר יומן Google"
      שמפנה ל-endpoint ה-OAuth של הבקאנד; לאחר חזרה מוצג "מחובר כ-{googleAccountEmail}" +
      כפתור ניתוק.
- [ ] `trackEvent()` על כפתור חיבור וכפתור ניתוק, לפי הכלל הקבוע בפרויקט.
- [ ] `Strings.settings.*` — מחרוזות עבריות חדשות: כותרת הכרטיס, טקסט "מחובר כ-...", כפתורי
      חיבור/ניתוק.
- [ ] הודעת שגיאה ברורה אם OAuth נכשל (חזרה מ-Google עם שגיאה/ביטול הסכמה מצד המשתמש) —
      לא להשאיר את המשתמש מול מסך ריק.

### 6.3 בדיקות — שלב א'

- [ ] Jest ל-`google-calendar` service: `googleapis` client ממוקק לחלוטין (ר' ברירת מחדל
      טכנית #5) — יצירת אירוע all-day עם התאריכים הנכונים, עדכון אירוע קיים ב-`update`,
      כשלון API לא מפיל את `sprints.service.ts::create`/`update` (בדיקת ה-try/catch עצמו).
- [ ] Jest ל-endpoint חיבור/ניתוק: חבר צוות רגיל יכול לחבר/לנתק את החיבור **שלו בלבד**, לא
      את של חבר אחר (`userId` מהטוקן, לא מה-body).
- [ ] Playwright e2e: **לא ניתן/לא רצוי לבצע OAuth אמיתי מול Google בסביבת e2e מבודדת** —
      יש להחליט על אסטרטגיית stub (mock server לענה על ה-callback, או מוקינג ברמת ה-service
      כמו ב-Jest) לפני כתיבת התרחיש; הבדיקה עצמה מוודאת שכל חבר צוות (לא רק admin) רואה את
      כרטיס החיבור בהגדרות, ושסטטוס "מחובר"/"מנותק" מוצג נכון אחרי כל פעולה.
- [ ] בדיקת מובייל — `Mobile Chrome` project, עקבי עם שאר הפיצ'רים בבאקלוג.

### 6.4 שלב ב' (עתידי, לא ב-MVP) — תאריך רטרו נפרד ביומן

**נשאר עתידי/לא ב-MVP בהחלטת נוה (ר' 6.0) — לא לפרט checklist טכני לפני שנוצר מודל "רטרו"
עצמאי במערכת.** כרגע אין אפילו ישות "רטרו" בנתונים לחבר אליה תאריך (ר' ממצאי מחקר). קווים
כלליים בלבד, לעדכון (רצוי דרך `product-manager` נפרד) כשהצורך בישות כזו יעלה בפני עצמו:

- Backend: ככל הנראה שדה/טבלה חדשה לתאריך/שעת רטרו (על `Sprint` או על ישות "רטרו" חדשה),
  ואירוע יומן שני נפרד מאירוע טווח הספרינט, דרך אותו חיבור Google שכבר נבנה בשלב א'.
- Frontend: שדה קלט לתאריך/שעת רטרו בטופס יצירת/עריכת ספרינט (אם ידני), או תצוגה בלבד (אם
  נגזר אוטומטית).
- בדיקות: אותה גישה כמו שלב א' (mock ל-Google API, לא קריאה אמיתית).

### לא בטיפול (פיצ'ר 6)

- שילוב עם יומנים אחרים (Outlook/Apple Calendar וכו') — Google בלבד בסבב הזה.
- הזמנת (invite) משתתפים ספציפיים לאירוע היומן — רק יצירת אירוע, בלי ניהול משתתפים.
- תזכורות/notifications מותאמות על האירוע — ברירות המחדל של Google Calendar עצמו, לא נבנה
  מנגנון תזכורת נפרד באפליקציה.

---

## פיצ'ר 7: אימות כתובת דואר אלקטרוני (Email Verification)

מטרת הפיצ'ר: לוודא שכתובת הדואר האלקטרוני שמשתמש מזין באמת שייכת לו, על ידי שליחת קישור
אימות חד-פעמי לכתובת שנרשמה. הפיצ'ר מחולק לשני חלקים מפורשים: **(א)** אימות דואר לזרימת
ההרשמה החדשה מכאן ואילך (משתמש חדש נרשם → מקבל מייל עם קישור → לוחץ → כתובתו מסומנת
כמאומתת). **(ב)** אכיפה על כל המשתמשים ש**כבר רשומים היום** במערכת, שמעולם לא עברו את
התהליך הזה כי הוא לא היה קיים בזמן שנרשמו — **לא** דרך סקריפט חד-פעמי, אלא דרך לוגיקה
קבועה בזרימת ה-login (ר' 7.0 למטה).

**ממצא מחקר קריטי לפני כל החלטה אחרת:** אין שום מנגנון אימות דואר קיים בקוד היום, ואין שדה
כזה על `User`. `model User` (`backend/prisma/schema.prisma:10-24`) מכיל רק `id, username,
email (unique), password, firstName?, lastName?, role, createdAt` — **אין** `emailVerified`/
`isVerified`/`emailVerifiedAt` וכו'. `AuthService.register` (`backend/src/auth/
auth.service.ts:13-52`) יוצר את המשתמש ומנפיק JWT (`expiresIn: '12h'`) **מיידית**, בלי שום
שלב ביניים — היום "נרשמת = מחובר/ת" בלי שום חסם. הוספת אימות דואר היא שינוי אמיתי לזרימה
הזו, לא תוספת שקופה.

**תובנת מחקר — עודכנה (2026-09-06) לאור החלטות נוה:** הטיוטה הקודמת של הסעיף הזה הניחה
ש-"אין צורך בדגל נפרד משתמש ותיק/חדש" כי `emailVerifiedAt === null` (ר' ברירת מחדל טכנית #2
למטה) מזהה את שני המצבים באופן זהה. **הנחה זו בוטלה במפורש** ע"י ההחלטות המוצריות למטה:
נוה קבע שמשתמש **חדש** (נרשם מעכשיו) נחסם **לגמרי** עד לאימות (החלטה #1), בעוד משתמש **ותיק**
(`emailVerifiedAt IS NULL` מלפני שהפיצ'ר עלה) **לא** נחסם כלל — רק feature-gating ממוקד
(החלטה #2). זו אבחנה אמיתית ומכוונת בין שני המצבים, לא רק ניסוח שונה של אותו דבר. הפתרון
שנבחר (ר' ברירת מחדל טכנית #9 למטה) הוא **לא** דגל DB נוסף — נגזר מהשוואת `User.createdAt`
מול קבוע-תאריך קבוע-בקוד ("מתי הפיצ'ר עלה לאוויר"), באותה רוח של "נגזר, לא מאוחסן" שכבר
מנחה את `emailVerifiedAt` עצמו ואת `getSprintState()` (פיצ'רים 1/5).

### 7.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **מבנה טוקן האימות — להעתיק את `TeamInvite`, לא להמציא מבנה חדש** (עקבי עם
   `backend/AGENTS.md` §"Per-team-owned entities": "copy `invites`, not `teams`" — אותו
   עיקרון חל גם כאן, גם שזו לא ישות פר-צוות): טבלה נפרדת `EmailVerificationToken` עם `token
   String @unique` (מיוצר באותה שיטה בדיוק כמו `invites.service.ts` שורה 59 —
   `crypto.randomBytes(24).toString('hex')`), `userId` FK ל-`User` (cascade), `expiresAt
   DateTime`, `consumedAt DateTime?` (במקום `isRevoked` בוליאני של `TeamInvite` — כאן יש
   ערך רב-יותר בלשמור **מתי** נוצל, לא רק אם), `createdAt @default(now())`.
2. **שדה חדש על `User`: `emailVerifiedAt DateTime?`** (nullable, בלי `@default()`) — לא
   בוליאן `isEmailVerified Boolean @default(false)`. סיבה: טיימסטמפ נותן גם את התשובה
   הבוליאנית (`!== null`) וגם "מתי אומת" בחינם, עקבי עם שאר הקוד שמעדיף לגזור "מצב" מנתון
   קיים על פני דגל בוליאני נפרד במקומות אחרים (ר' `getSprintState()` שתועד בפיצ'ר 1/5).
3. **בדיקת תוקף הטוקן (GET) נפרדת מהצריכה בפועל (POST) — להעתיק בדיוק את הפיצול הקיים
   ב-`invites`:** `GET /auth/verify-email/:token` (ציבורי, לא קורא ל-`validateToken` בכלל —
   מקביל ל-`GET /invites/:token`, `invites.controller.ts:13-16`) מחזיר `{valid, reason?}`
   בלי mutation; `POST /auth/verify-email/:token/consume` (ציבורי **גם הוא** — ר' ברירת מחדל
   #4 למטה למה, בשונה מ-`consumeInvite` שדורש bearer token) מבצע את הסימון בפועל.
4. **צריכת קישור האימות (`consume`) לא דורשת התחברות (bearer token) קודמת**, בניגוד
   ל-`POST /invites/:token/consume` (`invites.controller.ts:18-25`) שדורש `authHeader` כי
   שם צריך לדעת **איזה** משתמש מצטרף. כאן הטוקן עצמו כבר קושר ל-`userId` ספציפי בטבלה — אין
   צורך לזהות את המבקש בנפרד, בדיוק כמו זרימות "אימות דואר"/"איפוס סיסמה" סטנדרטיות בתעשייה
   (קישור=הוכחת בעלות, לא צריך גם session פעיל). המשתמש עשוי ללחוץ על הקישור ממכשיר/דפדפן
   שבו הוא לא מחובר בכלל (למשל פתיחת המייל בטלפון בעוד ההרשמה בוצעה בדסקטופ) — דרישת
   התחברות-קודמת הייתה שוברת את התרחיש הזה בלי סיבה אמיתית.
5. **שליחת המייל בפועל — הרחבת `EmailService` הקיים, לא שירות חדש.** `email.service.ts`
   (שורות 1-87) כבר בנוי בדיוק לדפוס הזה: `sendTeamJoinInvite` (שורות 53-86) בונה
   `registerUrl = ${this.frontendUrl}/invite/${token}`, עטוף try/catch, לוג אזהרה אם
   `RESEND_API_KEY` חסר (בלי לזרוק). מתודה חדשה `sendEmailVerification({to, token, name})`
   תיבנה באותה צורה בדיוק: `verifyUrl = ${this.frontendUrl}/verify-email/${token}`. אותה
   מתודה אחת משמשת את **כל שלושת** הטריגרים האפשריים לשליחה: הרשמה חדשה, login ראשון של
   משתמש ותיק (ברירת מחדל #13 למטה), ובקשת "שלח שוב" ידנית.
6. **כשלון שליחת מייל האימות לא חוסם שום פעולה שמייצרת/מעדכנת משתמש.** אותו תקדים בדיוק כמו
   `sendTeamApprovalRequest`/`sendTeamJoinInvite` — יצירת ה-`User`, ה-JWT, ושמירת שינוי פרופיל
   (ר' ברירת מחדל #16 למטה) תמיד מצליחים גם אם שליחת המייל נכשלה בפועל; המשתמש פשוט יראה
   "לא אומת" ויוכל לבקש קישור חדש (endpoint resend, ר' 7.1).
7. **דף הנחיתה של הקישור — עמוד `expo-router` חדש `frontend/src/app/verify-email/[token].tsx`**,
   על תבנית `frontend/src/app/invite/[token].tsx` (עמוד קיים כבר עושה בדיוק את הצורה הזו:
   `useLocalSearchParams` לטוקן, `useEffect` שקורא ל-GET לבדיקת תוקף, סטטוסים
   `loading/invalid/ready/joining/done/error`) — כאן אין צורך בשלב "מחובר?" כמו ב-invite,
   כי הצריכה לא דורשת auth (ר' #4): הדף יכול לבצע GET ואז מיד POST consume אוטומטית, בלי
   להמתין למשתמש מחובר.
8. **מיגרציית ה-DB עצמה (הוספת העמודות) בטוחה לביצוע ישיר** — עמודה חדשה nullable בלי
   `@default()` על `User` וטבלה חדשה `EmailVerificationToken` הן שינוי סכימה תוסף-גרידא
   (`npx prisma db push`), לא מסוכן כמו backfill פיצ'ר 3. **אין סקריפט batch/מיגרציה נפרד
   בכלל לחלק (ב')** — האכיפה על משתמשים ותיקים כולה קוד שוטף (ר' ברירות מחדל #9-#13 למטה),
   לא הרצה חד-פעמית על נתוני production.
9. **מנגנון ההבחנה בין "חסימה מלאה" (משתמש חדש) לבין "feature-gating בלבד" (משתמש ותיק) —
   נגזר מ-`User.createdAt`, בלי דגל DB נוסף.** קבוע קבוע-בקוד
   `EMAIL_VERIFICATION_ENFORCED_FROM` (Date; **לקבוע לתאריך העלייה לאוויר בפועל של הפיצ'ר**
   בזמן המימוש/הדיפלוי, לא ניחוש מראש) — משתמש עם `createdAt` **לפני** התאריך הזה = "ותיק"
   (feature-gating בלבד, לתמיד, ר' החלטה מוצרית #2 — לא grace period זמני); משתמש עם
   `createdAt` **אחריו** = "חדש" (חסימה מלאה עד אימות, ר' החלטה מוצרית #1). אותה פילוסופיה
   "נגזר, לא מאוחסן" שכבר מנחה את `emailVerifiedAt` עצמו ואת `getSprintState()` (פיצ'רים
   1/5) — לא סתירה לברירת מחדל #2, שני שדות שונים לגמרי (`emailVerifiedAt` = "האם אימת",
   `createdAt` מול הקבוע = "לאיזו קבוצת-אכיפה הוא שייך").
10. **מנגנון האכיפה המלאה למשתמש חדש — פרמטר נוסף על `validateToken`, לא שינוי בכל
    controller.** `AuthService.validateToken(authHeader, opts?: {requireVerifiedEmail?:
    boolean})` — ברירת המחדל של הפרמטר היא `true`, כך שכל קריאה קיימת (עשרות מקומות בכל
    controller, תמיד בצורה `await this.authService.validateToken(authHeader)`) ממשיכה
    לעבוד **בלי שום שינוי קוד** וזוכה לאכיפה אוטומטית: זורקת `ForbiddenException` עם הודעה
    מובחנת (`EMAIL_NOT_VERIFIED`, **לא** `'Invalid token'` הגנרי הקיים — ר' הבאג המתועד
    ב-`specs/00-shared-conventions.md` §3.1, כדי לא להתבלבל עם 401 טוקן-פסול) כש-
    `!user.emailVerifiedAt && user.createdAt >= EMAIL_VERIFICATION_ENFORCED_FROM`. משתמש
    ותיק (`createdAt` לפני הקבוע) **לא** נחסם כאן אף פעם דרך הפרמטר הזה, גם אם לא מאומת —
    ר' פריט #9 למעלה. **שני מקומות בלבד** צריכים override מפורש ל-
    `{requireVerifiedEmail: false}`: `GET /auth/me` (כדי שה-frontend תמיד ידע את הסטטוס, גם
    כשחסום) ו-`POST /auth/verify-email/resend` (כדי שמשתמש חסום יוכל לבקש קישור חדש).
11. **מנגנון feature-gating נפרד לפעולות ספציפיות — פונקציית עזר חדשה לשימוש חוזר, לא
    NestJS Guard/Decorator אמיתי.** נוה ביקש תשתית בהשראת `@RequireEmailVerified()`, אבל
    הפרויקט הזה **בכוונה** לא משתמש ב-Guards (`backend/AGENTS.md` §"Auth — manual, not
    Guards": "no Guards, no Passport, no NestJS auth module"). כדי לא לסתור את המוסכמה
    הקיימת, התשתית החוזרת נבנית כפונקציה פשוטה —
    `backend/src/auth/email-verification.util.ts::assertEmailVerified(user)` — שנקראת
    ידנית בתחילת כל controller/service method שדורש כתובת דואר מאומתת, **בדיוק** באותו
    דפוס כמו `assertCanManageTeamContent` (`backend/src/teams/team-permissions.util.ts`).
    **זו תשתית קבועה לשימוש חוזר בעתיד (ר' החלטה מוצרית #6) — לא קוד זמני להסרה.** חלה על
    **כל** משתמש לא-מאומת (חדש וגם ותיק כאחד) בנקודות ספציפיות בלבד (ר' ממצאי מחקר לרשימה
    הקונקרטית של הנקודות האלה כרגע).
12. **תוקף טוקן: 24 שעות.** קבוע `EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24`,
    `expiresAt = now + 24h` בזמן יצירת כל `EmailVerificationToken` (הרשמה, login ראשון של
    ותיק, resend ידני — כולם אותו TTL).
13. **שליחה למשתמשים ותיקים — לוגיקה קבועה בתוך `AuthService.login`, לא סקריפט חד-פעמי.**
    בכל `login` מוצלח: אם `!user.emailVerifiedAt` **וגם** למשתמש הזה **מעולם** לא נוצר שום
    `EmailVerificationToken` (ספירה=0, כולל טוקנים שכבר פגו/נוצלו) — ליצור טוקן חדש ולשלוח
    מייל (`sendEmailVerification`). זה הטריגר היחיד למשתמשים ותיקים (עקבי עם החלטה מוצרית
    #3 — "עצלני, לא batch"), **וגם** עקבי עם החלטה מוצרית #5 ("מייל אחד בלבד לכל טריגר"): 
    משתמש חדש כבר קיבל את הטוקן הראשון שלו ב-`register`, כך שהתנאי "ספירה=0" לא יתקיים שוב
    עבורו ב-login, ולא יישלח מייל שני. **אין סקריפט batch/מיגרציה נפרד בכלל** — זו לוגיקה
    שוטפת שנשארת בקוד לצמיתות (היא פשוט מפסיקה "לעשות משהו" ברגע שאין יותר משתמשים ותיקים
    לא-מאומתים — ר' גם "לא בטיפול" למטה).
14. **שינוי כתובת דואר בפרופיל (`PATCH /auth/profile`) תמיד מאפס אימות ומפעיל אימות
    מחדש לכתובת החדשה — לא נחסם ע"י `assertEmailVerified`.** אין הגיון למנוע ממישהו לתקן
    כתובת שגויה כי הוא "לא מאומת" — זה בדיוק המצב שבו שינוי הכתובת הוא הפתרון. לכן: אם
    `dto.email` (case-insensitive) שונה מ-`User.email` הנוכחי ב-DB, ה-update קובע גם
    `emailVerifiedAt: null` ויוצר+שולח `EmailVerificationToken` חדש לכתובת ה**חדשה** (אותה
    `sendEmailVerification`, אותו try/catch לא-חוסם מברירת מחדל #6). שינוי שם בלבד (אותה
    כתובת) לא נוגע ב-`emailVerifiedAt` בכלל.
15. **שדה מחושב נוסף שמוחזר עם אובייקט המשתמש: `mustVerifyEmail: boolean`** — מחושב
    בדיוק לפי אותו תנאי כמו ברירת מחדל #10
    (`!emailVerifiedAt && createdAt >= EMAIL_VERIFICATION_ENFORCED_FROM`), ומצורף בתגובות
    `register`/`login`/`GET auth/me`. **הסיבה:** כדי שה-frontend לא יצטרך לדעת בכלל על
    הקבוע `EMAIL_VERIFICATION_ENFORCED_FROM` או לשכפל את הלוגיקה — בדיוק כמו שנמנעים
    מכפילות מיותרת בקוד הזה בכל מקום אחר שאפשר (בניגוד, למשל, לכפילות המתועדת-במפורש בין
    `comment-category-labels.ts` לפרונט). ה-frontend בודק שדה בוליאני יחיד.

**החלטות מוצריות (נוה, 2026-09-06):**

1. **משתמש חדש (הרשמה) — חסימה מלאה, לא "nag".** תהליך ה-register עצמו **לא משתנה**
   מבחינת ה-response שלו (עדיין מנפיק `accessToken`+`user` כמו היום, ר' ברירת מחדל #6/#10) —
   אבל מהרגע הזה, כל endpoint מוגן אחר (כל controller method שקורא ל-`validateToken` עם
   ברירת המחדל שלו) חוסם אותו עם `EMAIL_NOT_VERIFIED` (403) עד לאימות, **חוץ** מ-`GET
   /auth/me` ומ-`POST /auth/verify-email/resend` (ר' ברירת מחדל #10). ה-frontend מציג מסך
   ייעודי "בדוק/י את הדואר שלך" במקום האפליקציה עצמה, לא מסך login רגיל ולא באנר-בלבד (ר'
   7.2).
2. **משתמש ותיק (`emailVerifiedAt IS NULL` מלפני העלייה לאוויר) — בלי חסימה, בלי grace
   period בזמן. אכיפה מיידית אבל feature-level (feature-gating) בלבד.** המשתמש ממשיך
   להשתמש באפליקציה כרגיל; רק תכונות ש"צריכות דואר אמין" חסומות (`assertEmailVerified`, ר'
   ברירת מחדל #11) עד שיאמת, עם הודעה ברורה. ברגע שהוא מאמת — נפתח מיד (בלי refetch נוסף
   מעבר לעדכון `user.emailVerifiedAt` הרגיל בתגובה).

   **הרשימה הקונקרטית של "תכונות שדורשות `emailVerifiedAt` לא-null" שנמצאו בקוד (רק אלה,
   אין עוד):**
   - **`POST /teams/:teamId/invites` כש-`dto.email` סופק** — יצירת הזמנה אישית-לכתובת
     (`invites.service.ts::createInvite`, נכנס לענף `if (dto.email) {...
     sendTeamJoinInvite...}` שורות 72-79). `assertEmailVerified` נקרא שם, רק כש-`dto.email`
     truthy (הזמנת "קישור כללי" בלי כתובת — `InviteLinksPanel`, ר' ממצאי מחקר — **לא**
     נחסמת, כי היא לא שולחת מייל בשם המשתמש בכלל).
   - **אותה נקודה מכסה גם את `TeamsService.addMember`** (`teams.service.ts` שורות 172-188)
     — כשה-`username` שסופק בפועל הוא כתובת מייל של מי שעוד לא רשום, ה-method קורא ישירות
     ל-`invitesService.createInvite(teamId, {email: dto.username, role}, requesterId)` —
     אותה בדיקה חלה אוטומטית, בלי נקודת אכיפה נוספת. **ב-UI, זו נקודת הכניסה האמיתית**
     (ר' ממצאי מחקר: `AddMemberForm`, לא `InviteLinksPanel`).
   - **שינוי כתובת דואר בפרופיל — לא "feature gated" באותה צורה**, ר' ברירת מחדל #14
     (reset + reverify, לא חסימה).
   - נבדק בגריפ מקיף על כל שימוש ב-`EmailService`/שדה `email` ב-`backend/src` —
     `sendTeamApprovalRequest` (יצירת צוות) שולח לכתובת ה**מאשר** (admin קבוע-מראש ברשימת
     `ALLOWED_APPROVER_EMAILS`, לא כתובת היוצר) ולכן אינו תלוי בכתובת של המשתמש הפועל —
     לא נכנס לרשימה.
3. **שליחה למשתמשים ותיקים: עצלנית (lazy), רק בפעם הבאה שהם מתחברים** — לא batch יזום
   בהשקה. ר' ברירת מחדל #13 למימוש המדויק.
4. **תוקף קישור: 24 שעות**, עם `POST /auth/verify-email/resend` (endpoint מאומת, ר' ברירת
   מחדל #10) לבקשת קישור חדש אחרי שהוא פג.
5. **בלי תזכורת חוזרת (reminder email) ב-MVP.** מייל אימות אחד בלבד לכל טריגר (הרשמה חדשה,
   או login ראשון של משתמש ותיק, או resend ידני) — אין cron/scheduler חדש, אין תלות תזמון
   חדשה בפרויקט.
6. **המנגנון הוא תשתית קבועה לשימוש חוזר, לא סקריפט זמני.** `assertEmailVerified`, הפרמטר
   `requireVerifiedEmail` על `validateToken`, והקבוע `EMAIL_VERIFICATION_ENFORCED_FROM`
   נשארים בקוד לצמיתות ומיועדים לשימוש חוזר ע"י תכונות/endpoints עתידיים נוספים שידרשו
   כתובת דואר מאומתת — **לא** מתויגים "TEMPORARY", **לא** מתועדים כ"חוב טכני להסרה". הלוגיקה
   השוטפת ב-`login` (ברירת מחדל #13) גם היא נשארת לצמיתות — היא פשוט מפסיקה להפעיל את
   התנאי שלה כשאין יותר משתמשים ותיקים לא-מאומתים בפועל, בלי שצריך "לזכור להסיר" אותה.

### ממצאי מחקר

- **`User` (`schema.prisma:10-24`) אין לו שום שדה אימות היום** — ר' "ממצא מחקר קריטי" למעלה.
- **`AuthService.register`** (`auth.service.ts:13-52`): בודק ייחודיות `username`/`email`
  (שורות 15-22, `OR` query — **לא** lowercased; ר' באג דומה שכבר תועד ב-
  `specs/02-teams-and-approval.md` §9.1 לגבי `approverEmail` case-sensitivity — שווה תשומת
  לב דומה כאן אם טוקן האימות/lookup עתידי תלוי ב-email השוואה, אם כי ה-lookup המרכזי כאן
  הוא לפי `token` ולא לפי `email` כך שהסיכון הישיר קטן), יוצר `User`, ומנפיק JWT מיידית
  (שורות 41-45) — **נשאר כך** (ר' החלטה מוצרית #1 — ה-response של `register` לא משתנה).
  `AuthService.login` (שורות 54-84) — אותו JWT, אותו מבנה תשובה; זו הפונקציה שמקבלת את
  לוגיקת השליחה-העצלנית למשתמשים ותיקים (ברירת מחדל #13).
- **`AuthService.validateToken`** (`auth.service.ts:86-107`): נקודת האכיפה המרכזית והיחידה
  לכל endpoint מוגן (קרוא ידנית מכל controller, אין `@UseGuards` בפרויקט — ר'
  `backend/AGENTS.md` §"Auth — manual, not Guards"). **זו הפונקציה שמקבלת את הפרמטר השני
  האופציונלי `{requireVerifiedEmail}`** (ברירת מחדל #10) — כל שאר הקוד קורא לה היום כ-
  `this.authService.validateToken(authHeader)` בלבד, בעשרות מקומות (`auth.controller.ts`,
  `invites.controller.ts`, `teams.controller.ts`, `sprints.controller.ts`,
  `comments.controller.ts`) — אף אחד מהם **לא צריך להשתנות**, כי ברירת המחדל של הפרמטר
  (`true`) כבר מטפלת בהם. יש כאן גם באג מתועד קיים
  (`specs/00-shared-conventions.md` §3.1: `'User not found'` נבלע ותמיד יוצא כ-`'Invalid
  token'`) — לא לגעת בזה, ולהשתמש בהודעת שגיאה **שונה** במפורש (`EMAIL_NOT_VERIFIED`, 403)
  כדי לא להתבלבל עם ה-401 הגנרי הקיים.
- **`AuthService.updateProfile`** (`auth.service.ts:109-121`): כרגע כותב `data: {firstName,
  lastName, email: dto.email}` ישירות, **בלי שום בדיקה** אם הכתובת השתנתה בפועל. חשוב: ה-hook
  שקורא לזה מה-frontend (`use-profile-form.ts::handleUpdateProfile`, שורות 21-27) **תמיד**
  שולח את שדה ה-`email` הנוכחי בכל שמירה (גם עריכת שם בלבד) — כך שהבדיקה "האם באמת השתנה"
  **חייבת** להיות מול הערך הקיים ב-DB (`existing.email`), לא מול "האם השדה נשלח בבקשה"
  (אותה מלכודת שכבר תועדה עבור `UpdateSprintDto` בפיצ'ר 5, §5.0.4/ממצאי מחקר).
- **תבנית מדויקת לטוקן חד-פעמי עם check+consume נפרדים — `TeamInvite` +
  `backend/src/invites/`:** `schema.prisma:60-76` (מודל), `invites.service.ts` (יצירת
  טוקן שורה 59 `crypto.randomBytes(24).toString('hex')`, `reasonForInvalidity()` שורות
  25-30 — פונקציה משותפת שמחזירה סיבת-אי-תקפות קונקרטית ל-UI, לא רק `throw`),
  `invites.controller.ts` — `GET invites/:token` ציבורי (שורות 13-16) מול `POST
  invites/:token/consume` שדורש bearer (שורות 18-25). זו התבנית המדויקת ביותר בקוד הזה
  לצורך הזה, ומתועדת במפורש ב-`backend/AGENTS.md` §"Per-team-owned entities" כתבנית-ברירת-מחדל
  לכל טוקן/משאב חדש מהסוג הזה.
- **הרשאה קיימת ל-`assertCanManageTeamContent`** (`backend/src/teams/
  team-permissions.util.ts`) היא הדוגמה החיה ל"פונקציית עזר משותפת, לא Guard" בקוד הזה —
  בדיוק הדפוס ש-`assertEmailVerified` (חדש) יחקה. שני קבצים שכבר משתמשים בה
  (`comments.service.ts`, מודול קטגוריות עתידי בפיצ'ר 3) מדגימים איך פונקציית-עזר כזו
  מוטמעת ידנית בתחילת method, בלי decorator/Guard NestJS אמיתי.
- **הנקודות הקונקרטיות היחידות שתלויות בכתובת דואר אמינה של המשתמש הפועל, אחרי גריפ מקיף
  על `EmailService`/שדה `email` בכל `backend/src`:**
  - `invites.service.ts::createInvite` (שורות 32-82): כשם ש-`requester` כבר נטען שם היום
    (שורה 52, `this.prisma.user.findUnique({where:{id: requesterId}})`, לצורך
    `inviterName`) — זו בדיוק נקודת ה-hook הקיימת להוסיף גם את בדיקת `requester.emailVerifiedAt`
    בלי שאילתה נוספת, לפני הענף `if (dto.email) {...}` (שורה 72).
  - `teams.service.ts::addMember` (שורות 172-188): מאציל ל-`createInvite` עם `dto.email`
    כשמשתמש לא נמצא — **אין** צורך בשינוי כאן בכלל, האכיפה עוברת דרך ה-method המשותף.
  - **ב-frontend, נקודת הכניסה האמיתית היא `AddMemberForm`
    (`frontend/src/features/teams/components/team-list-web/add-member-form.tsx`,
    ומקבילת `team-list-native/add-member-form.tsx`), לא `InviteLinksPanel`.**
    `InviteLinksPanel::handleCreateLink` (שורות 57-81) שולח רק `{name, expiresAt, maxUses}`
    — **בלי `email` בכלל** — זו זרימת "קישור כללי" בלבד, שלא תלויה בדואר של המשתמש ולכן
    **לא** צריכה גייטינג. `AddMemberForm::handleAddMember` (שורות 23-53) שולח `POST
    /teams/:id/members {username: trimmed}`, שהוא בדיוק מה שמגיע ל-`addMember` ועלול
    להסתיים ב-`createInvite({email: ...})` כש-`trimmed` הוא כתובת מייל לא-רשומה.
  - `teams.service.ts::create` (יצירת צוות) שולח `sendTeamApprovalRequest` ל-`approver.email`
    (שורות 54-99) — כתובת ה**מאשר** (admin קבוע-מראש מ-`ALLOWED_APPROVER_EMAILS`, שורה 15),
    **לא** כתובת היוצר עצמו — אין תלות בכתובת הדואר של המשתמש הפועל, לכן לא ברשימה.
- **`EmailService`** (`backend/src/email/email.service.ts`): שולח דרך `Resend`
  (`process.env.RESEND_API_KEY`, נופל ל-"לוג בלבד" בלי סוד — שורות 11-17), שתי זרימות קיימות
  כבר: `sendTeamApprovalRequest` (שורות 19-51) ו-`sendTeamJoinInvite` (שורות 53-86, בונה
  `registerUrl` מ-`this.frontendUrl` + `token`, בדיוק דפוס ה-URL שדרוש כאן). שתיהן HTML
  ידני עם `dir="rtl"`, עטופות try/catch עם `this.logger.error`, לא זורקות שגיאה החוצה.
- **דף frontend מדויק לצריכת טוקן דרך URL — `frontend/src/app/invite/[token].tsx`** (114
  שורות): `useLocalSearchParams` לטוקן מה-URL, `useEffect` שקורא ל-GET לבדיקת תוקף בטעינה,
  state machine `loading/invalid/ready/joining/done/error`, `window.location.href = '/'`
  בסיום בגלל קרש ידוע ב-`<Tabs>` של expo-router אחרי מעבר client-side (הערה מפורשת בקוד,
  שורות 54-56) — לחזור על אותה טכניקה בעמוד `verify-email/[token].tsx` החדש.
- **שער הכניסה הראשי (`_layout.tsx`, שורות 27-68):** `LayoutContent` מציג `<AuthForm />`
  כש-`!token`, אחרת `<AppTabs />`. יש כבר תקדים ל-"נתיב שצריך להישאר נגיש לפני ואחרי
  התחברות בלי לעבור דרך ה-gate הרגיל" — `isInviteRoute` (שורה 31, 57-59) עוקף את כל הבדיקה
  ומחזיר `<Slot />` ישירות. עמוד `/verify-email/[token]` ידרוש טיפול דומה (עוקף גם הוא את
  ה-auth gate, כי לפי ברירת מחדל #4 אין דרישת התחברות כדי לצרוך את הטוקן). **בנוסף** — לפי
  החלטה מוצרית #1, ה-gate הזה צריך ענף שלישי מפורש: `token && user && user.mustVerifyEmail`
  (השדה המחושב מברירת מחדל #15, **לא** חישוב ידני של תאריך-השקה בצד ה-frontend) → מסך
  ייעודי "אמת/י את הדואר שלך", לא `AuthForm` ולא `AppTabs`. משתמש ותיק לא-מאומת
  (`mustVerifyEmail === false` אבל `emailVerifiedAt === null`) **ממשיך ל-`AppTabs` הרגיל**.
- **שרשרת ה-props הקיימת עד ל-`AddMemberForm`/`InviteLinksPanel` — צריכה תוספת prop חדשה,
  לא endpoint חדש.** `dashboard-web.tsx`/`dashboard-native.tsx` כבר מחזיקים את `user` המלא
  (`useAuth()`, שורה 16/35), אבל מעבירים ל-`<TeamList>` רק `userId={user.id}`
  (`dashboard-web.tsx` שורה 109, `dashboard-native.tsx` שורה 215) — לא את `user` עצמו.
  `TeamList` (`features/teams/index.tsx`) → `TeamListWeb`/`TeamListNative`
  (`team-list-web/index.tsx`/`team-list-native/index.tsx`, שניהם מקבלים `userId: number`
  בלבד) → `TeamCard` (web/native, גם הוא `userId: number` בלבד, `team-card.tsx` שורה
  14-22) → `AddMemberForm`. שרשרת שלמה (5 קבצים בכל פלטפורמה) צריכה prop בוליאני חדש
  (`isEmailVerified`, מחושב פעם אחת ב-dashboard מ-`user.emailVerifiedAt`) שמועבר עד
  ל-`AddMemberForm` בלבד (לא ל-`InviteLinksPanel`, ר' לעיל).
- **`settings.tsx`/`use-profile-form.ts`** (`frontend/src/app/settings.tsx`,
  `frontend/src/features/settings/hooks/use-profile-form.ts`): `handleUpdateProfile`
  (שורות 12-48) כבר קורא ל-`login(token, response.data)` אחרי שמירה מוצלחת (שורה 37) —
  מעדכן את `user` בקונטקסט מיד עם התשובה מה-backend, כולל `emailVerifiedAt`/`mustVerifyEmail`
  החדשים בלי שינוי קוד נוסף שם. זו הנקודה הטבעית להציג הודעת "נשלח מייל אימות לכתובת
  החדשה" (ליד `profileMessage` הקיים) כש-backend מחזיר שהאימייל אכן השתנה.
- **אין שום cron/job scheduler בקוד היום** (נבדק בגריפ `cron|schedule|@nestjs/schedule` —
  שום התאמה) — **לא רלוונטי יותר** אחרי החלטה מוצרית #5 (בלי תזכורות) — לא תידרש תלות תזמון
  חדשה בפרויקט עבור הפיצ'ר הזה.
- **`Strings.auth.*`** (`frontend/src/constants/strings.ts`) הוא מקור המחרוזות הקיים
  לטופס ה-login/register (`frontend/src/features/auth/`) — מחרוזות חדשות לזרימת האימות
  (הודעת "אנא אמת/י את הדואר", "הקישור נשלח מחדש" וכו') יתווספו לאותו אובייקט, לא ליצור
  קובץ נפרד.

### 7.1 Backend

**(א) זרימת הרשמה חדשה + תשתית האכיפה החוזרת:**

- [ ] מודל Prisma חדש `EmailVerificationToken`: `id, token String @unique, userId Int (FK
      ל-User, cascade), expiresAt DateTime, consumedAt DateTime?, createdAt DateTime
      @default(now())` (ר' ברירת מחדל טכנית #1). `User` מקבל `emailVerifiedAt DateTime?`
      (ברירת מחדל #2) ורלציה `emailVerificationTokens EmailVerificationToken[]`.
- [ ] `npx prisma db push` מול `postgres-test` (בטוח לביצוע ישיר); **לא** מול Neon dev/prod
      בלי אישור מפורש של נוה קודם (`backend/AGENTS.md` §Database).
- [ ] `EmailService`: מתודה חדשה `sendEmailVerification({to, token, name})` — אותו מבנה
      HTML/try-catch/לוג בדיוק כמו `sendTeamJoinInvite` (שורות 53-86), עם `verifyUrl =
      ${this.frontendUrl}/verify-email/${token}`. משמשת את כל שלושת הטריגרים (register,
      login-ראשון-של-ותיק, resend) — מתודה אחת, לא שלוש.
- [ ] `backend/src/auth/email-verification.util.ts` (קובץ חדש): קבוע
      `EMAIL_VERIFICATION_ENFORCED_FROM: Date` (**לקבוע לתאריך העלייה לאוויר בפועל בזמן
      המימוש/הדיפלוי** — ברירת מחדל טכנית #9), קבוע `EMAIL_VERIFICATION_TOKEN_TTL_HOURS =
      24` (ברירת מחדל #12), פונקציית עזר `mustVerifyEmail(user: {emailVerifiedAt: Date |
      null; createdAt: Date}): boolean` (`!emailVerifiedAt && createdAt >=
      EMAIL_VERIFICATION_ENFORCED_FROM` — ברירת מחדל #9/#15), ופונקציית עזר
      `assertEmailVerified(user: {emailVerifiedAt: Date | null})` שזורקת
      `ForbiddenException('יש לאמת את כתובת הדואר האלקטרוני שלך לפני ביצוע פעולה זו')`
      כש-`!emailVerifiedAt` — **בדיוק** באותו דפוס כמו `assertCanManageTeamContent`
      (`backend/src/teams/team-permissions.util.ts`), **לא** NestJS Guard/Decorator (ר'
      ברירת מחדל #11 — הפרויקט הזה בכוונה לא משתמש ב-Guards). זו תשתית קבועה לשימוש חוזר,
      לא קוד זמני.
- [ ] `AuthService.validateToken(authHeader, opts?: {requireVerifiedEmail?: boolean})` —
      הוספת הפרמטר השני, ברירת מחדל `requireVerifiedEmail: true`. אחרי טעינת ה-`user`
      הקיים (שורה 94-96), אם `requireVerifiedEmail !== false && mustVerifyEmail(user)` →
      `throw new ForbiddenException('EMAIL_NOT_VERIFIED')` (403, **לא** `'Invalid token'`
      הגנרי — ר' ממצאי מחקר, הבאג המתועד ב-`specs/00-shared-conventions.md` §3.1). **אין
      צורך לשנות אף controller קיים** — כל קריאה קיימת ל-`validateToken(authHeader)`
      (`auth`, `invites`, `teams`, `sprints`, `comments` controllers) ממשיכה לעבוד עם ברירת
      המחדל `true` ומקבלת את האכיפה אוטומטית.
- [ ] `AuthService.register`: אחרי יצירת ה-`User`, ליצור `EmailVerificationToken`
      (`crypto.randomBytes(24).toString('hex')`, `expiresAt = now +
      EMAIL_VERIFICATION_TOKEN_TTL_HOURS`) ולקרוא ל-`sendEmailVerification` (לא-חוסם, ר'
      ברירת מחדל #6). ה-`accessToken`/`user` שמוחזרים מ-`register` **לא משתנים** (החלטה
      מוצרית #1) — אבל `user` המוחזר כולל את `mustVerifyEmail` המחושב (ר' item הבא).
- [ ] `AuthService.login`: לוגיקת שליחה-עצלנית למשתמשים ותיקים (ברירת מחדל #13) — אחרי
      אימות הסיסמה, אם `!user.emailVerifiedAt` וגם
      `await this.prisma.emailVerificationToken.count({where:{userId: user.id}}) === 0` →
      ליצור `EmailVerificationToken` ולשלוח `sendEmailVerification` (לא-חוסם — כשל שליחה
      לא מפיל את ה-`login`).
- [ ] `register`/`login`/`auth.controller.ts::me`: אובייקט ה-`user` המוחזר מקבל שדה מחושב
      נוסף `mustVerifyEmail: mustVerifyEmail(user)` (ברירת מחדל #15) — לצד השדות הקיימים,
      לא כעמודת DB.
- [ ] `auth.controller.ts::me`: משנה את הקריאה ל-`this.authService.validateToken(authHeader,
      {requireVerifiedEmail: false})` — כדי שמשתמש חסום עדיין יוכל לדעת את הסטטוס שלו.
- [ ] `GET /auth/verify-email/:token` — controller חדש (או מתווסף ל-`auth.controller.ts`),
      **ציבורי** (אין קריאה ל-`validateToken`), מקביל ל-`GET /invites/:token`. מחזיר
      `{valid: boolean, reason?: string}` בלי mutation — `reason` דרך פונקציית-עזר בסגנון
      `reasonForInvalidity` הקיימת ב-`invites.service.ts` (שורות 25-30): "הקישור פג תוקף",
      "הקישור כבר נוצל", "הקישור לא נמצא".
- [ ] `POST /auth/verify-email/:token/consume` — **גם הוא ציבורי, בלי `validateToken`** (ר'
      ברירת מחדל #4). מאתר `EmailVerificationToken` לפי `token`, בודק תוקף/ניצול (אותה
      פונקציית עזר), ואם תקין — בתוך `prisma.$transaction`: מסמן `consumedAt = now()` על
      הטוקן, ומעדכן `User.emailVerifiedAt = now()` על המשתמש המשויך.
- [ ] `POST /auth/verify-email/resend` — קורא ל-`this.authService.validateToken(authHeader,
      {requireVerifiedEmail: false})` (כדי שגם משתמש חדש חסום לגמרי יוכל לקרוא לו). אם
      `user.emailVerifiedAt` כבר קיים → 409/הודעה ברורה שאין צורך; אחרת יוצר
      `EmailVerificationToken` חדש (`expiresAt` לפי אותו TTL) ושולח מייל שוב. rate-limiting
      (כמה פעמים אפשר לבקש) נשאר MVP בלי הגבלה מפורשת (ר' "לא בטיפול" למטה).
- [ ] `invites.service.ts::createInvite` (שורות 32-82): מיד אחרי טעינת `requester` (שורה
      52, כבר קיים לצורך `inviterName` — לא שאילתה נוספת), אם `dto.email` truthy → קריאה
      ל-`assertEmailVerified(requester)` **לפני** הענף `if (dto.email) {...
      sendTeamJoinInvite...}` (שורה 72). מכסה אוטומטית גם את `TeamsService.addMember`
      (שורות 172-188) שמאציל לאותה method — **אין שינוי נדרש ב-`teams.service.ts`**.
- [ ] `AuthService.updateProfile` (שורות 109-121): לפני ה-`update`, לטעון את המשתמש הקיים
      ולהשוות `dto.email` (case-insensitive, `.trim()`) מול `existing.email`. אם שונה בפועל
      — ה-`update` היחיד כולל גם `email: dto.email` וגם `emailVerifiedAt: null`, ואחריו
      יצירת `EmailVerificationToken` חדש + `sendEmailVerification` לכתובת **החדשה** (לא-חוסם
      את השמירה עצמה, ר' ברירת מחדל #6/#14). אם `dto.email` זהה לקיים (בהתעלם מ-case/רווחים)
      — אין שינוי ב-`emailVerifiedAt` ואין טוקן חדש.

### 7.2 Frontend

- [ ] `frontend/src/app/verify-email/[token].tsx` — עמוד חדש, על תבנית מדויקת של
      `frontend/src/app/invite/[token].tsx`: `useLocalSearchParams` לטוקן, `useEffect` ש-GET
      בודק תוקף ואז (בלי להמתין להתחברות, ר' ברירת מחדל #4) קורא מיד ל-POST consume, state
      machine `loading/invalid/verifying/done/error`. הודעת הצלחה מפנה חזרה לאפליקציה
      (`window.location.href='/'` בדפוס הקיים אם web, `router.replace('/')` ב-native).
- [ ] `_layout.tsx`: `isInviteRoute` (שורה 31) מורחב/משוכפל ל-`isVerifyEmailRoute` (בדיקת
      `pathname?.startsWith('/verify-email/')`) שעוקף את ה-auth gate באותה צורה, כי הדף לא
      דורש התחברות.
- [ ] `_layout.tsx::LayoutContent` — ענף שלישי מפורש: `token && user && user.mustVerifyEmail`
      → מסך ייעודי חדש "אמת/י את הדואר שלך" (לא `AuthForm`, לא `AppTabs`) עם: הודעה שנשלח
      מייל לכתובת הרשומה, כפתור "שלח שוב" שקורא ל-`POST /auth/verify-email/resend`, וכפתור
      התנתקות (`logout()` מ-`useAuth`). משתמש ותיק לא-מאומת (`mustVerifyEmail === false`)
      **לא** נכנס לענף הזה — ממשיך ל-`AppTabs` הרגיל.
- [ ] באנר קבוע (לא חוסם, per-visit — לא ניתן לסגירה לצמיתות) ב-`dashboard-web.tsx`/
      `dashboard-native.tsx`, מוצג כש-`user && !user.emailVerifiedAt && !user.mustVerifyEmail`
      (כלומר: ותיק, לא-מאומת, לא נחסם) — טקסט ברור שמסביר שחלק מהתכונות (הזמנת חברים
      בכתובת מייל) חסומות עד לאימות, עם כפתור "שלח שוב".
- [ ] שרשרת prop חדשה עד ל-`AddMemberForm` (ר' ממצאי מחקר): `dashboard-web.tsx`/
      `dashboard-native.tsx` מחשבים `isEmailVerified={!!user.emailVerifiedAt}` ומעבירים
      ל-`<TeamList>` (בנוסף ל-`userId` הקיים) → `TeamListWeb`/`TeamListNative`
      (`team-list-web/index.tsx`/`team-list-native/index.tsx`) → `TeamCard` (web/native) →
      `AddMemberForm` (web/native, prop חדש `isEmailVerified: boolean`). **לא** ל-
      `InviteLinksPanel` (ר' ממצאי מחקר — הזרימה שלה לא תלויה בדואר).
- [ ] `AddMemberForm`/`AddMemberForm` (native): כש-`!isEmailVerified`, ה-`Field` וכפתור
      "הוסף חבר צוות" מוצגים במצב disabled + הודעה מוטבעת ("יש לאמת את כתובת הדואר שלך לפני
      הזמנת חברים בכתובת מייל שאינה רשומה עדיין") במקום לתת לשלוח ולקבל 403 מה-backend.
- [ ] `ProfileFormCard`/`use-profile-form.ts`: אחרי שמירה מוצלחת שבה הכתובת השתנתה בפועל
      (ה-backend מחזיר `emailVerifiedAt: null` חדש לעומת הערך הקודם ב-context) — הודעת
      `profileMessage` מציינת גם "נשלח מייל אימות לכתובת החדשה", לצד ההודעה הקיימת
      "הפרטים האישיים עודכנו בהצלחה".
- [ ] מחרוזות חדשות ב-`Strings.auth.*`/`Strings.settings.*`/`Strings.teamList.*`: כותרת/טקסט
      מסך האימות החוסם, טקסט הבאנר לוותיקים, טקסט חסימת `AddMemberForm`, הודעת "הקישור נשלח
      מחדש בהצלחה", הודעות שגיאה (קישור פג/נוצל/לא נמצא), הודעת "נשלח מייל אימות לכתובת
      החדשה".
- [ ] `trackEvent()` על: כפתור "שלח שוב" (גם ממסך החסימה וגם מהבאנר), טעינת דף
      `verify-email/[token]`, לפי הכלל הקבוע בפרויקט.

### 7.3 בדיקות

- [ ] Jest ל-`AuthService`: `register` יוצר גם `EmailVerificationToken` ושולח מייל
      (`EmailService` ממוקק), `expiresAt` בעוד 24 שעות; `login` יוצר טוקן ושולח מייל **רק**
      כשלמשתמש `emailVerifiedAt===null` וספירת טוקנים קיימת = 0 (לא יוצר שוב אם כבר יש
      טוקן, גם אם פג/נוצל); `verify-email` GET מחזיר `valid:false` + סיבה נכונה לכל אחד
      מ-שלושת מצבי אי-התקפות (פג/נוצל/לא נמצא, בהשראת בדיקות `invites.service.spec.ts`
      הקיימות ל-`reasonForInvalidity`); `consume` מעדכן בפועל `User.emailVerifiedAt` ו-
      `EmailVerificationToken.consumedAt` בטרנזקציה אחת, ולא ניתן לצרוך טוקן פעמיים; `resend`
      חוסם משתמש שכבר מאומת ויוצר טוקן חדש למי שלא, ועובד גם כש-`requireVerifiedEmail:
      false` מבוקש (משתמש חסום יכול לקרוא לו).
- [ ] Jest ל-`validateToken`: עם `requireVerifiedEmail` (ברירת מחדל `true`) — משתמש חדש
      לא-מאומת (`createdAt` אחרי `EMAIL_VERIFICATION_ENFORCED_FROM`) נחסם ב-`403
      EMAIL_NOT_VERIFIED`; משתמש ותיק לא-מאומת (`createdAt` לפני הקבוע) **לא** נחסם; משתמש
      מאומת (כל `createdAt`) לא נחסם; עם `{requireVerifiedEmail: false}` שום משתמש לא נחסם
      מהסיבה הזו (401 טוקן-פסול הרגיל עדיין עובד כרגיל).
- [ ] Jest ל-`assertEmailVerified`: זורק על `emailVerifiedAt===null`, לא זורק אחרת. Jest
      ל-`invites.service.ts::createInvite`: `dto.email` מ-requester לא-מאומת נחסם (403),
      `dto.email` מ-requester מאומת עובד, invite בלי `email` (קישור כללי) עובד גם ממשתמש
      לא-מאומת. Jest ל-`updateProfile`: שינוי כתובת בפועל מאפס `emailVerifiedAt` ויוצר טוקן
      חדש; שמירה עם אותה כתובת (case/רווחים שונים) לא משנה `emailVerifiedAt`.
- [ ] Playwright e2e — הרשמה חדשה (Desktop+Mobile Chrome): נרשם משתמש חדש → רואה מסך "אמת/י
      את הדואר שלך" (לא הדשבורד) → מנסה לנווט לדף אחר ונשאר חסום → שולף את הטוקן שנוצר
      בפועל מה-DB של סביבת הטסט (לא ניתן לבדוק תיבת דואר אמיתית ב-e2e — לקרוא ל-DB/למקק את
      `EmailService`, בדומה לאיך ש-e2e קיימים כבר בודקים זרימות מבוססות-טוקן) → מדמה לחיצה
      על הקישור (ניווט ל-`/verify-email/:token`) → חוזר לאפליקציה ורואה את הדשבורד הרגיל,
      בלי מסך החסימה.
- [ ] Playwright e2e — משתמש ותיק (feature-gating): נוצר משתמש ישירות ב-DB של סביבת הטסט עם
      `createdAt` **לפני** `EMAIL_VERIFICATION_ENFORCED_FROM` ו-`emailVerifiedAt: null` (כדי
      לדמות "ותיק" בלי לחכות זמן אמת) → מתחבר → רואה את הדשבורד הרגיל **ו**גם את הבאנר → מנסה
      להזמין חבר צוות בכתובת מייל לא-רשומה דרך `AddMemberForm` → רואה שהשדה/כפתור חסומים עם
      הודעה → מאמת (דרך אותו טוקן-מה-DB) → הבאנר נעלם ו-`AddMemberForm` נפתח בלי refetch נוסף.
- [ ] Playwright e2e — שינוי כתובת דואר בפרופיל: משתמש מאומת משנה כתובת ב-`settings.tsx` →
      רואה הודעת "נשלח מייל אימות לכתובת החדשה" → `user.emailVerifiedAt` בקונטקסט הופך
      ל-`null` מיד (בלי רענון עמוד).
- [ ] בדיקת מובייל — `Mobile Chrome` project ב-Playwright, עקבי עם כל שאר הפיצ'רים בבאקלוג.

### לא בטיפול (פיצ'ר 7)

- **תיקון פער-אימות דומה בזרימת `TeamInvite` עם `email` נעול** — הזמנה אישית
  (`TeamInvite.email`) כיום רק משווה טקסטואלית את כתובת ההזמנה מול `user.email` בזמן
  ההצטרפות (`invites.service.ts` שורה 144), בלי שום הוכחת-בעלות אמיתית משלה. פיצ'ר זה לא
  פותר את הפער הזה — נשאר מחוץ לתחולה, לתעד כפריט עתידי נפרד אם ירצו לחזק אותו.
- החלטה אם/איך למחוק את `EmailVerificationToken` הישנים אחרי שנוצלו — נשארים בטבלה
  (append-only, עקבי עם `TeamInvite`), אין TTL/ניקוי אוטומטי בסבב הזה.
- **Rate-limiting על `POST /auth/verify-email/resend`** — MVP בלי הגבלה מפורשת על כמה
  פעמים אפשר לבקש קישור חדש. סיכון נמוך (לא endpoint שמניב ערך לתוקף חיצוני), אבל שווה
  תשומת לב אם ייראה בפועל שימוש-לרעה.
- **תזכורת חוזרת (reminder email)** — נדחתה במפורש (החלטה מוצרית #5). אם ירצו בעתיד: תידרש
  תלות תזמון חדשה (`@nestjs/schedule` או job חיצוני), שלא קיימת בפרויקט היום.
- **הסרת "מנגנון האכיפה למשתמשים ותיקים" בעתיד — אין צורך.** ר' החלטה מוצרית #6: זו תשתית
  קבועה (`assertEmailVerified`, `requireVerifiedEmail` על `validateToken`,
  `EMAIL_VERIFICATION_ENFORCED_FROM`), לא סקריפט חד-פעמי — אין דבר "להסיר" אחרי שכל
  המשתמשים הוותיקים יאמתו; הלוגיקה ב-`login` פשוט מפסיקה להפעיל את עצמה (הספירה כבר לא
  תהיה 0 לאף אחד). אם ירצו לנקות ידנית בעתיד את שאלת "כמה משתמשים ותיקים עדיין לא אימתו" —
  `SELECT count(*) FROM "User" WHERE "emailVerifiedAt" IS NULL AND "createdAt" <
  '<EMAIL_VERIFICATION_ENFORCED_FROM>'` היא שאילתת בדיקה ידנית, לא פעולת ניקוי נדרשת.

---

## פיצ'ר 8: תצוגת "משחק זיכרון" ללוח הרטרו — עדיפות מיידית, לממש לפני שאר הפיצ'רים בתור (3, 5, 6, 7)

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

- **מבנה `Comment` הקיים** (`backend/prisma/schema.prisma:127-141`): `content, type
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
      `Comment` (לפי `schema.prisma:127-141`: `content, type, category, isAnonymous,
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
