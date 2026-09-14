## פיצ'ר 1: ייצוא ספרינט למצגת (Sprint Summary)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** אין שדה/טבלה חדשים — קורא בלבד מ-`Comment` (`content, type, category, isHighlighted, author`) ומ-`Team.creatorId`.
- **Backend:** `backend/src/sprints/sprint-summary.builder.ts`, `backend/src/sprints/pptx-post-process.util.ts`, `backend/src/sprints/sprints.controller.ts`+`sprints.service.ts::exportSummaryPptx`, `backend/src/comments/comment-category-labels.ts` (עותק ידני של תוויות הקטגוריה, מסונכרן ידנית מול הפרונט).
- **Frontend:** `frontend/src/features/sprint-summary/` (`index.tsx`, `components/sprint-summary-web.tsx`, `components/sprint-summary-native.tsx`, `stats.ts`, `templates.ts`).
- **Endpoints:** `GET /teams/:teamId/sprints/:sprintId/summary/export?template=<id>`.
- **תלוי בפיצ'רים אחרים:** מחכה ל-`Comment.isHighlighted` (פיצ'ר 2) לשקף מודגשות ייעודי, ול-`TeamCommentCategory` (פיצ'ר 3) לעדכן את האגרגציה מה-enum הישן ל-join.


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

### תוספת (2026-09-11): הסתרת בורר התבניות וכפתור ההורדה כשאין תגובות

נוה ביקש: כשבספרינט אין אף תגובה (`stats.total === 0`), אין דרך לגשת לאפשרויות הייצוא
(בורר התבניות + כפתור ההורדה) בכלל — לפני כן הם היו מוצגים תמיד, גם כשאין מה לייצא בפועל
(רק הסטטיסטיקות המספריות הוסתרו). תוקן ב-`sprint-summary-web.tsx`/`sprint-summary-native.tsx`
(שני הקבצים) — בורר התבניות וכפתור ההורדה עוברים תחת אותו תנאי `stats.total > 0` שכבר
שולט על הצגת הסטטיסטיקות. `tsc`/Jest (frontend) עוברים נקי, אין regressions.

### לא בטיפול (פיצ'ר 1)

- תיעוד דפוס "הורדת קובץ ב-native" (`File.downloadFileAsync`+`expo-sharing`) ב-
  `UI-GUIDELINES.md` — זה התקדים הראשון בקוד להורדת קובץ ב-native; שווה לתעד כדפוס קבוע
  לפני שהפיצ'ר הבא (למשל בחירת תבנית, או פיצ'ר עתידי אחר) צריך את אותו הדבר וממציא מחדש.

- אין תמיכה בעריכת/מחיקת תוכן מהמצגת אחרי ההפקה — זו הפקה חד-כיוונית מהנתונים הקיימים.
- אין שמירת "היסטוריית מצגות שהופקו" — כל הורדה מייצרת קובץ טרי מהנתונים העדכניים.
- שיתוף המצגת ישירות (מייל/קישור) — כרגע רק הורדה מקומית; להוסיף כפרק נפרד אם יידרש בעתיד.
