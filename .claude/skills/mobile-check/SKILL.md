---
name: mobile-check
description: Checks that a screen works at phone width (375px) — runs the real app in a mobile browser against the isolated e2e stack, measures horizontal overflow, clipped text, off-screen elements, tiny touch targets and overlapping controls, takes screenshots, and reviews them against UI-GUIDELINES §7/§11. Use after building or changing any frontend screen/component, or when asked to "check mobile", "בדיקת מובייל", "does this fit on a phone".
argument-hint: "[screen or route to check — default: the screens touched by the current diff]"
---

# בדיקת מובייל (375px)

`frontend/UI-GUIDELINES.md` §7 ו-§11 מחייבים לבדוק **בפועל** ברוחב טלפון לפני שפיצ'ר/מסך נחשב גמור. ה-skill הזה עושה את זה
בצורה חוזרת: מדידה אוטומטית של הדפדפן + בדיקה ויזואלית של צילומי מסך.

**מה הוא לא בודק:** native (React Native) — צריך סימולטור/מכשיר, ואין כאן (אמור זאת בדיווח אם השינוי נוגע גם ב-native).
המדידה היא על ה-web ברוחב 375px; "נראה צפוף" נשפט בעין מהצילומים, לא מהמדידה.

## קבצי ה-skill
- `probe.js` — סקריפט DOM טהור שמוזרק לדף ומחזיר בעיות (`window.__mobileProbe()`): גלישה אופקית של הדף, אלמנטים מחוץ למסך,
  טקסט חתוך בלי ellipsis, טקסט קטן מ-11px, אזורי לחיצה קטנים מ-32px, בקרים שחופפים זה את זה. לא משנה כלום בדף.
  (כפתורי `<Button>` שלנו גבוהים 36px בכוונה — רק מתחת ל-32 מסומן.)
- `check.spec.template.ts` — תבנית Playwright: מזינה משתמש/צוות/ספרינט מבודדים דרך ה-API, פותחת כל מסך ברוחב 375, מריצה את ה-probe,
  מצלמת מסך מלא, וכותבת `report.json`.
- `_probe-selftest.mjs` — בדיקה עצמית של ה-probe (`node .claude/skills/mobile-check/_probe-selftest.mjs`). להריץ אם משנים את `probe.js`.

## צעדים

1. **קבע מה לבדוק.** מהארגומנט, ואם אין — מ-`git diff`/`git status`: אילו מסכים/קומפוננטות ב-`frontend/src` השתנו, ואילו נתיבים מרנדרים
   אותם (`frontend/src/app/`). אם השינוי הוא קומפוננטה משותפת — בדוק גם את שני המסכים הבולטים ביותר שמשתמשים בה.
2. **הכן את הבדיקה.** העתק את `check.spec.template.ts` ל-`frontend/e2e/_mobile-check.tmp.spec.ts` וערוך **רק** את מערך `screens`:
   לכל מסך — `name` ופונקציית `open(page, seed)` שמגיעה אליו **ומפעילה את המצבים שחשוב לראות** (פותחת תפריט "⋯", מרחיבה "כלי ספרינט",
   פותחת חלון, ממלאת טופס עד מצב שגיאה, שם ארוך במיוחד). מצבים ריקים/טעינה/שגיאה שייכים לבדיקה. אם צריך נתוני seed נוספים
   (חברי צוות, הערות) — הוסף קריאות API באותו סגנון; שמות משתמש חייבים להתחיל ב-`e2e_pw_` כדי ש-global-teardown ינקה אותם.
3. **הרץ** (רק על הסביבה המבודדת; ה-config מרים backend על 5006 ו-web על 8086):
   ```bash
   cd frontend && npx playwright test e2e/_mobile-check.tmp.spec.ts --project="Mobile Chrome"
   ```
   הפלט מדפיס `MOBILE_CHECK_REPORT <path>`. הדוח והצילומים נכתבים לתיקיית temp של המערכת (לא לתוך `frontend/`, כדי לא לשבור את
   ה-Metro watcher של הקונטיינר). הרצה ראשונה אחרי הפעלה קרה איטית (דקה+); קריסת דפדפן בלי כשל assertion = flake, מריצים שוב פעם אחת.
4. **מחק את `frontend/e2e/_mobile-check.tmp.spec.ts`** — תמיד, גם אם ההרצה נכשלה. אל תשאיר אותו ב-git.
5. **קרא את `report.json`** והפרד **ממצא אמיתי** מ**התראת שווא**. דוגמאות לשווא: אלמנט "מוסתר ויזואלית" בכוונה, אזור גלילה אופקית
   מכוון, `hidden` שמשרת ellipsis מותאם. אל תדווח שווא כבעיה; אם ה-probe טועה שוב ושוב על דפוס לגיטימי — תקן את `probe.js` והרץ את ה-selftest.
6. **פתח כל צילום** (`Read` על קובץ ה-png) והשווה ל-§7/§11: היררכיה ברורה? שורה עם יותר מ-2 badge/כפתור מול תווית מפוצלת לשתי שורות
   מכוונות? אין מילים שבורות באמצע/מספרים ותאריכים הפוכים (RTL — `<bdi>`)? שמות ארוכים נשברים ולא דוחפים? מצב פתוח של תפריט/קפל תקין?
   זה החלק ש-probe לא יכול לשפוט.
7. **דווח בעברית, בקצרה:**
   - טבלה: מסך · מדידה (נקי / N ממצאים) · צילום.
   - ממצאים לפי חומרה (🔴 גלישה/חתוך/חפיפה שמונעים שימוש · 🟠 אזור לחיצה קטן / צפיפות / הפרת §11 · 🟡 ליטוש), כל אחד עם `file:line` אם
     אפשר לאתר, מה המשתמש רואה, ותיקון מוצע בשורה.
   - מה **לא** נבדק (native, מסכים שלא הגעת אליהם, מצבים שלא הפעלת).
   אל תתקן בעצמך אלא אם התבקשת — דווח, והצע.

## כללים
- הסביבה המבודדת בלבד: לעולם לא `localhost:5005` ולא Neon (ה-hook חוסם גם ככה).
- לא `git push`, לא להשאיר קבצים זמניים, לא לשנות את `probe.js`/התבנית אלא כדי לתקן את הכלי עצמו.
- "עבר" = המדידה נקייה **וגם** הצילומים נבדקו בעין. אם לא פתחת צילום — אל תכתוב שבדקת מראה.
