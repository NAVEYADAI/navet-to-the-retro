# navet-to-the-retro

מונוריפו (npm workspaces): `backend/` (NestJS + Prisma + PostgreSQL) ו-`frontend/` (Expo — web + native, React 19, MUI).
כלי רטרוספקטיבות/ספרינטים לצוותים: יצירת צוות עם תהליך אישור דו-שלבי, ספרינטים, לוח רטרו (KEEP/IMPROVE), ייצוא ל-PPTX.

## לפני שעובדים בתוך תת-תיקייה

- **`frontend/`** — יש שם שרשרת הנחיות משלה: `frontend/CLAUDE.md` → `frontend/AGENTS.md` → `frontend/UI-GUIDELINES.md`. היא נטענת אוטומטית ברגע שעובדים על קבצים בתוך `frontend/`. אל תשכפל אותה כאן ואל תסתור אותה.
- **`backend/`** — יש כעת `backend/AGENTS.md` משלו (מוסכמות NestJS/Prisma, דפוס auth ידני, מה לעשות עם שינוי סכמה). מפנה בעצמו ל-`specs/00-shared-conventions.md` לבאגים/edge cases מתועדים.
- **`specs/`** — תיעוד עובדתי per-feature, נגזר מקריאת קוד (לא מזיכרון/כוונה). קרא `specs/README.md` לפני כתיבת טסטים לפיצ'ר שכבר מתועד שם — הוא מקור האמת למקרי קצה ובאגים ידועים, לא הנחה על מה שהקוד "אמור" לעשות.
- **`product-backlog/`** — הבאק לוג המוצרי המשותף (backend+frontend ביחד), קובץ נפרד לכל פיצ'ר (ר' `product-backlog/README.md` לאינדקס + טבלת סטטוס). כל קובץ פיצ'ר פותח בסעיף "נקודות מרכזיות (touchpoints)" — מודלים/endpoints/קבצים משותפים שהפיצ'ר נוגע בהם, כדי שאפשר לגרפ חפיפות בין פיצ'רים בלי לקרוא הכל. `product-backlog/IDEAS.md` הוא שכבה נפרדת ומוקדמת יותר — רעיונות בשורה-שתיים שנוה עוד לא אפיין איתי/עם `product-manager`, לפני שהם הופכים לקובץ פיצ'ר ממוספר. זה שונה לגמרי מ-`frontend/UI-MIGRATION-BACKLOG.md` (checklist טכני של מעבר עיצוב מסכים קיימים) — אל תערבב בין השניים. מונע על ידי הסוכנים שמפורטים למטה.

## הטמעה — כל פיצ'ר חדש

כל פיצ'ר חדש מסווג באפיון (`### N.4 הטמעה`) לרמה א'/ב'/ג' לפי "סטנדרט הטמעה" ב-`product-backlog/README.md` (המדריך האינטראקטיבי + "מה חדש" + רישום הפיצ'רים). הטיפול בהטמעה **חוסם סגירת פיצ'ר**: בלי זה הוא לא "מומש". פיצ'ר בלי השפעה על הטמעה (רמה ג') כותב זאת במפורש באפיון.

## באגים — עדכון אוטומטי של `product-backlog/BUGS.md`

- **`product-backlog/BUGS.md`** — רשימת הבאגים הידועים בקוד קיים (`BUG-NN`, חומרה, מיקום, שחזור). לא קשור לקבצי הפיצ'רים ולא נצרך על ידי `feature-orchestrator`.
- **כלל קבוע:** כל פעם שמתקנים באג שמופיע שם (בכל סשן, גם אם המשתמש לא ביקש במפורש) — כחלק מאותה עבודה מוחקים את הרשומה שלו מ-`BUGS.md` ומעדכנים: טבלת הסיכום (הספירה לפי חומרה), שורת "הכי דחוף", וטבלת האשכולות (מסירים את המספר). לא ממספרים מחדש. תיקון חלקי = הרשומה נשארת, מקוצרת למה שעוד פתוח. באגים נמוכים (BUG-37 ואילך) הם שורות בטבלה — מוחקים את השורה.
- אם התיקון חושף באג חדש — מוסיפים אותו ל-`BUGS.md` עם המספר הבא בתור.

## פקודות נפוצות (מהשורש)

- `npm run dev` — backend + frontend יחד (`infisical run` + `concurrently`)
- `npm test` — כל הסוויטה: backend unit, backend e2e, frontend unit, frontend e2e
- `npm run deploy` — `deploy.sh`: מריץ את כל הטסטים למעלה, ורק אז `fly deploy` ל-backend ואז ל-frontend

## הצוות (plugin `dev-team`) + `TEAM.md`

הסוכנים הכלליים (מפתחי backend/frontend, QA, מנהל מוצר, UX/UI, סוקר קוד, אבטחה, בודק תלויות, tech-lead) מגיעים מה-plugin
**`dev-team`** (ריפו נפרד, מותקן ברמת משתמש) ונקראים עם קידומת: `dev-team:backend-developer` וכו'. **`TEAM.md` בשורש** הוא
ה-adapter: הסטאק, הקבצים שכל תפקיד קורא, הפקודות, הכללים הקשיחים (אף פעם לא 5005), מילות הבאקלוג, ה-definition of done
(הטמעה, `trackEvent`, e2e), ושפת הדיווח. כל סוכן פותח בקריאתו — **מעדכנים כללים שם, לא בתוך סוכן.**

- `dev-team:tech-lead` — נקודת הכניסה לקידום הבאקלוג: backend → frontend → QA, ואז סקירת קוד/אבטחה/UX. לא כותב קוד.
- `dev-team:product-manager` — רעיון → קובץ פיצ'ר ב-`product-backlog/`; החלטות מוצריות נשארות "שאלות פתוחות". לא בשרשרת האוטומטית.
- `dev-team:dependency-checker` — חפיפות בין פיצ'רים. לא בשרשרת האוטומטית.
- `dev-team:backend-developer` / `frontend-developer` / `qa-engineer` — הפרוסות Backend / Frontend / בדיקות של הפיצ'ר הבא.
- `dev-team:code-reviewer`, `dev-team:security-checker`, `dev-team:ux-ui-designer` — קריאה בלבד, מדווחים ממצאים לפי חומרה.
- **`ui-migration`** (`.claude/agents/`, ספציפי לפרויקט) — ממיר קובץ frontend אחד בכל הפעלה למערכת העיצוב לפי
  `frontend/UI-MIGRATION-BACKLOG.md`. הבאקלוג הנוכחי **סגור (69/69)**. **לא קשור** ל-`product-backlog/`.

קוד ה-plugin: `~/Documents/GitHub/dev-team` (README שם). `/dev-team:team-init` מרענן את `TEAM.md` מהקוד.

## עיצוב/מוקאפים — הערת סנכרון

`.design/AGENTS.md` משמש את כלי Claude Design ליצירת מוקאפים, ונפרד מ-`frontend/UI-GUIDELINES.md` + `frontend/src/design/tokens.ts` שמגדירים את מערכת העיצוב בקוד בפועל. אלה **שני מקורות אמת נפרדים** לצבע/עיצוב — אם אחד מהם משתנה (למשל טון צבע), לוודא ידנית שהשני מתעדכן בהתאם, אחרת מוקאפים עתידיים לא ישקפו את האפליקציה האמיתית.
