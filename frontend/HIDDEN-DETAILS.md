# דברים קטנים שקל לא לשים לב אליהם

תיעוד של קיצורי דרך/פרטים קטנים באפליקציה שלא מוסברים בשום מקום ב-UI עצמו — כדי שלא יישכחו
ולא ייתקלו בהם כ"למה זה ככה?" בעתיד.

## לחיצה כפולה על "ראשי" בניווט — קופצת החוצה מספרינט (Web)

לחיצה כפולה (double-click) על טאב "ראשי" בסרגל הניווט העליון (web) מחזירה מיד לרשימת
הצוותים בדשבורד, גם כשנמצאים עמוק בתוך לוח רטרו של ספרינט מסוים.

**למה זה נחוץ בכלל:** לוח הרטרו נפתח כ-state מקומי בתוך `DashboardWeb`
(`activeView === 'retro'`), לא כ-route נפרד — כך שלחיצה רגילה על "ראשי" בזמן שכבר נמצאים
ב-`/` לא "מנווטת" לשום מקום ולא עושה כלום. לחיצה כפולה מפעילה סיגנל ייעודי
(`src/features/dashboard/home-signal.ts`) שה-`DashboardWeb` מאזין לו ומאפס את ה-state בעצמו.

**מימוש:** `home-signal.ts` הוא pub-sub זעיר; `app-tabs.web.tsx`'s `TabButton` (רק המופע של
"ראשי") מקבל `onDoubleClick={triggerGoHome}` שמוצמד ל-`div` הפנימי (DOM `ondblclick` רגיל —
אין טיימר/threshold ידני); `DashboardWeb` נרשם ל-`subscribeGoHome` ב-`useEffect` ומאפס
`activeView`/`selectedSprint`/`selectedTeam` ומרענן את רשימת הצוותים.

**Web בלבד.** בנייטיב הטאב-בר (`app-tabs.tsx`) הוא `NativeTabs` — קומפוננטת OS ילידית
(`expo-router/unstable-native-tabs`) שלא חושפת event handlers מותאמים-אישית על ה-trigger, אז
אותו טריק לא ניתן ליישום שם בלי לוותר על ה-tab bar הילידי. אם ירצו את זה גם בנייטיב, יצטרכו
מנגנון אחר (למשל double-tap ידני על ה-Home tab item, אם/כשה-API יאפשר גישה לאירועי לחיצה).
