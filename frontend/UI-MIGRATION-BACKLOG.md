# UI migration backlog

Ordered, dependency-first checklist for converting the rest of the frontend to the design system in
`src/design/` + `src/components/ui/` (see `UI-GUIDELINES.md` — read it before touching any item here).

**Foundation status: done.** `src/design/tokens.ts`, `theme-context.tsx`, `mui-theme.ts`,
`app-providers.{web,}.tsx`, and all of `src/components/ui/*` exist and are wired into
`src/app/_layout.tsx` via `<AppProviders>`. No existing screen has been converted yet — every item
below still uses the old pattern (`theme`/`isDark`/`colorScheme`/`accent`/`themeColors` props,
`Colors` from `constants/theme.ts`, direct MUI usage).

**Sections 1–8 status (2026-08-31): all items checked, but two gaps surfaced afterward** — a stray
legacy `useTheme()` at `src/hooks/use-theme.ts` (a second theme source, not the one in `design/`) still
has 3 consumers, and two route-level page shells (`src/app/settings.tsx`, `src/app/invite/[token].tsx`)
were never in this list and are still fully legacy. See sections 9–11 below — do 9 first, it unblocks
the rest and it's what the theme-duplication question was actually about.

**Ordering rule — do not reorder.** Items are listed bottom-up by dependency: a component only stops
requiring its `theme`-shaped prop once every child it renders has already been converted (or never took
one). Converting a parent before its children breaks the children, which still expect that prop.
Reference conversions the design tool already produced (for items marked "has reference") live under
`.design-migration-reference/` — read the live file first (it may have diverged since), then adapt the
reference rather than starting from scratch.

Effort ratings are from a direct line-count / theme-prop / raw-color-usage survey of each file.

## 1. Settings — first task, proves the pipeline end-to-end

- [x] `src/features/settings/components/profile-form-card.tsx` — self-contained, no unconverted
      children. **Has reference.** Small.
- [x] `src/features/settings/components/appearance-card.tsx` — new file, self-contained. **Has
      reference.** Small. Add it under `ProfileFormCard` in `src/app/settings.tsx` (remove
      `isDark`/`accent`/`themeColors` from the `ProfileFormCard` call only — `AdminTeamsCard` on the
      same page is untouched, still gets the old props, until its own turn below).

## 2. Teams — leaves (convert all of these before touching `team-card.tsx`)

- [x] `src/features/teams/components/team-list-web/pending-approval-card.tsx` — Small
- [x] `src/features/teams/components/team-list-native/pending-approval-card.tsx` — Small
- [x] `src/features/teams/components/team-list-web/pending-membership-card.tsx` — Small
- [x] `src/features/teams/components/team-list-native/pending-membership-card.tsx` — Small
- [x] `src/features/teams/components/team-list-web/add-member-form.tsx` — Small-Medium
- [x] `src/features/teams/components/team-list-native/add-member-form.tsx` — Small-Medium
- [x] `src/features/teams/components/team-list-web/team-member-row.tsx` — Medium
- [x] `src/features/teams/components/team-list-native/team-member-row.tsx` — Medium

## 3. Teams — composites (only after all of section 2 is checked off)

- [x] `src/features/teams/components/team-list-web/team-card.tsx` — Medium
- [x] `src/features/teams/components/team-list-native/team-card.tsx` — Medium
- [x] `src/features/teams/components/team-list-web/invite-links-panel.tsx` — **Large**
- [x] `src/features/teams/components/team-list-native/invite-links-panel.tsx` — **Large**
- [x] `src/features/teams/components/team-list-web/index.tsx` — Small (just re-exports; convert last)
- [x] `src/features/teams/components/team-list-native/index.tsx` — Small
- [x] `src/features/teams/components/team-list-native/styles.ts` — Small (roll into the components that use it as inline `useTheme()` values; delete the file once nothing imports it)

## 4. Retro — leaves

- [x] `src/features/retro/components/comment-card-web.tsx` — Small
- [x] `src/features/retro/components/comment-filter-bar-web.tsx` — Small
- [x] `src/features/retro/components/comment-filter-bar-native.tsx` — Medium
- [x] `src/features/retro/components/retro-wheel-toggle.tsx` — Small-Medium (high raw-color density despite small size — take care)

## 5. Retro — composite (only after section 4 is done)

- [x] `src/features/retro/components/sprint-retro-board-web.tsx` — **Large**
- [x] `src/features/retro/components/sprint-retro-board-native.tsx` — **Large**

## 6. Auth

- [x] `src/features/auth/components/role-selector-chips.tsx` — Small-Medium (high raw-color density)
- [x] `src/features/auth/components/auth-form-web.tsx` — **Large**
- [x] `src/features/auth/components/auth-form-native.tsx` — Medium-Large
- [x] Update the one call site in `src/app/_layout.tsx` (and `src/app/invite/[token].tsx`) to stop
      passing `isDark`/`theme`/`colorScheme` to `<AuthForm>` once both platforms above are converted.

## 7. Settings (remaining) + navigation

- [x] `src/features/settings/components/admin-teams-card.tsx` — Medium
- [x] `src/components/navigation/app-tabs.web.tsx` — Medium
- [x] `src/components/navigation/app-tabs.tsx` (native) — Trivial, already near-compliant (uses `useColorScheme()` internally)
- [x] `src/components/navigation/app-tabs.styles.ts` — Small

## 8. Dashboard + sprint list — last (blocked on sections 2–6)

- [x] `src/features/dashboard/components/dashboard-web.tsx` — **Has reference**, but the reference
      drops the `theme` prop to `<TeamList>`/`<SprintRetroBoard>` — only apply it once sections 2–5 are
      fully done, otherwise it breaks both.
- [x] `src/features/dashboard/components/dashboard-native.tsx` — Medium
- [x] `src/features/sprints/components/sprint-list-web.tsx` — **Has reference**, same caveat as
      dashboard-web (renders team/sprint children — verify no unconverted child remains before applying).
- [x] `src/features/sprints/components/sprint-list-native.tsx` — Medium-Large

## 9. ניקוי מקור theme כפול — קודם לכל השאר בפרק הזה

קיימים **שני** `useTheme()` שונים בקוד: `src/design/theme-context.tsx` (הנכון — מחזיר `AppTheme` מלא:
`color`/`space`/`type`/`radius`/`shadow`/`layout`/`motion`, עם העדפות משתמש שמורות) ו-`src/hooks/use-theme.ts`
(legacy — מחזיר רק `Colors[scheme]` גולמי, בלי accent/density, ישירות מ-`useColorScheme()`). שלושה קבצים
עדיין מייבאים את הישן. עד שזה לא נסגר, כלל סעיף 4 ("אין prop theme ידני") לא באמת מתקיים — חלק מהעץ מקבל
אובייקט theme שונה לגמרי מהשאר.

- [x] `src/components/themed-text.tsx` — הוחלף ל-`from '@/design/theme-context'`; מיפוי `ThemeColor` הישן
      (`text`/`background`/`backgroundElement`/`backgroundSelected`/`textSecondary`) לטוקנים החדשים דרך
      `legacyColor()` המשותף (`src/components/themed-view.tsx`).
- [x] `src/components/themed-view.tsx` — אותו דבר; מגדיר ומייצא את `legacyColor()`/`ThemeColor` המשותפים.
- [x] `src/components/ui/collapsible.tsx` — אותו דבר.
- [x] `src/features/teams/components/create-team-form.tsx` — נמצא תוך כדי (לא היה ברשימה): קיבל `theme`
      כ-prop ידני (בדיוק דוגמת ה-provider הכפול). הומר ל-`useTheme()` פנימי; גם תוקנו hex קשיחים ל-danger
      (`#ffebee`/`#ffcdd2`/`#c62828` -> `t.color.status.danger.*`). כתוצאה מזה גם `src/features/retro/index.tsx`
      איבד `theme` מת מ-`SprintRetroBoardProps` (אף מימוש לא קרא אותו), ו-`dashboard-native.tsx` איבד את
      ה-`legacyTheme` shim + 3 מקומות שהעבירו אותו הלאה.
- [x] `src/app/settings.tsx` — הומר במלואו ל-`<Page>`/`<PageHeader>`/`<Grid>`/`<Card>` + `useTheme()`; אימוג'י
      ומחרוזות הועברו ל-`Strings.settings.*` (חדש).
- [x] `src/app/invite/[token].tsx` — הוסר ה-`Colors`/`useColorScheme()` המקומי, `useTheme()` במקום.
- [x] נמחקו `src/hooks/use-theme.ts`, `Colors`/`ThemeColor` מ-`src/constants/theme.ts`, הקובץ המת
      `src/components/app-tabs.tsx`, וגם `features/settings/styles/settings.styles.ts` (נמצא תוך כדי —
      התברר מת לגמרי, אף קובץ לא קרא ל-`getSettingsCardSx`/`getSettingsInputSx`/`primaryButtonSx`).

## 10. הניווט (navbar) — הבעיה שדווחה במפורש ("נראה רע כולל ה-navbar") — done

`src/components/navigation/app-tabs.web.tsx` כבר משתמש ב-`useTheme()` הנכון, אבל אין לו התאמת מובייל
אמיתית — יש רק כלל CSS יחיד (`global-web-styles.ts`, `@media (max-width:640px)`) שמסתיר טקסט מותג ושם
משתמש, בלי לבדוק אם מה שנשאר (לוגו + שני כפתורי טאב + עיגול אווטאר + כפתור יציאה, הכל בשורה אחת ברוחב
`94%`) בכלל נכנס ברוחב מסך צר (~350-390px).

- [x] נבדק ב-375px (סביבת הפיתוח לא מאפשרת לצמצם את חלון הדפדפן מתחת ל-~500px בפועל, אז זה נבדק על ידי
      הזרקת ה-CSS הזמנית וכן חישוב שטח בפועל ב-500px — לא צילום מסך אמיתי ב-375px). כפתור "יציאה" עבר
      לאייקון-בלבד (`log-out` חדש ב-`Icon`, `components/ui/icon.tsx`+`icon.native.tsx`) מתחת ל-`460px`
      (`.nav-logout-text`/`.nav-logout-icon` ב-`global-web-styles.ts`, אותו דפוס בדיוק כמו
      `.nav-brand-text`/`.nav-user-text` הקיימים). זה משחרר מקום משמעותי; **מומלץ לבדוק שוב על מכשיר/דפדפן
      אמיתי ברוחב 350-390px** כדי לוודא שזה מספיק ואין עוד גלישה (לא אומת ויזואלית ב-375px אמיתי הפעם).
- [x] `src/components/navigation/app-tabs.tsx` (native) — נבדק: הקומפוננטה עצמה היא `NativeTabs` (עטיפת
      Expo Router לטאב-בר native של המערכת) בלי שום layout מותאם-אישית — אין שורה שיכולה לגלוש כי אין
      פריסת flex ידנית, וטאב-בר native תמיד מצטייר ברוחב הטלפון ממילא. אין מה לתקן כאן.

      **שני ממצאים נלווים שעלו תוך כדי הבדיקה, לא בטיפול עכשיו:**
      1. **אין דרך להתנתק (logout) ב-native בכלל.** `logout()` (מ-`context/auth-context.tsx`) נקרא רק
         מתוך `app-tabs.web.tsx` — אין שום קריאה לו מקובץ native. חסר UI להתנתקות באפליקציית הטלפון.
      2. **מסך ההגדרות (`src/app/settings.tsx`) הוא web-only** — מייבא `@mui/material` ישירות בלי שום
         `Platform.OS` guard וללא `settings.native.tsx` מקביל. MUI לא רץ ב-React Native (מרנדר `<div>`
         דרך react-dom) — כניסה ל-`/settings` מתוך טאב "הגדרות" ב-native כנראה תקרוס. זה קדם לסבב הזה
         (ההמרה בפרק 9 שמרה על אותה בעיה, לא יצרה אותה).
      **הקשר לתעדוף:** אין `eas.json`/סקריפט build native בפרויקט — נראה שהאפליקציה משמשת כיום רק כ-web
      (גם מהטלפון, בדפדפן), כך שזו כנראה לא באגז בפועל למשתמשי הקצה היום, אבל דורש החלטת מוצר (איפה
      logout אמור להופיע ב-native, האם לבנות `settings.native.tsx`) לפני שנוגעים בזה — לא תוקן כחלק
      מהמעבר הזה.

## 11. מסך-אחר-מסך — מעבר מובייל מלא (סעיף 11 ב-UI-GUIDELINES)

כל אחד מהמסכים הבאים עבר קונברסיה לטוקנים בעבר, אבל **לא נבדק ברוחב טלפון** לפי הכלל בסעיף 11 (שלא היה
קיים כשהם הומרו). לכל פריט: לפתוח ברוחב ~375px, לתקן מה שגולש/נדחס/נחתך, לוודא ש-`Grid`/שורות אופקיות
משתמשות ב-`flexWrap`/`minWidth:0` ולא מניחות רוחב desktop.

### 11א. דף הראשי (dashboard) — כל תת-קומפוננטה בנפרד — done

זה מה שנפתח מיד אחרי login וזה מה שדווח כ"נראה לא טוב במסכים קטנים" — לכן מפורק לפריט per קובץ, לא
מקובץ ביחד כמו שאר סעיף 11. סדר תלות מלמטה למעלה, כמו בסעיפים 2-3: `team-card`/`TeamList` לא נבדקים
לפני הילדים שלהם, ו-`dashboard-web`/`native` לא נבדק לפני `TeamList`/`TeamSprintsManager`.

**Web:**
- [x] `src/features/teams/components/team-list-web/pending-approval-card.tsx` — `flexWrap`+`minWidth:0`
      על שורת שם-הצוות/badge, `flexWrap` על שורת הכפתורים.
- [x] `src/features/teams/components/team-list-web/pending-membership-card.tsx` — `flexWrap` על שורת הכפתורים.
- [x] `src/features/teams/components/team-list-web/add-member-form.tsx` — נבדק, כבר טור יחיד ללא שורות
      אופקיות; לא נדרש שינוי.
- [x] `src/features/teams/components/team-list-web/team-member-row.tsx` — זה בדיוק הרכיב שנראה דחוס
      בצילום המסך המקורי ("נווה יחיאל ידעי" עם כל הכפתורים על שורה אחת). תיקון ראשון (`flexWrap`+
      `minWidth:0` על השורה החיצונית) לא הספיק — עדיין נראה דחוס אחרי דיווח חוזר, כי נקודת השבירה של
      wrap תלויה באורך השם ומשתנה בין משתמשים. תיקון שני: פירוק לשתי שורות מכוונות מראש (שם בשורה 1,
      כל ה-badge/כפתורים בשורה 2) במקום `justifyContent:'space-between'`+`flexWrap` על שורה אחת — ראה
      UI-GUIDELINES §11 ("שורת מידע + אשכול פעולות"). ניסיון שלישי (2026-09-01, בעקבות דיווח ממוקד על
      חברי-מנהלים) שמיזג badge "מנהל" לתוך badge התפקיד ("תפקיד • מנהל") **בוטל** — אחרי הפירוק ל-2
      שורות הצפיפות כבר לא הייתה בעיה אמיתית, וה-badge הממוזג רק נראה מוזר (תפקיד מקצועי + הרשאת-מערכת
      מעורבבים לטקסט אחד). הוחזר לשני badge נפרדים. ראה UI-GUIDELINES §11 ("אין למזג badge ממשמעות
      שונה"). גם שורת כפתורי שמירה/ביטול במצב עריכה קיבלה `flexWrap`.
- [x] `src/features/teams/components/team-list-web/invite-links-panel.tsx` — `flexWrap`+`minWidth:0` על
      שורת שם-קישור/badge, שורת שימושים/כפתורים, שורת הכפתורים הפנימית, ושורת יצירה/ביטול.
- [x] `src/features/sprints/components/sprint-list-web.tsx` — `flexWrap`+`minWidth:0` על כותרת+Segmented+
      כפתור, `flexWrap` על `rowSx` (שורת ספרינט) ועל שורת "הצג/הסתר ספרינטים סגורים", ותאריכי
      התחלה/סיום ביצירת ספרינט עוברים לטור יחיד מתחת ל-`sm` (היו `1fr 1fr` קבוע).
- [x] `src/features/teams/components/team-list-web/team-card.tsx` — `flexWrap`+`minWidth:0` על שורת שם-
      צוות/מיקום-משרד, שורת אישור-ממתין/ביטול, ושורת כותרת-חברים/כפתור-הוספה.
- [x] `src/features/teams/components/team-list-web/index.tsx` — נבדק, טור יחיד; לא נדרש שינוי.
- [x] `src/features/dashboard/components/dashboard-web.tsx` — נבדק, בנוי על `Page`/`PageHeader` שכבר
      תוקנו; לא נדרש שינוי נוסף.

**Native (אותו סדר, אותה בעיה עקרונית):** בניגוד ל-web, ב-native "מסך צר" הוא לא תרחיש-קצה שתלוי ברוחב
דפדפן — האפליקציה **תמיד** רצה ברוחב טלפון, וברירת המחדל של RN flexbox היא `flexShrink:0` (לא `1` כמו ב-CSS
web) — כלומר בלי `flexWrap`/`flexShrink:1` מפורש, שני איברים בשורה שלא נכנסים יחד פשוט **נגלשים מחוץ למסך**
במקום להידחס. זו הסיבה שהתיקון כאן הוא הוספת `flexWrap`+`flexShrink:1` נקודתית, לא ברייקפוינט.

- [x] `pending-approval-card.tsx` — `flexWrap` על שורת שם-הצוות/badge (+`flexShrink:1` לשם) ועל שורת הכפתורים.
- [x] `pending-membership-card.tsx` — `flexWrap` על שורת הכפתורים (הכותרת עצמה בשורה נפרדת, לא היה סיכון).
- [x] `add-member-form.tsx` — נבדק, כבר יש `flexWrap` על שורת הצ'יפים; לא נדרש שינוי.
- [x] `team-member-row.tsx` — השורה הראשית כבר הייתה עם `flexWrap`+`flexShrink` (בניגוד לגרסת ה-web
      שהייתה שבורה), אבל עדיין `justifyContent:'space-between'` על שורה אחת עם שם מול עד 4
      badge/כפתור — אותה בעיית "נראה דחוס גם כשטכנית נכנס" כמו ב-web. פורק לאותן שתי שורות מכוונות
      (שם למעלה, badge/כפתורים למטה) — ראה UI-GUIDELINES §11. גם נוסף `flexWrap` לשורת שמירה/ביטול
      במצב עריכה, ו-`flexWrap`+`flexShrink:1` לשורת "הרשאות מנהל צוות"+מתג. נוסה ובוטל (2026-09-01):
      מיזוג badge "מנהל" לתוך badge התפקיד — נראה מוזר, אותה סיבה כמו ב-web; הוחזר לשני badge נפרדים.
- [x] `invite-links-panel.tsx` — שורת שם-קישור/badge כבר משתמשת ב-`numberOfLines={1}`+`flex:1` (קיצור
      מכוון, לא צריך wrap); נוסף `flexWrap`+`flexShrink:1` לשורת שימושים/כפתורים ולשורת הכפתורים הפנימית
      ולשורת יצירה/ביטול.
- [x] `sprint-list-native.tsx` — `flexWrap`+`flexShrink:1` על שורת כותרת-כרטיס-ספרינט/badge ועל שורת
      כותרת-ראשית/כפתור-פתיחה. שדות תאריך ההתחלה/סיום כבר `flex:1` כל אחד — לא צריך שינוי (זה כבר הדפוס
      הנכון, בשונה מה-`1fr 1fr` הקבוע שהיה ב-web).
- [x] `team-card.tsx` — `flexWrap` על שורת שם-צוות/badge-תפקיד (הכותרת כבר הייתה `flex:1`, זה בסדר),
      `flexWrap`+`flexShrink:1` על שורת אישור-ממתין/ביטול ועל שורת מיקום-משרד.
- [x] `index.tsx` — נבדק, טור יחיד; לא נדרש שינוי.
- [x] `dashboard-native.tsx` — נבדק, כל התוכן ממורכז בטורים עם `maxWidth`/`width:'100%'`, אין שורה אופקית
      עם כמה איברים שיכולה לגלוש; לא נדרש שינוי.

### 11ב. שאר המסכים — done

- [x] `src/features/retro/components/sprint-retro-board-web.tsx` — הלוח עצמו וה-`PageHeader` כבר תוקנו.
      טופס כתיבת הערה כבר `flexDirection:{xs:'column', sm:'row'}` נכון — לא נדרש שינוי. `comment-card-web.tsx`
      קיבל `flexWrap` על שורת שם-מחבר/תאריך.
- [x] `src/features/retro/components/sprint-retro-board-native.tsx` — נמצאה בעיה אמיתית: שורת הכותרת
      (כפתור חזרה + שם-ספרינט/צוות/תאריכים/תיאור) הייתה בלי `flexWrap`/`flexShrink` בכלל — מסך native
      אין לו `PageHeader` משותף כמו web, אז זה נכתב ידנית ופוספס. שם ספרינט ארוך היה גולש מחוץ למסך
      (RN `flexShrink:0` דיפולטיבי). נוסף `flexWrap` לשורה + `flexShrink:1` לאשכול הכותרת. גם
      `flexWrap`+`flexShrink:1` לשורת מחבר/תאריך בכרטיס הערה, ו-`flexWrap` לשורת אנונימי/פרסום.
      `comment-filter-bar-native.tsx` כבר `flex:1` על שדה החיפוש — לא נדרש שינוי.
- [x] `src/features/auth/components/auth-form-web.tsx` — נבדק, שדה שם-פרטי/משפחה כבר `flex:1` כל אחד;
      לא נדרש שינוי.
- [x] `src/features/auth/components/auth-form-native.tsx` — נבדק, שדות בטור מלא (לא זה-לצד-זה כמו ב-web),
      שורת צ'יפים כבר `flexWrap`; לא נדרש שינוי.
- [x] `src/features/auth/components/role-selector-chips.tsx` — נבדק, כבר `flexWrap`; לא נדרש שינוי.
- [x] `src/app/settings.tsx` + `features/settings/components/*` — הומר בפרק 9; נבדק חזותית ב-~500px
      (מגבלת סביבת הפיתוח, לא 375px אמיתי) ונראה תקין: `PageHeader` עוטף, כרטיסים בטור יחיד,
      `CreateTeamForm` מלא-רוחב.
- [x] `src/app/invite/[token].tsx` — נבדק, אין אף `flexDirection:'row'` בקובץ כולו — הכל טורים ממורכזים;
      לא נדרש שינוי.

## לא בטיפול הבאקלוג הזה

- שימוש ב-`Spacing` מ-`constants/theme.ts` (במקום `t.space`) בכמה `*.styles.ts` וקומפוננטות native — לא
  צבע/מצב-כהה אז לא באותה דחיפות, אבל אותה עבירה על כלל 1 ב-UI-GUIDELINES. להוסיף כפרק נפרד אם רוצים.
- `row-reverse` ברכיבי native (`team-list-native/*`, `sprint-list-native.tsx`, `sprint-retro-board-native.tsx`
  וכו') — סעיף 5 אוסר בלי סייג native, אבל לא ברור אם יש שם סיבה אמיתית ב-RN. דורש בדיקה נפרדת לפני שינוי
  גורף.

## Not covered by this backlog

`src/components/ui/*` is web-only today (built on MUI). Native equivalents (`*.native.tsx` per
`UI-GUIDELINES.md` §9) don't exist yet — none of the native items above can actually consume the shared
primitives until those are built. Add "build native `ui/` primitives" as its own task before starting
section 2's native rows in earnest, or have each native conversion keep using `StyleSheet`/`nativeStyles`
+ `useTheme()` tokens directly (no shared native widgets yet) — check with the user which they'd prefer
before the first native conversion.
