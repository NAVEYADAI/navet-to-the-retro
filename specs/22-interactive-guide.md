# 22 — מדריך אינטראקטיבי "כפתור כפתור"

מקור: `frontend/src/features/onboarding/guide/` + `frontend/src/components/ui/guide-anchor.tsx`; Backend: `backend/src/onboarding/` (`guideAutoStart`, `hints.endedSprintId`, `POST /onboarding/guide-started`), `UserOnboardingState.guideAutoStartedAt`. החלטות מוצר: `product-backlog/22-interactive-guide.md` §22.0. תקציר ה-API: `specs/21-onboarding.md` §2.

## 1. איך זה עובד

- **תסריט = נתונים** (`guide-script-basic.ts`, `guide-script-advanced.ts`): כל צעד `{ id, audience, platforms?, route?, anchor?, demo?, advanceOn, requires? }`. הטקסטים ב-`Strings.onboarding.guide.steps[id]`. `guide-script.ts::filterSteps` משאיר רק צעדים שמתאימים למשתמש (`audience`), לפלטפורמה ולנתונים (`requires`), לפי `buildGuideContext(status)`.
- **עוגן** (`<GuideAnchor name="…">` מ-`components/ui/guide-anchor.tsx`): web — `div data-tour` עם `display: contents` (אין תיבה, העיצוב לא משתנה; המדידה היא איחוד ילדיו); native — `View collapsable={false}` + `measureInWindow`. `Modal` (web) מקבל `guideAnchor` / `guideCloseAnchor`. **שינוי טקסט/עיצוב לא שובר את המדריך; מחיקת עוגן כן** — לכן `guide-script.test.ts` בודק שכל עוגן שבתסריט קיים בקובץ web ובקובץ native.
- **`advanceOn`:** `next` (כפתור "הבא"), `press` (המשתמש לוחץ על האלמנט האמיתי; `GuideAnchor` מדווח לחיצה בתוכו — `onClickCapture` / `onTouchEnd`), `signal` (המסך מדווח שהפעולה קרתה: `emitGuideSignal('comment-posted')` אחרי שליחת הערה בלוח; גם בלוח הדמו). אחרי לחיצה/סיגנל יש הפסקה קצרה (350ms / 900ms) כדי שיראו את התוצאה. בצעדים פעילים אין "הבא", רק "דלג על השלב".
- **ספק** (`guide-provider.tsx`, ב-`app/_layout.tsx` מעל `AppTabs`): קורא `GET /onboarding/status` פעם אחת בעליית האפליקציה (פתיחה אוטומטית + `managedTeamId` לסיור הטקסטואלי), וקריאה טרייה בכל התחלה מהתפריט. לפני כל צעד: מנווט ל-`route` (אם לא שם), ממתין לעוגן עד 5 שניות, ואם לא הופיע — בועה ממורכזת בלי הדגשה + `guide_anchor_missing`. **המצב בזיכרון בלבד**: יציאה/רענון = מתחילים מההתחלה.
- **שכבת הדגשה web** (`guide-overlay-web.tsx`): נרנדרת ב-`document.body` דרך portal (שורש האפליקציה הוא stacking context נפרד שמתחת ל-`Dialog` של MUI, z-index 1300; השכבה ב-1400/1410). ארבעה פאנלים כהים סביב "חור" (כך שהאלמנט האמיתי נשאר לחיץ), טבעת, ובועה. המלבן נמדד בכל frame (`requestAnimationFrame`) ולכן עוקב אחרי גלילה, `AnimatedHeight` ו-`Collapse`; `0.2s ease` (בלי תנועה כש-`prefers-reduced-motion`). `Esc` יוצא (ב-capture, כדי שלא יסגור גם את הדיאלוג שמאחור). מיקום הבועה: `guide-layout.ts::placeBubble` (מתחת, אחרת מעל, אחרת צמוד לתחתית; מיושרת לימין).
- **שכבת הדגשה native** (`guide-overlay-native.tsx`): אותו חוזה; `measureInWindow` כל 150ms, ארבעה `Pressable` כהים סביב החור.
- **לוח דמו** (`guide-demo-board-{web,native}.tsx`): לוח עצמאי בצד הלקוח (לא הרכיב האמיתי של הלוח), עם תווית "דוגמה", מופיע כשאין ספרינט פעיל. טופס הכתיבה פעיל: שליחה מוסיפה הערה **מקומית בלבד**, מדווחת סיגנל (וזה מקדם את המדריך), ושום דבר לא נשלח ל-API או נשמר.

## 2. נקודות כניסה

- **web:** כפתור "מדריך" בסרגל העליון (`app-tabs.web.tsx` → `GuideMenu`) עם שלוש אפשרויות: מדריך בסיסי, מדריך מתקדם, סקירת הפיצ'רים (החלון הטקסטואלי של 21).
- **native:** אותו תפריט, בכותרת הדשבורד (ל-`NativeTabs` אין מקום לכפתור).
- **אוטומטי:** `guideAutoStart` → הבסיסי נפתח פעם אחת ל"משתמש חדש" (אין הערה ואין ספרינט). **בסוויטת ה-e2e הפתיחה האוטומטית כבויה** (`playwright.config.ts` מציב `localStorage['guide-auto-start-off']='1'`), אחרת כל spec שרושם משתמש חדש היה נחסם; `interactive-guide.spec.ts` מנקה את זה.

## 3. הבדלים בין פלטפורמות (בכוונה)

- native: צעדי חלון "הוספת חבר" לא קיימים (`add-member-modal`, `add-member-close`), ובמקומם `add-member-native` (הסבר בלי לפתוח) — החלון הוא `Modal` של המערכת ויושב מעל שכבת ההדגשה.
- native: אין צעד "צוות חדש" (יצירת הצוות כבר בדשבורד); `create-team-form` מצביע על הטופס בדשבורד, ב-web על הטופס בהגדרות.
- native: אין גלילה אוטומטית לעוגן; עוגן מחוץ למסך = הבועה הממורכזת.

## 4. מה הצעדים לא עושים

המדריך לא שולח טפסים ולא יוצר ספרינט/צוות/חבר. הדבר היחיד שהוא מבקש מהמשתמש לכתוב הוא **הערה**: בלוח האמיתי זו הערה אמיתית בספרינט הפעיל (לבקשת נוה — "לאלץ אותי לכתוב"); בלוח הדמו היא מקומית.

## 5. אנליטיקה

`guide_started {guide, auto}`, `guide_step_shown`, `guide_step_done {via: click|next|signal}`, `guide_back`, `guide_skipped`, `guide_exited {atStep}`, `guide_completed`, `guide_anchor_missing`, `guide_menu_opened`, `guide_menu_choice`, `guide_demo_comment_posted`.

## 6. Edge cases

- משתמש ללא צוות: מקבל "צוות חדש" → הגדרות → לוח דמו → הערת סיכום → סיום; לא רואה צעדי לוח אמיתי.
- חבר רגיל: בלי `add-member*`, `sprint-new`, `focus-points`.
- פקד מקופל (רשימת החברים) נפתח בצעד קודם שהמשתמש לוחץ עליו; אם נסגר/נפתח מראש העוגן הבא חסר והצעד נהפך להערה ממורכזת.
- `Esc` בזמן שדיאלוג פתוח סוגר את המדריך בלבד.
