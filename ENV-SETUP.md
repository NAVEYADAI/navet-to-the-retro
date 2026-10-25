# הקמת סביבת פיתוח על מחשב חדש

> מסמך הוראות בלבד — **אין בו שום סוד**. קבצי ה-env עצמם מגיעים בנפרד מנוה (לא דרך git), והם כוללים **רק ערכי development**.
> אם אתה Claude שקורא את זה: **אסור לך לפתוח, להדפיס או לצטט את תוכן קבצי ה-env** בשום שלב. מותר לבדוק רק שם קובץ, מיקום והרשאות.

## 1. הקוד
```bash
git clone git@github.com:NAVEYADAI/navet-to-the-retro.git
cd navet-to-the-retro
npm install --legacy-peer-deps      # הדגל נדרש בגלל התנגשות peer dependencies ידועה
```

## 2. הצוות של Claude (plugin)
```bash
claude plugin marketplace add NAVEYADAI/dev-team
claude plugin install dev-team@nave-plugins
```
לפתוח סשן חדש בתוך תיקיית הפרויקט, ולקרוא את `TEAM.md` בשורש לפני שעובדים.

## 3. איפה כל קובץ env הולך
הקבצים נשלחים בשמות **בלי נקודה בהתחלה** (כדי שלא יוסתרו או יתנגשו). `<repo>` = תיקיית הפרויקט:

| קובץ שהתקבל | יעד | מי קורא אותו |
|---|---|---|
| `root.env` | `<repo>/.env` | docker-compose (שורש) |
| `backend.env` | `<repo>/backend/.env` | השרת והסקריפטים של הסכמה |
| `frontend.env` | `<repo>/frontend/.env` | ה-frontend |

```bash
mv ~/Downloads/root.env .env
mv ~/Downloads/backend.env backend/.env
mv ~/Downloads/frontend.env frontend/.env
chmod 600 .env backend/.env frontend/.env
```
קובץ שלא התקבל — **לא ליצור אותו מהמצאה**; לשאול את נוה.

## 4. קובץ הבדיקות (לא נשלח — יוצרים בעצמך)
`backend/.env.test`: להעתיק מ-`backend/.env.test.example`, ולהגדיר:
- `DATABASE_URL=postgresql://test:test@localhost:5433/navet_test` (ה-DB המקומי שבדוקר; user ו-password הם `test`)
- `BACKEND_PORT=5006`
- `JWT_SECRET` — כל ערך (רק לבדיקות)

## 5. קבצים שכבר בתוך הריפו — לא לגעת
`backend/.infisical.json`, `frontend/.infisical.json` (אם קיימים) — לא להחליף ולא למחוק.

## 6. לוודא ש-git מתעלם מהקבצים (חובה, לפני כל commit)
```bash
git check-ignore -v .env backend/.env frontend/.env backend/.env.test
```
כל אחד מהם חייב להופיע כ-ignored. אם אחד לא — **לעצור, לא לעשות commit, ולהודיע לנוה.** אסור לעשות commit או push לקבצי env בשום מקרה.

## 7. הרצה, ובדיקה שהכול מחובר ל-DB הנכון
```bash
docker compose up -d --build backend
```
בשורות הראשונות של הלוג של ה-backend יש שורה שמתחילה ב-`Database`: היא מציגה את ה-host ואת `APP_ENV`.
- חייב להופיע `APP_ENV=development`.
- ה-host חייב להיות זה שנוה מסר בהודעה נפרדת.
- אם מופיעה אזהרה על **PRODUCTION** — לעצור מיד ולהודיע לנוה.

אחר כך:
```bash
docker compose up -d postgres-test
npm run migrate:sync --prefix backend
```

## 8. כללי עבודה (כתובים גם ב-`TEAM.md`)
- לא לקרוא ולא להדפיס קבצי `.env`, ולא להריץ `prisma` גולמי (`db push`, `migrate`, `studio`). סכמה — רק דרך `npm run migrate:*` (`migrate:new` יוצר מיגרציה, `migrate:sync` מחיל על בדיקות+פיתוח).
- שינוי סכמה ב-**production** עולה אוטומטית עם `npm run deploy` כקובץ מיגרציה שנוצר ונבדק בפיתוח. מיגרציה הרסנית נעצרת עד שמסמנים `-- destructive-ok: <סיבה>` בקובץ.
- לא `git push` ולא `deploy` בלי אישור מפורש.

## 9. אחרי ההקמה
מוחקים את המייל ואת הקבצים המצורפים (גם מהורדות וגם מהאשפה). אם הסודות עברו במייל, מומלץ לנוה לאפס אותם (סיסמת ה-DB, מפתחות API) אחרי שההקמה הסתיימה.
