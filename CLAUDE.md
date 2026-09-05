# navet-to-the-retro

מונוריפו (npm workspaces): `backend/` (NestJS + Prisma + PostgreSQL) ו-`frontend/` (Expo — web + native, React 19, MUI).
כלי רטרוספקטיבות/ספרינטים לצוותים: יצירת צוות עם תהליך אישור דו-שלבי, ספרינטים, לוח רטרו (KEEP/IMPROVE), ייצוא ל-PPTX.

## לפני שעובדים בתוך תת-תיקייה

- **`frontend/`** — יש שם שרשרת הנחיות משלה: `frontend/CLAUDE.md` → `frontend/AGENTS.md` → `frontend/UI-GUIDELINES.md`. היא נטענת אוטומטית ברגע שעובדים על קבצים בתוך `frontend/`. אל תשכפל אותה כאן ואל תסתור אותה.
- **`backend/`** — יש כעת `backend/AGENTS.md` משלו (מוסכמות NestJS/Prisma, דפוס auth ידני, מה לעשות עם שינוי סכמה). מפנה בעצמו ל-`specs/00-shared-conventions.md` לבאגים/edge cases מתועדים.
- **`specs/`** — תיעוד עובדתי per-feature, נגזר מקריאת קוד (לא מזיכרון/כוונה). קרא `specs/README.md` לפני כתיבת טסטים לפיצ'ר שכבר מתועד שם — הוא מקור האמת למקרי קצה ובאגים ידועים, לא הנחה על מה שהקוד "אמור" לעשות.
- **`PRODUCT-BACKLOG.md`** — הבאק לוג המוצרי המשותף (backend+frontend ביחד, per feature). זה שונה לגמרי מ-`frontend/UI-MIGRATION-BACKLOG.md` (checklist טכני של מעבר עיצוב מסכים קיימים) — אל תערבב בין השניים. מונע על ידי שלושת הסוכנים שמפורטים למטה.

## פקודות נפוצות (מהשורש)

- `npm run dev` — backend + frontend יחד (`infisical run` + `concurrently`)
- `npm test` — כל הסוויטה: backend unit, backend e2e, frontend unit, frontend e2e
- `npm run deploy` — `deploy.sh`: מריץ את כל הטסטים למעלה, ורק אז `fly deploy` ל-backend ואז ל-frontend

## סוכנים זמינים (`.claude/agents/`)

- **`ui-migration`** — ממיר קובץ frontend אחד בכל הפעלה למערכת העיצוב שב-`frontend/UI-GUIDELINES.md`, לפי הסדר ב-`frontend/UI-MIGRATION-BACKLOG.md`. הבאקלוג הנוכחי **סגור (69/69)** — הפעל שוב רק אחרי שמוסיפים פריטים חדשים אליו. **לא קשור** ל-`PRODUCT-BACKLOG.md`.
- **`backend-feature`** — מממש את תת-הסעיף "Backend" של הפיצ'ר הבא ב-`PRODUCT-BACKLOG.md` שעדיין לא סגור.
- **`frontend-feature`** — מממש את תת-הסעיף "Frontend" של אותו פיצ'ר, רק אחרי שה-Backend שלו סגור.
- **`feature-orchestrator`** — הסוכן הראשי: מוצא את הפיצ'ר הבא ב-`PRODUCT-BACKLOG.md`, מפעיל `backend-feature` ואז `frontend-feature` בסדר הנכון (דרך `Task`), ומדווח מה נשאר (בד"כ תת-הסעיף "בדיקות"/e2e, שאף אחד מהשניים לא כותב). זו נקודת הכניסה הרגילה לקידום הבאקלוג — קרא `.claude/agents/feature-orchestrator.md` אם צריך לדעת בדיוק איך הוא מחליט.

## עיצוב/מוקאפים — הערת סנכרון

`.design/AGENTS.md` משמש את כלי Claude Design ליצירת מוקאפים, ונפרד מ-`frontend/UI-GUIDELINES.md` + `frontend/src/design/tokens.ts` שמגדירים את מערכת העיצוב בקוד בפועל. אלה **שני מקורות אמת נפרדים** לצבע/עיצוב — אם אחד מהם משתנה (למשל טון צבע), לוודא ידנית שהשני מתעדכן בהתאם, אחרת מוקאפים עתידיים לא ישקפו את האפליקציה האמיתית.
