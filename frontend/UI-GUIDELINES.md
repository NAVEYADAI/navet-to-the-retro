# UI-GUIDELINES

> תבנית חובה לכל UI בפרוייקט. קלוד קורא את הקובץ הזה **לפני** שהוא כותב מסך, קומפוננטה או תיקון עיצובי.
> אם משהו כאן מתנגש עם קוד קיים — הקובץ הזה מנצח, והקוד הקיים משתנה.

## 0. הכיוון

מוצק ומעשי: כרטיסים ברורים, טיפוגרפיה חזקה, צבע ממוקד. RTL עברית.
Rubik לכותרות ולאלמנטי UI, Heebo לטקסט גוף. אקסנט אחד לכל האפליקציה.

## 1. ארבעת החוקים

1. **אין צבע, גופן, ריווח או רדיוס בקומפוננטה.** הכל מ-`useTheme()` ומ-`src/design/tokens.ts`.
   אפס גרדיאנטים, אפס `boxShadow` צבעוני, אפס hex בתוך `sx`.
2. **קלט אחד לכל האפליקציה.** כל שדה עובר דרך `<Field>`. אין `TextField` ישיר, אין `inputSx` מקומי.
3. **רשת קבועה.** כל מסך עטוף ב-`<Page>`, תוכן ברשת `<Grid columns={n}>`. פיצ׳ר חדש נכנס כתא — לא משנה רוחב ולא מזיז כותרת.
4. **היררכיה אחת.** כפתור `primary` אחד לכל מסך. כל השאר `secondary` / `ghost`.

## 2. ספריית הבסיס — `src/components/ui`

| קומפוננטה | תפקיד | מחליף |
|---|---|---|
| `Button` | primary / secondary / ghost / danger, גדלים sm / md | כל `MuiButton` עם `sx` |
| `Field` | text, email, password, number, date, textarea, select | כל `TextField` + תווית ידנית |
| `Card` | כרטיס יחיד, אופציונלי `placeholder` | `Card`+`CardContent` עם `sx` |
| `Badge` / `StatusDot` | מצב סמנטי (success / warning / danger / neutral / accent) | תגי מצב מקודדים, אימוג׳י |
| `Segmented` | בחירה בלעדית מ-2-4 אפשרויות | `Tabs`, `ToggleButtonGroup`, chips נבחרים |
| `Page` / `PageHeader` / `Grid` | מבנה מסך | `Box` עם `maxWidth` מקומי |
| `Icon` | אייקון קטן שמלווה טקסט/badge/כפתור | אימוג׳י כאייקון, SVG מקומי אד-הוק |

**להוסיף קומפוננטה שביעית רק אחרי שברור שאי אפשר להרכיב אותה מהשש.** קומפוננטה חדשה נכנסת ל-`ui/`, לא ל-`features/`.

## 3. טוקנים

`src/design/tokens.ts` — ניטרלים, שמונה סכימות אקסנט (blue / cyan / teal / green / amber / rose / purple / graphite) בכל מצב, ארבעה טונים סמנטיים, סקאלת טיפוגרפיה בת 9 מדרגות, ריווח 4pt, רדיוס 6/8/12/999, שלושה גדלי אייקון, שני צלים.

**מצב ספרינט לא בוחר צבע.** `sprintTone` ממפה `active → success`, `upcoming → warning`, `closed → neutral`.

## 4. ערכת נושא והעדפות משתמש

`AppThemeProvider` עוטף את האפליקציה פעם אחת בשורש. הוא מחזיק שלוש העדפות שנשמרות לכל משתמש:
`mode` (light / dark / system), `scheme` (סכימת אקסנט), `density` (compact / regular).

- קומפוננטה קוראת `useTheme()`. **אין prop `theme` שמועבר ידנית**, ואין `isDark` בתוך קומפוננטה.
- מסך ההעדפות: `features/settings/components/appearance-card.tsx`.
- ב-web, `createMuiTheme(theme)` מזרים את אותם טוקנים ל-MUI, כדי שגם קומפוננטת MUI לא-עטופה תיראה נכון.

## 5. RTL

- `dir="rtl"` פעם אחת בשורש. אחר כך `flexDirection: 'row'` רגיל — **לא** `row-reverse` בכל Box.
- מאפיינים לוגיים בלבד: `paddingInlineStart`, `marginInline`, `borderInlineEnd`, `textAlign: 'start'`.
- מספרים, תאריכים ומזהים באנגלית נשארים LTR — לעטוף ב-`<bdi>`.

## 6. תנועה

`transition` על hover / focus / press בלבד, `0.15s ease`.
**אין** `Grow`, `Fade`, `Collapse` על טעינת מסך, ואין `animation: pulse`.

## 7. מה אסור — checklist לפני כל commit של UI

- [ ] אין hex, `rgba(`, `linear-gradient` או `fontFamily` בשום קובץ מחוץ ל-`src/design/`
- [ ] אין `TextField`, `MuiButton` או `Card` מיובאים ישירות בקובץ תחת `features/`
- [ ] אין `row-reverse`, `marginLeft`, `paddingRight`, `textAlign: 'right'`
- [ ] אין אימוג׳י בכותרת, בתווית או בתג
- [ ] אייקונים (אם יש) רק מ-`Icon` עם `name` מהרשימה המורשית ב-`components/ui/icon.tsx` — לא אימוג׳י ולא SVG מקומי
- [ ] אין יותר מכפתור `primary` אחד במסך
- [ ] אין `Grow` / `Fade` סביב תוכן מסך
- [ ] font-size שנבחר קיים ב-`type`; ריווח שנבחר קיים ב-`space`
- [ ] המסך עטוף ב-`<Page>` ומספר הטורים ב-`<Grid>` קבוע

## 8. סדר עבודה על מסך חדש

1. `<Page>` + `<PageHeader title subtitle action>`.
2. להחליט מספר טורים ולהצהיר `<Grid columns={n}>`.
3. להרכיב מ-`Card` / `Field` / `Badge` / `Segmented` בלבד.
4. לעבור על ה-checklist בסעיף 7.
5. משהו לא מתאים? לעדכן טוקן או קומפוננטה ב-`ui/` — לא לעקוף מקומית.

## 9. Native

הטוקנים משותפים ל-web ול-native. `ui/` ב-web בנוי על MUI; מקבילה native נכתבת כ-`*.native.tsx`
באותה תיקייה עם **אותו API בדיוק** ואותם טוקנים. מטרות נגיעה ב-native: `layout.minTouchTarget` = 44.

## 10. אייקונים

`Icon` הוא מקור האמת היחיד לאייקון — `components/ui/icon.tsx` (web, `lucide-react`) ו-
`components/ui/icon.native.tsx` (native, `lucide-react-native`), אותו API, אותה רשימת `IconName`.

- אין ייבוא ישיר של `lucide-react` / `lucide-react-native` תחת `features/` — רק דרך `<Icon name=... />`.
- גודל וטון רק דרך ה-props (`size`, `tone`) שמומרים לטוקנים ב-`iconSize`/`color`. אין `size={17}` חופשי.
- אייקון **מלווה** טקסט קיים (בכפתור, בתג) — הוא לא הופך להיות התווית הנגישה היחידה, אלא אם מדובר
  בפקד ייעודי עם `label`/`accessibilityLabel` (מחוץ לתחום הנוכחי — כרגע כל שימוש הוא אייקון+טקסט).
- להוסיף שם חדש ל-`IconName`/`REGISTRY` רק כשיש שימוש אמיתי — לא לייבא את כל ספריית lucide.
