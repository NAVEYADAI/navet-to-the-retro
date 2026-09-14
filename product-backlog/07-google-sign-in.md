## פיצ'ר 7: התחברות/הרשמה עם Google (Sign in with Google)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `User.googleId String? @unique` (חדש), `User.password` הופך `String?`, `User.email` מאבד `@unique` (החלטה מוצרית #3 — התנגשות מייל נדחית במפורש), `User.emailVerifiedAt DateTime?` (תוספת §7.4).
- **Backend:** `backend/src/auth/google-login.service.ts` (חדש), `auth.service.ts` (`login` — guard `password===null`, `updateProfile` — read-before-write + collision check + reset `emailVerifiedAt`), `auth.controller.ts` (routes חדשים).
- **Frontend:** `auth-form-web.tsx`/`-native.tsx` (כפתור "המשך עם Google"), `frontend/src/app/auth/google/callback.tsx` (חדש), `_layout.tsx` (`isGoogleCallbackRoute` bypass).
- **Endpoints:** `GET /auth/google/connect`, `GET /auth/google/callback`, `POST /auth/google/exchange`, `POST /auth/google/complete-registration` (חדש, §7.5), `PATCH /auth/profile` (עודכן).
- **חולק Google Cloud OAuth client עם פיצ'ר 6** (ר' שם).
- **השפעה חוצה-פיצ'רים שהתגלתה בביקורת (2026-09-11):** הסרת `@unique` מ-`User.email` חייבה תיקון דטרמיניזם (`orderBy:{id:'asc'}`) גם ב-`teams.service.ts::create` (lookup של `approverEmail`) וגם ב-`AuthService.login` — כל lookup עתידי לפי `email` בקוד הזה חייב לקחת את זה בחשבון.


מטרת הפיצ'ר: להוסיף זרימת "Sign in with Google" מבוססת **Google OAuth אמיתי** **לצד**
ההרשמה/התחברות הקיימת מבוססת-סיסמה (ר' החלטה מוצרית #1 — שני מסלולים שווי-מעמד, לא
החלפה) — כך שמי שבוחר להשתמש ב-Google מקבל כתובת דואר שמוכחת בעלות ע"י Google עצמו, לא
ע"י קישור-מייל שנשלח מהמערכת. משתמש קיים שנרשם עם סיסמה ומתחבר בהמשך עם Google על אותה
כתובת מייל מזוהה אוטומטית ומקושר לאותה שורת `User` קיימת (ר' החלטה מוצרית #2). התנגשות
כתובת מייל בין שני `User` שונים בזמן קישור/הרשמה דרך Google **נדחתה במפורש ולא נפתרת בסבב
הזה** (ר' החלטה מוצרית #3 ו"לא בטיפול" למטה).

**עדכון (2026-09-07): מחליף לגמרי את הגרסה הקודמת של הפיצ'ר הזה, לא מתווסף אליה.** הגרסה
שאופיינה ב-2026-09-06 (קישור אימות שנשלח במייל, בסגנון `TeamInvite`/`EmailVerificationToken`)
**לא מומשה בפועל בשום שורת קוד** — 0 סעיפים מסומנים ב-§7.1/7.2/7.3, אין `emailVerifiedAt`/
`EmailVerificationToken` ב-`schema.prisma`, אין קובץ חדש תחת `backend/src/auth/`. נוה ביקש
במפורש לוותר על הגישה ההיא ולעבור למנגנון זהות מבוסס-Google אמיתי (ר' הבקשה: "אם פיצ'ר
היומן צריך login דרך Google, אז שיהיה כבר ככה וזהו") — ולכן הסעיף הזה נכתב מחדש **במקום**
הישן, כאילו ההחלטות הקודמות מעולם לא נקבעו, לא כתוספת עליהן. **שלוש השאלות הפתוחות שנותרו
מהאיפיון הראשוני נענו ע"י נוה באותו יום** (ר' "החלטות מוצריות (נוה, 2026-09-07)" ב-7.0
למטה) — הפיצ'ר מאופיין במלואו ומוכן למימוש, לא טיוטה.

**ממצא מחקר קריטי לפני כל החלטה אחרת:** אין שום שדה זהות-Google על `User` היום, ואין שום
מנגנון OAuth בזרימת ה-auth הרגילה. `model User` (`backend/prisma/schema.prisma:10-25`)
מכיל `id, username, email (unique), password (String — חובה, לא nullable), firstName?,
lastName?, role, createdAt`. `AuthService.register`/`login`/`validateToken`
(`backend/src/auth/auth.service.ts:13-121`) הם bcrypt+JWT ידני לגמרי (ר' `backend/AGENTS.md`
§"Auth — manual, not Guards"), בלי שום תלות ב-Google. **לעומת זאת, יש כבר תשתית Google OAuth
מלאה ועובדת בקוד** — פיצ'ר 6 (`backend/src/google-calendar/`) — אבל היא בנויה לזרימה שונה
לגמרי במהותה: "חבר את היומן שלך לחשבון קיים שכבר מחובר" (`connect`/`callback` שם דורשים
`state` שכבר נושא `userId` של משתמש **שכבר עבר** `validateToken`), לא "התחבר/הירשם דרך
Google" (שבו אין עדיין `userId` בכלל בזמן ה-redirect). זו נקודת המוצא הקריטית: אי אפשר
"פשוט לקרוא" ל-`GoogleCalendarService` הקיים בשביל login — צריך זרימת OAuth שנייה, נפרדת
במטרתה (אבל בהשראה ישירה מהמימוש הקיים), ר' ברירת מחדל טכנית #1.

### 7.0 החלטות

**ברירות מחדל טכניות (לא דורשות אישור נוה):**

1. **לשכפל את דפוס ה-OAuth הקיים של פיצ'ר 6, לא ליצור Google Cloud project/client שני.**
   `google-calendar.service.ts` (שורות 60-123) כבר מדגים את כל מה שנדרש: בניית
   `google.auth.OAuth2(clientId, clientSecret, redirectUri)`, `generateAuthUrl({scope,
   state,...})`, `client.getToken(code)` להחלפת code בטוקנים, ו-
   `google.oauth2({auth:client, version:'v2'}).userinfo.get()` לשליפת `{email, sub,
   given_name, family_name}`. הזרימה החדשה ("login") **משתמשת באותם
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`** מ-infisical (כבר קיימים, נוה כבר יצר אותם
   לפיצ'ר 6 ואינו מעוניין ליצור client שני) — אבל עם **scope צר יותר** (`openid email
   profile` בלבד, **בלי** `calendar.events`), ו**בלי** `access_type:'offline'`/
   `prompt:'consent'` (אין צורך ברענון-טוקן מתמשך ל-login — כל login מייצר זרימת OAuth
   טרייה משלו; זה שונה מהותית מ-Feature 6, ששם ה-refresh token נדרש כדי ליצור אירועי יומן
   הרבה אחרי שהמשתמש כבר לא מול המסך). **דרוש צעד ידני קטן מנוה:** להוסיף Authorized
   redirect URI **נוסף** (למשל `.../auth/google/callback`, לצד `.../google-calendar/callback`
   הקיים) לאותו client הקיים ב-Google Cloud Console — **לא** ליצור project/client חדש. משתנה
   סביבה חדש: `GOOGLE_LOGIN_REDIRECT_URI`.
2. **קובץ/service חדש בתוך מודול `auth` הקיים, לא הרחבת `GoogleCalendarService` ולא מודול
   שלישי.** `GoogleCalendarModule` **כבר מייבא** את `AuthModule` (כדי לקרוא ל-
   `AuthService.validateToken`, ר' `google-calendar.module.ts` שורה 5+8) — אם `AuthModule`
   היה מייבא בחזרה את `GoogleCalendarModule` כדי להשתמש בלוגיקת ה-OAuth שלו, זה ייצור
   circular dependency בין המודולים. הפתרון הנקי: קובץ עצמאי חדש
   `backend/src/auth/google-login.service.ts` (רשום כ-provider על `AuthModule` עצמו), עם
   כפילות מכוונת וקטנה של בניית ה-`OAuth2` client (כ-10 שורות) — לא שיתוף instance עם
   `GoogleCalendarService`. עקבי עם `backend/AGENTS.md`: "one NestJS module per domain".
3. **שדה זהות חדש על `User`: `googleId String? @unique`** (Google `sub` מ-`userinfo.get()`)
   — לא להסתמך על השוואת `email` בלבד לזיהוי "אותו משתמש חוזר", כי `email` יכול תיאורטית
   להשתנות והשוואות מייל בקוד הזה כבר תועדו כבאג-קייס (`specs/02-teams-and-approval.md`
   §9.1 — `approverEmail` lookup לא case-insensitive). כל השוואת email חדשה בפיצ'ר הזה
   (בין email מ-Google ל-`User.email` קיים) **חייבת** להיות מפורשת case-insensitive
   (`mode:'insensitive'` ב-Prisma, לא לחזור על אותו באג).
4. **`User.password` הופך `String?` (nullable).** משתמש שנוצר ישירות דרך Google (בלי סיסמה
   בכלל) חייב להיות מיוצג עם `password: null` ולא סיסמה מזויפת. עקבי עם החלטה מוצרית #1
   (סיסמה נשארת לצמיתות כמסלול מקביל שווה-מעמד) — זהו מצב-קבע דו-מסלולי, לא שלב-מעבר. יש
   להוסיף גם
   הגנה מפורשת ב-`AuthService.login` (זרימת username/סיסמה הקיימת): אם `user.password ===
   null`, להחזיר שגיאה ברורה ("חשבון זה מחובר רק דרך Google") **במקום** לתת ל-
   `bcrypt.compare(dto.password, null)` להתפוצץ (bcryptjs זורק על hash לא-string).
5. **"Ticket" חתום קצר-טווח בחזרה מ-Google, לא ה-JWT האמיתי ב-URL.** `handleCallback`
   מחזיר את המשתמש/מנפיק JWT אמיתי (12h) בצד השרת — אבל שיטת ה-redirect בקוד הזה חושפת
   את ה-query string בהיסטוריית דפדפן/referrer. יש כבר תקדים מדויק לזה בקוד:
   `GoogleCalendarService.getAuthUrl` (שורה 68) חותם `state` כ-JWT קצר-טווח
   (`expiresIn:'10m'`) עם אותו `JWT_SECRET`, רק כדי לשאת מידע דרך redirect בלי לחשוף session
   token אמיתי. אותו רעיון בכיוון ההפוך: ה-callback מפנה ל-
   `${FRONTEND_URL}/auth/google/callback?ticket=<jwt חתום, expiresIn:'2m'>`, וה-frontend
   מיד קורא ל-`POST /auth/google/exchange {ticket}` שמאמת את החתימה/תוקף ומחזיר
   `{accessToken, user}` — **אותה** צורת תשובה בדיוק כמו `register`/`login` הקיימים, כך
   ש-`auth-context.tsx::login(token, user)` לא צריך שום שינוי.
6. **נתיב frontend חדש עוקף את ה-auth gate, באותה שיטה כמו `isInviteRoute`.** `_layout.tsx`
   (שורות 28-69) כבר מדגים בדיוק את התבנית הנדרשת: `isInviteRoute` (שורה 32) בודק
   `pathname?.startsWith('/invite/')` ומחזיר `<Slot/>` לפני בדיקת ה-`!token`. עמוד callback
   חדש (`/auth/google/callback`) צריך אותו בייפאס בדיוק, מאותה סיבה (עמוד שצריך לפעול
   **לפני** שיש `token` בקונטקסט).
7. **`googleapis` כבר מותקן** (`backend/package.json`, `"googleapis": "^178.0.0"`, הותקן
   בפיצ'ר 6) — **אין תלות חדשה להתקין** לצורך הפיצ'ר הזה.

**החלטות מוצריות (נוה, 2026-09-07):**

1. **סיסמה נשארת — שני מסלולים שווי-מעמד לצמיתות, לא החלפה.** Google-login מתווסף **לצד**
   ה-username/password הקיים, לא מחליף אותו. `POST /auth/register`/`login` נשארים
   endpoints חיים ללא שינוי; `AuthFormWeb`/`AuthFormNative` שומרים על שדות הסיסמה כמו
   שהם, עם כפתור "המשך עם Google" כאפשרות נוספת. ברירת מחדל טכנית #4 (`User.password`
   nullable) היא **מצב-קבע דו-מסלולי לצמיתות** — יש וימשיכו להיות משתמשים עם סיסמה ומשתמשים
   בלי (Google-only), שניהם לגיטימיים ושווי-מעמד, לא שלב-מעבר זמני לקראת הסרת הסיסמה.
2. **זיהוי/קישור אוטומטי לפי התאמת email — בלי "ותיק מול חדש".** משתמש קיים שנרשם עם
   סיסמה, וכעת מתחבר עם Google על אותה כתובת מייל (case-insensitive — ר' ברירת מחדל טכנית
   #3), **מזוהה אוטומטית** ע"י הבקאנד כ"קישור" לשורת ה-`User` הקיימת שלו (`googleId`
   נשמר על אותה שורה, **לא** נוצר משתמש שני). **אין** אבחנה בין "ותיק"/"חדש" ו**אין**
   מנגנון אכיפה/feature-gating נלווה — הרעיון של `EMAIL_VERIFICATION_ENFORCED_FROM` מהטיוטה
   הקודמת **נזנח לגמרי, לא רלוונטי יותר לפיצ'ר הזה**. משתמש שאין לו חשבון Google בכלל
   ממשיך להשתמש בסיסמה בלבד **לצמיתות**, בלי חסימה/גייטינג/prompt כלשהו — עקבי עם החלטה #1
   (שני המסלולים שווי-מעמד, לא "מסלול ראשי Google + מסלול-נחות סיסמה").
3. **התנגשות כתובת מייל בין שני `User` — נדחה במפורש, לא נפתר בסבב הזה.** אם מישהו
   מתחבר עם Google וכתובת המייל שחוזרת מ-Google כבר קיימת על שורת `User` **אחרת** שלא
   קושרה ל-`googleId` (משתמש-סיסמה שנרשם קודם עם אותה כתובת, בלי שהוכיח בעלות עליה) —
   ה-**קישור/יצירה עדיין מתאפשרים בפועל**, גם אם המשמעות היא ששתי שורות `User` יכולות
   להחזיק זמנית באותה כתובת `email` (כלומר יש להסיר/להרפות בפועל את האילוץ `@unique` על
   `User.email`, ר' 7.1, כדי שזה לא יקרוס). **מי "מנצח" את הכתובת, האם הצד השני מקבל
   התראה, ומה קורה לצד שאיבד את הבלעדיות על הכתובת שלו — כל זה נשאר עדיין לא-מוגדר
   במפורש ודורש טיפול עתידי נפרד** (ר' "לא בטיפול" למטה) — **חובה** להשאיר הערת קוד
   מפורשת (comment) בנקודת ה-`handleCallback` הרלוונטית שמסמנת את זה כ-edge case ידוע
   ולא-פתור, לא לתקן/להעלים את זה בשקט.

### ממצאי מחקר

- **`User` (`schema.prisma:10-25`) — אין `googleId`, `password` חובה (לא nullable), `email`
  כרגע `@unique`.** הוספת `googleId`/הפיכת `password` ל-nullable (ברירות מחדל #3/#4) הן
  שינוי תוסף-גרידא רגיל; **הסרת/הרפיית ה-`@unique` על `email`** (נדרש ע"י החלטה מוצרית #3)
  היא שינוי משמעותי יותר — לא backfill מסוכן כמו פיצ'ר 3, אבל כן שינוי אילוץ שכדאי להריץ
  ולבדוק היטב מול `postgres-test` לפני כל מחשבה על Neon (`db push` בטוח מול
  `postgres-test`; **לא** מול Neon בלי אישור מפורש, per `backend/AGENTS.md` §Database).
- **`AuthService`** (`auth.service.ts:1-122`): `register` (13-52) בודק ייחודיות
  `username`/`email` (`OR`, לא lowercased — אותו דפוס-סיכון שכבר תועד ב-
  `specs/02-teams-and-approval.md` §9.1), יוצר `User` עם סיסמה מוצפנת, מנפיק JWT מיד.
  `login` (54-84) — bcrypt compare + JWT זהה. `validateToken` (86-107) — נקודת האכיפה
  היחידה בכל controller (`backend/AGENTS.md` §"Auth — manual, not Guards"), עם הבאג המתועד
  ב-`specs/00-shared-conventions.md` §3.1 (`'User not found'` תמיד יוצא כ-`'Invalid
  token'`) — לא לגעת בזה, ולא לבנות עליו הנחות. `updateProfile` (109-121, **נכון בזמן
  שהמחקר הזה נכתב, לפני המימוש**) כתב במקור `email` בלי שום בדיקת ייחודיות/שינוי-בפועל —
  **תוקן בפועל ב-§7.4 למטה** (read-before-write + collision check + reset ל-`emailVerifiedAt`
  רק על שינוי אמיתי). `specs/00-shared-conventions.md` עודכן בהתאם ואינו מתעד את זה יותר
  כ-Bug candidate — פסקה זו נשארת כתיעוד-מחקר היסטורי, לא כתיאור המצב הנוכחי.
- **`GoogleCalendarService`/`Controller`** (`backend/src/google-calendar/*.ts`) — התבנית
  המדויקת ביותר בקוד ל-OAuth2 מול Google: בניית client (שורות 60-62), `getAuthUrl` חותם
  `state` כ-JWT (שורות 65-75, `access_type:'offline', prompt:'consent',
  scope:[CALENDAR_SCOPE]`), `handleCallback` (88-123) מאמת `state`, מחליף `code` בטוקנים,
  שולף `userinfo.get()` לכתובת מייל. **הבדל מהותי לזרימת login:** שם ה-`state` **כבר**
  נושא `userId` (המשתמש כבר מחובר ומבקש "לחבר יומן"), וה-endpoint `connect`
  (`google-calendar.controller.ts:23-28`) **דורש** `validateToken` לפני יצירת ה-authUrl.
  בזרימת login **אין עדיין `userId`** בשלב הזה — ה-`state` כאן הוא רק nonce נגד CSRF, לא
  נשא-זהות, וה-endpoint המקביל (`GET /auth/google/connect`) חייב להיות **ציבורי** (לפני
  שיש בכלל session).
- **`googleapis@178.0.0` כבר תלות מותקנת** (`backend/package.json:29`) — הותקנה עבור
  פיצ'ר 6, אין צורך בהתקנה נוספת.
- **`AuthModule`/`GoogleCalendarModule`** (`backend/src/auth/auth.module.ts`,
  `backend/src/google-calendar/google-calendar.module.ts`): `GoogleCalendarModule` כבר
  מייבא את `AuthModule` (שורה 5+8 ב-module השני) כדי לגשת ל-`AuthService`. ייבוא הפוך
  (`AuthModule` מייבא בחזרה את `GoogleCalendarModule`) ייצור circular dependency — ר'
  ברירת מחדל טכנית #2 לפתרון (קובץ עצמאי בתוך `auth`, לא שיתוף מודול).
- **`invites.service.ts`** (`backend/src/invites/`) — עדיין הדוגמה הכי מדויקת בקוד ל-token
  חד-פעמי עם `reasonForInvalidity()` (שורות 25-30) ולפיצול `GET` (בדיקה, ציבורי) מול
  `POST .../consume` (מבצע, שורות 84-100 ו-133-178) — **לא נדרש** לפיצ'ר הזה בפועל: לפי
  החלטה מוצרית #2, הקישור בין חשבון Google ל-`User` קיים נעשה אוטומטית בזמן ה-`callback`
  עצמו (התאמת email), בלי שלב-ביניים מבוסס-טוקן/קישור נפרד. שים לב גם ל-`consumeInvite`
  שורה 144 (`invite.email.toLowerCase() !==
  user.email.toLowerCase()`) — תבנית ההשוואה הנכונה (case-insensitive) לחקות בכל השוואת
  email חדשה כאן, בניגוד לבאג ב-`teams.service.ts`.
- **Frontend auth**: `frontend/src/features/auth/components/auth-form-web.tsx` (ומקבילת
  `auth-form-native.tsx`) שולחים `axios.post(.../auth/${endpoint})` ישירות (בלי client
  מרכזי, per `specs/00-shared-conventions.md` §5) ומריצים `login(token, user)` מ-
  `useAuth()` בהצלחה — **כל** תוספת Google-login חייבת לייצר בדיוק את אותה צורת תשובה
  (`{accessToken, user}`) כדי להיכנס לזרימה הקיימת בלי שינוי ב-`auth-context.tsx`
  (`frontend/src/context/auth-context.tsx:94-99`, `login()` לא בודק מקור הטוקן).
- **`_layout.tsx`** (`frontend/src/app/_layout.tsx:28-69`): `isInviteRoute` (שורה 32) הוא
  הדוגמה החיה ל"נתיב שצריך לעקוף את ה-auth gate" — ר' ברירת מחדל טכנית #6.
- **אין עדיין UI Google בפרונט בכלל (נכון לזמן שהמחקר הזה נכתב — לפני שפיצ'ר 6 מומש).**
  `frontend/src/features/settings/` באותו זמן לא כלל כרטיס "חיבור יומן Google". **מאז
  (2026-09-11) פיצ'ר 6 §6.2 מומש** — יש כרטיס `GoogleCalendarCard` בהגדרות. עדיין נכון
  שהכפתור הראשון-מסוגו בקוד בפועל היה זה שהפיצ'ר הזה (7) בנה בטופס ההתחברות/הרשמה —
  §6.2 הגיע אחרי, ואף השתמש באותה החלטת-עיצוב (`variant="secondary"`) שכבר נקבעה כאן.
- **OAuth על native (לא web) לא נחקר/נפתר בקוד הקיים בכלל** — פיצ'ר 6 (יומן) גם הוא רק
  backend כרגע; אין תקדים בקוד ל"פתיחת דף Google consent screen ממסך native וחזרה
  לאפליקציה" (deep link / `expo-web-browser` / custom scheme). זה כנראה ידרוש מחקר טכני
  נוסף בזמן המימוש, לא רק החלטת מוצר — ר' 7.2.

### 7.1 Backend

- [x] `schema.prisma`: `User.password` → `String?`; שדה חדש `User.googleId String? @unique`.
      בוצע (`backend/prisma/schema.prisma`), בלי `emailVerifiedAt`/שדה "אימות" נפרד כפי
      שהוחלט.
- [x] **החלטה מוצרית #3 (התנגשות email בין שני `User`):** האילוץ `@unique` על `User.email`
      הוסר לגמרי ב-`schema.prisma` (נשאר `String` רגיל). נבדק ש-`AuthService.register`/`login`
      כבר משתמשים ב-`findFirst`/`OR` (לא `findUnique` על `email` לבד) — לא נשברו.
- [x] `npx prisma db push --accept-data-loss` רץ מול `postgres-test` בלבד (Docker הופעל
      במיוחד לצורך זה בסבב הזה — היה כבוי בתחילת הריצה). **לא רץ מול Neon dev/prod** —
      דורש אישור מפורש של נוה לפני כן (ר' דיווח למטה).
- [x] קובץ חדש `backend/src/auth/google-login.service.ts` — `GoogleLoginService` כ-provider
      על `AuthModule` (לא `GoogleCalendarModule`), עם כפילות מכוונת של בניית `OAuth2` client;
      `getAuthUrl()` עם `scope:['openid','email','profile']` בלבד, בלי `access_type`/`prompt`,
      `state` הוא JWT קצר-טווח (`expiresIn:'10m'`) בלי `userId` בפנים.
- [x] `GoogleLoginService.handleCallback(code, state)` מומש: מאתר לפי `googleId` קודם, אז
      לפי `email` case-insensitive (`mode:'insensitive'`) לקישור אוטומטי, אחרת יוצר `User`
      חדש (`password:null`, `username` נגזר מ-local-part עם suffix מספרי בהתנגשות). **הערת
      הקוד החובה על edge case ה-email-collision קיימת** ב-`google-login.service.ts` בתוך
      `findOrCreateUser` (המדיניות שנבחרה למימוש הזה: אם ה-`User` שנמצא לפי email כבר קשור
      ל-`googleId` אחר, לא דורסים אותו ולא יוצרים כפילות — פשוט ממשיכים איתו, בלי לקבוע מי
      "מנצח").
- [x] "Ticket" קצר-טווח (`expiresIn:'2m'`, נושא רק `userId`) מוחזר מ-`handleCallback` ומצורף
      ל-redirect; `POST /auth/google/exchange {ticket}` (ב-`auth.controller.ts`, ציבורי)
      מאמת ומחזיר `{accessToken, user}` באותה צורה בדיוק כמו `register`/`login`.
- [x] `GET /auth/google/connect` — ציבורי, מחזיר `{authUrl}`. בוצע ב-`auth.controller.ts`.
- [x] `GET /auth/google/callback` — ציבורי, קורא ל-`handleCallback`, מפנה ל-
      `${FRONTEND_URL}/auth/google/callback?ticket=...` או `?error=1`. בוצע.
- [x] `AuthService.login`: guard מפורש `if (user.password === null)` עם שגיאה ברורה,
      **לפני** `bcrypt.compare` — נוסף ב-`auth.service.ts`.
- [x] `POST /auth/register`/`login` נשארו ללא שינוי מבני — רק ה-guard החדש התווסף ל-`login`;
      אין מנגנון אכיפה/גייטינג חדש.

### 7.2 Frontend

- [x] `AuthFormWeb`/`AuthFormNative` (`frontend/src/features/auth/components/`): כפתור
      חדש "המשך עם Google" — קורא ל-`GET /auth/google/connect` (ציבורי, בלי טוקן) ואז
      `window.location.href = authUrl` (web). **ב-native**, מומש best-effort עם
      `expo-web-browser`'s `openAuthSessionAsync(authUrl, redirectUrl)` (התלות כבר קיימת
      ב-`package.json`, בשימוש גם ב-`external-link.tsx`): אם ה-OS מצליח להחזיר את הבקרה
      לאפליקציה (`result.type==='success'`) עם `ticket`/`error` ב-URL, ההתחברות מושלמת
      בתוך הקריאה עצמה בלי לעבור דרך מסך ה-callback. **הבהרה מפורשת**: אין באפליקציה היום
      תשתית deep-link/universal-link (`app.json` scheme קיים אבל לא מקושר לדומיין ה-callback
      ב-HTTPS), כך שההצלחה בפועל של המסלול הזה על מכשיר אמיתי **לא נבדקה** ותלויה בהתנהגות
      ה-OS/דפדפן שלא ניתן לאמת בסביבת הפיתוח הזו — עקבי עם הסימון "לא בטיפול" למטה שהמחקר
      הטכני המלא ל-native נשאר פתוח.
- [x] עמוד חדש `frontend/src/app/auth/google/callback.tsx` — קורא `ticket`/`error` מ-query
      params, שולח `POST /auth/google/exchange`, ואז `login(token, user)` מ-`useAuth()`,
      ומפנה הביתה (`window.location.href='/'` ב-web, `router.replace('/')` ב-native, אותה
      טכניקה כמו `invite/[token].tsx`). מצב שגיאה (`?error=1` או exchange כושל) מציג כותרת+
      הודעה ברורה וכפתור חזרה למסך ההתחברות — לא מסך ריק.
- [x] `_layout.tsx`: bypass חדש (`isGoogleCallbackRoute`) לנתיב `/auth/google/callback`, על
      תבנית `isInviteRoute` הקיימת (ברירת מחדל טכנית #6).
- [x] `AuthFormWeb`/`AuthFormNative`: שדות הסיסמה/הרשמה הקיימים נשארו ללא שינוי (החלטה
      מוצרית #1) — כפתור "המשך עם Google" נוסף **לצד** הטופס הקיים, מתחת אליו, עם קו מפריד
      "או" (secondary/ghost, לא primary — נשאר כפתור primary יחיד למסך).
- [x] אין נבנתה UI ל"אימות"/חסימה/gating של משתמשים ותיקים — לפי החלטה מוצרית #2.
- [x] אין נבנתה UI לתרחיש "התנגשות כתובת" — נדחה במפורש (החלטה מוצרית #3).
- [x] `trackEvent()` נוסף על כפתור "המשך עם Google" (web+native), על טעינת עמוד ה-callback,
      ועל תוצאות ההתחברות (הצלחה/כישלון) וכפתור החזרה במסך השגיאה.
- [x] מחרוזות חדשות נוספו ל-`Strings.auth.*` (לא קובץ נפרד): `orDividerText`,
      `continueWithGoogleButton`, `googleConnectError`, `googleCallbackLoadingText`,
      `googleCallbackErrorTitle`, `googleCallbackErrorText`, `googleCallbackBackButton`.

### 7.3 בדיקות

- [ ] Jest ל-`GoogleLoginService`: `googleapis` ממוקק לחלוטין (כמו
      `google-calendar.service.spec.ts` הקיים) — `getAuthUrl` מייצר scope/state נכונים
      (בלי `access_type:'offline'`); `handleCallback` עם משתמש Google חדש (אין `googleId`
      ואין `email` תואם) יוצר `User` נכון (`password:null`, `googleId`, `username` נגזר);
      `handleCallback` עם `googleId` קיים מאתר ומחזיר את אותו משתמש (לא יוצר שני); ticket
      מאומת/פג-תוקף מתנהג נכון ב-`exchange`.
- [ ] Jest ל-`GoogleLoginService.handleCallback` — **קישור אוטומטי (החלטה מוצרית #2):**
      `email` (case-insensitive) תואם ל-`User` קיים עם סיסמה **בלי** `googleId` → מעדכן את
      אותה שורה עם `googleId` החדש (לא יוצר `User` שני), ומנפיק JWT לאותה שורה; לוודא גם
      שהמשתמש הזה עדיין יכול להתחבר אח"כ עם הסיסמה הישנה שלו ללא שינוי (שני מסלולים
      שווי-מעמד על אותה שורה).
- [ ] Jest ל-`AuthService.login`: משתמש עם `password:null` מקבל שגיאה ברורה (לא קריסת
      bcrypt) בניסיון login עם סיסמה; משתמש עם סיסמה קיימת (כולל כזה שקושר גם ל-Google,
      לפי הפריט הקודם) ממשיך להתחבר עם הסיסמה כרגיל, ללא שינוי התנהגות.
- [ ] Jest ל-`handleCallback` — **התנגשות email (החלטה מוצרית #3, edge case מוכר ולא-פתור):**
      `email` תואם ל-`User` קיים ששייך למישהו אחר (`googleId` שונה, או `User` נוסף שכבר
      מחזיק אותה כתובת) — לוודא שהפעולה **לא קורסת/לא נחסמת** (מתאפשר קישור/יצירה בפועל,
      גם במחיר של שתי שורות `User` עם אותו `email`), ושה-**הערת הקוד** הנדרשת (ר' 7.1) אכן
      קיימת בנקודה הזו. **לא** לכתוב טסט שמצפה לפתרון-קונפליקט "נכון" כלשהו — הבדיקה כאן
      היא רק "לא קורס, וההתנהגות-הלא-מוגדרת מתועדת", לא "בוחר במנצח הנכון".
- [ ] Playwright e2e — הרשמה חדשה עם Google: **אין דרך לבצע OAuth אמיתי מול Google בסביבת
      e2e מבודדת** (אותה בעיה שכבר תועדה בפיצ'ר 6 §6.3) — יש להחליט על אסטרטגיית stub
      (mock server לענות על ה-callback, או מוקינג ברמת ה-service) לפני כתיבת התרחיש; לא
      להעתיק פתרון מ-6.3 בלי לוודא שהוא מתאים גם כאן (שם זו פעולה משנית על משתמש-כבר-מחובר,
      כאן זו זרימת ה-login הראשית עצמה).
- [ ] Playwright e2e — קישור אוטומטי: משתמש שנוצר מראש ב-DB של סביבת הטסט עם סיסמה (בלי
      `googleId`) "מתחבר עם Google" (דרך אותה אסטרטגיית stub) על אותה כתובת מייל בדיוק →
      מגיע לדשבורד הרגיל (לא נוצר משתמש כפול) → מתנתק ומתחבר שוב עם username/סיסמה הרגילים
      → מצליח, ללא שינוי בהתנהגות מסלול הסיסמה.
- [ ] בדיקת מובייל — `Mobile Chrome` project ב-Playwright, עקבי עם שאר הפיצ'רים בבאקלוג
      (בכפוף לפתרון שיימצא ל-OAuth native, ר' 7.2).

### 7.4 תוספת (2026-09-11): תיעוד אימות אימייל + הגנה על שינוי אימייל בפרופיל

תוספת קטנה על גבי §7.1 שכבר מומש — לא שינוי בהחלטות המוצריות של §7.0. נוה גילה בבדיקה
בפועל: (א) קישור אוטומטי דרך Google לא תיעד בשום מקום ב-DB שהמייל הוכח, (ב) שדה עריכת מייל
הקיים בפרופיל (`PATCH /auth/profile`) כתב מייל בלי שום בדיקת ייחודיות מול משתמש אחר. שני
חלקים נפרדים במכוון — **לא** קשור/לא פותח מחדש את החלטה מוצרית #3 (התנגשות מייל כשמתחברים
עם Google) — ר' "לא בטיפול (7.4)" למטה.

- [x] `User.emailVerifiedAt DateTime?` חדש ב-`schema.prisma` (nullable, בלי default) —
      מתעד מתי הוכחה בעלות אמיתית על כתובת המייל (ע"י Google), לא flag אכיפה/חסימה.
- [x] `GoogleLoginService.findOrCreateUser`: מסלול קישור-אוטומטי ומסלול הרשמה חדשה מקבלים
      `emailVerifiedAt: new Date()`; מסלול משתמש-חוזר (`googleId` תואם) לא נוגע בשדה בכלל;
      מסלול ההתנגשות הידוע-ולא-פתור (החלטה מוצרית #3) **לא השתנה** — הערת הקוד הקיימת שם
      נשארה בדיוק כפי שהיא.
- [x] `AuthService.updateProfile`: read-before-write; זיהוי שינוי email אמיתי (trim +
      case-insensitive, לא "האם השדה נשלח" — הפרונט הקיים תמיד שולח את המייל הנוכחי); בדיקת
      התנגשות מול משתמש/ת אחר/ת (`ConflictException`, 409) על שינוי אמיתי בלבד; איפוס
      `emailVerifiedAt` ל-null רק על שינוי אמיתי ולא-מתנגש; `googleId` לא נוגעים בו בכלל.
- [x] Jest: `google-login.service.spec.ts` (auto-link/הרשמה-חדשה מגדירים `emailVerifiedAt`,
      משתמש-חוזר ומסלול-התנגשות לא נוגעים בו) + `auth.service.spec.ts` (שמירה עם אותה
      כתובת/case שונה לא מאפסת/לא בודקת התנגשות; שינוי אמיתי מאפס `emailVerifiedAt`; שינוי
      לכתובת תפוסה נכשל ב-409 בלי לכתוב כלום). כל 192 הטסטים בבקאנד עוברים (חוץ מ-4 כשלונות
      קיימים-ולא-קשורים ב-`sprint-summary.builder.spec.ts`, סביבת Node מקומית בלי
      `--experimental-vm-modules`, לא נוגע לתוספת הזו).
- [x] `npx prisma db push` מול Neon האמיתי — **רץ בהצלחה (2026-09-11)**, אחרי אישור מפורש
      נפרד של נוה. אומת ידנית מול הקונטיינר האמיתי: `login`/`register`/Google sign-in כולם
      עובדים, `emailVerifiedAt`/`googleId` מופיעים נכון בתשובות.
- [ ] Backfill חד-פעמי, ידני, מול Neon אמיתי בלבד (אחרי ה-`db push` שם, ורק אחרי אישור נפרד):
      `UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "googleId" IS NOT NULL AND "emailVerifiedAt" IS NULL;`
      (אידמפוטנטי, תחום רק למי שכבר קושר Google בפועל — נועד בעיקר כדי שחשבונות שכבר קושרו
      בפרודקשן לפני התוספת הזו יקבלו ערך נכון רטרואקטיבית.)

**לא בטיפול (7.4):** אין שינוי בהחלטה מוצרית #3 (התנגשות email כשמתחברים עם Google) — זו
הגנה אחרת ונפרדת (טופס פרופיל רגיל, לא זיהוי Google). אין UI חדש (Strings/badge/מסך נפרד) —
הודעת ה-409 עוברת דרך מנגנון ה-`profileMessage` הקיים בפרונט בלי שום שינוי קוד. אין
אימות-חוזר בסיסמה לשינוי מייל — לא התבקש.

### 7.5 תוספת (2026-09-13): בחירת תפקיד בהרשמה דרך Google + מסלול login→register אוטומטי + login_hint ליומן

נוה דיווח שלוש בעיות קשורות אחרי בדיקה בפועל: (א) משתמש שנרשם ישירות דרך Google נכפה עליו
`role: 'DEVELOPER'` בלי אפשרות בחירה, בניגוד לטופס ההרשמה הרגיל שיש בו בורר תפקידים; (ב)
כשמנסים לחבר יומן Google, המסך שואל "עם איזה חשבון Google להתחבר" במקום להציע ישירות את
המייל של המשתמש במערכת; (ג) לחיצה על "המשך עם Google" **במסך ההתחברות** (לא ההרשמה) כשאין
עדיין חשבון תואם — יצרה משתמש `DEVELOPER` בשקט, בלי לעבור דרך שום מסך הרשמה.

**החלטות מוצריות (נוה, 2026-09-13):**
1. בחירת תפקיד למשתמש Google חדש: **מסך "בחר/י תפקיד" מוצג לפני שהחשבון נוצר בכלל** (לא
   יצירה-ואז-עריכה בהגדרות).
2. לחיצה על "המשך עם Google" במסך ההתחברות, כשאין חשבון תואם: **מעביר אוטומטית להשלמת הרשמה,
   בלי לחזור על אימות Google מול השרת** (לא רק הודעת שגיאה שמפנה לטאב הרשמה).

**מימוש (ללא צורך ב-`intent` נפרד ב-`state`):** ההבחנה בפועל היא רק "האם נמצא משתמש תואם",
לא "מאיזה מסך נלחץ הכפתור" — שני הכפתורים ("המשך עם Google" בהתחברות ובהרשמה) קוראים לאותו
`GET /auth/google/connect` בדיוק. `handleCallback` (`google-login.service.ts`) מפוצל: החיפוש
(`findExistingUser`, לא-יוצר) רץ תמיד; אם נמצאה התאמה → `{ticket}` רגיל (login מיידי, כמו
היום); אם לא נמצאה → `{pendingTicket}` חדש (JWT חתום, 10 דק', נושא `googleId`/`email`/
`firstName`/`lastName` — **לא יוצר שום `User`**). ה-callback ב-`auth.controller.ts` מפנה
בהתאם ל-`?ticket=...` או `?pendingTicket=...`.

- [x] `POST /auth/google/complete-registration {pendingTicket, role}` — endpoint חדש, ציבורי
      (בלי auth header, כמו `exchange`). מוודא מחדש (race-safety: אולי חשבון נוצר/קושר בינתיים
      דרך טאב אחר) שאין משתמש תואם — אם יש, מתחבר אליו כמו-שהוא (מתעלם מהתפקיד שנבחר); אחרת
      יוצר `User` חדש עם התפקיד שנבחר (`role || 'DEVELOPER'`), אותה צורת `{accessToken, user}`.
- [x] `frontend/src/app/auth/google/callback.tsx`: קורא גם ל-`pendingTicket` (לצד `ticket`/
      `error` הקיימים) — מציג מסך "עוד צעד אחד קטן" עם בורר תפקידים (`ROLES` מ-
      `@/constants/roles`, אותה רשימה כמו טופס ההרשמה), ואז קורא ל-`complete-registration`.
      עובד גם ב-native (הדף בנוי מ-primitives של RN, לא MUI).
- [x] `auth-form-native.tsx::handleGoogleSignIn`: כש-`result.url` מכיל `pendingTicket` (ולא
      `ticket`), מנווט (`router.push`) לתוך הדף הפנימי `/auth/google/callback?pendingTicket=...`
      במקום לנסות לטפל בזה inline — משתמש חוזר בלוגיקת בורר-התפקידים המשותפת.
- [x] `login_hint` ל-Google Calendar connect: `GoogleCalendarService.getAuthUrl(userId,
      loginHintEmail?)` מעביר את כתובת המייל של המשתמש המחובר (`user.email`, כבר זמין ב-
      `GoogleCalendarController.connect` מ-`validateToken`) כ-`login_hint` ל-Google — רמז
      בלבד (המשתמש עדיין יכול לבחור חשבון Google אחר בפועל), לא אכיפה.
- [x] טסטים: `google-login.service.spec.ts` פוצל ל-`handleCallback` (מחזיר `pendingTicket`
      ולא יוצר `User` כשאין התאמה; ממשיך להחזיר `ticket` רגיל בכל שאר המקרים, כולל מסלול
      ההתנגשות הידוע) + `completeGoogleRegistration` חדש (יוצר עם התפקיד שנבחר, ברירת מחדל
      DEVELOPER, race-safety מול משתמש שכבר נוצר). `auth.controller.spec.ts` עודכן
      (`googleCallback` עם `pendingTicket`, `completeGoogleRegistration` חדש).
      `google-calendar.service.spec.ts::getAuthUrl` — טסט חדש ל-`login_hint`. סה"כ 22
      טסטים ב-google-calendar + 18 ב-google-login עוברים; 203 טסטים בבקאנד כולו (חוץ מ-7
      כשלונות קיימים-ולא-קשורים ב-`sprint-summary.builder.spec.ts`).
- [ ] `npx prisma db push`/schema — **לא נדרש**, אין שינוי סכימה בתוספת הזו.
- [ ] אומת ידנית: `login_hint` תוקן וגם `getAuthUrl` נבדק ב-Jest; **זרימת ה-role-picker
      המלאה (Google → pendingTicket → בחירת תפקיד → יצירת חשבון) לא נבדקה ידנית מקצה-לקצה
      מול Google אמיתי** — רק הלוגיקה הפנימית (Jest, `tsc`). מומלץ בדיקה ידנית לפני שנסמן
      את הפריט הזה כ-done לגמרי.

### תיקון אבטחה (2026-09-14, נמצא ב-`/code-review high`): כל הטוקנים הקצרי-טווח היו ניתנים להחלפה זה בזה

**הבעיה שנמצאה:** שלושה JWT-ים קצרי-טווח ונפרדים-בייעודם — `state` של חיבור-יומן
(`GoogleCalendarService.getAuthUrl`), `state` של login (`GoogleLoginService.getAuthUrl`),
וה-`ticket` שמוחזר מ-`GoogleLoginService.handleCallback` — כולם נחתמים עם אותו `JWT_SECRET`
בדיוק כמו טוקן ה-session האמיתי (12 שעות), ואף אחד מהם לא נשא claim שמבדיל אותו מהאחרים.
בפועל: `AuthService.validateToken` בדק רק חתימה+`sub`, כך שאם `state` של חיבור-יומן דלף
(הוא מופיע לרגע ב-URL שנשלח ל-accounts.google.com — היסטוריית דפדפן/access logs), אפשר
היה להשתמש בו ישירות ככותרת `Authorization: Bearer` תקפה למשך 10 דקות, **או** לשלוח אותו
ל-`POST /auth/google/exchange` ולקבל בתמורה טוקן session אמיתי בן 12 שעות — השתלטות מלאה
על החשבון בלי סיסמה, ממה שמעולם לא נועד לשמש כטוקן אימות בפני עצמו.

**תוקן:** לכל אחד מהטוקנים הקצרים נוסף claim `purpose` ייעודי (`google-calendar-connect`,
`google-login`, `google-login-ticket`), ונקודת הצריכה שלו בודקת את הערך הזה במפורש (לא רק
שהחתימה תקינה). `AuthService.validateToken` דוחה כל טוקן שנושא `purpose` כלשהו — טוקני
session אמיתיים (`register`/`login`/Google `issueSession`) לעולם לא הגדירו את השדה הזה,
כך שזה לא שובר אף session קיים. `pendingTicket` כבר היה מוגן באופן דומה (`pendingGoogleSignup:
true`) — לא נזקק לשינוי.

- [x] `google-calendar.service.ts::getAuthUrl`/`handleCallback`: `purpose:
      'google-calendar-connect'` נחתם ונבדק.
- [x] `google-login.service.ts::getAuthUrl`/`handleCallback`: `purpose: 'google-login'` (כבר
      נחתם קודם, **לא נבדק** — עכשיו נבדק בפועל).
- [x] `google-login.service.ts::handleCallback`/`exchangeTicket`: `purpose:
      'google-login-ticket'` נחתם ונבדק.
- [x] `auth.service.ts::validateToken`: דוחה כל טוקן עם `purpose` כלשהו לפני שממשיך לבדוק
      את המשתמש.
- [x] טסטים: 4 חדשים (התנגשות-purpose לכל כיוון: state של יומן מול login, ticket עם purpose
      שגוי/חסר, `validateToken` דוחה טוקן עם purpose) + עדכון helper-ים קיימים בכל שלושת
      קבצי הספק (`google-calendar.service.spec.ts`, `google-login.service.spec.ts`,
      `auth.service.spec.ts`) שיצרו טוקנים בלי `purpose`. 200/207 טסטים בבקאנד עוברים (עלייה
      מ-196 — 7 הכשלונות הנותרים קיימים-ולא-קשורים ב-pptx), 47/47 e2e עוברים.

### תיקון באג (2026-09-14, נמצא ב-`/code-review high`): שני ממצאים נוספים ב-Google Calendar

- **`syncSprintCreated` לא סינן חברי-צוות לפי `status: 'ACTIVE'`** (בניגוד ל-`backfillExistingSprints`
  שכן מסנן) — חבר שרק נוסף לצוות (`PENDING`, טרם אישר) וכבר יש לו חיבור Google פעיל מצוות
  אחר, קיבל אירוע יומן לספרינט של צוות שהוא עדיין לא חבר פעיל בו. **תוקן**: אותו סינון נוסף.
- **טוקן ה-access המרוענן של Google מעולם לא נשמר בחזרה ל-DB.** `google-auth-library` מרענן
  אוטומטית בזיכרון-בלבד כשהטוקן השמור פג — כל קריאה חוזרת רעננה מחדש מאותה שורה ב-DB (round
  trip מיותר בכל קריאה, לצמיתות), ו-`expiresAt` נשאר שגוי לצמיתות. **תוקן**: מאזין
  `client.on('tokens', ...)` ב-`buildCalendarClient` ששומר את הטוקן/תוקף המרוענן חזרה ל-DB
  (fire-and-forget, כשלון בשמירה לא חוסם את הקריאה עצמה).
- טסטים קיימים עודכנו (מוק `on: jest.fn()` נוסף ל-mock של `OAuth2`), כל 22 הטסטים
  ב-`google-calendar.service.spec.ts` עוברים.

### לא בטיפול (פיצ'ר 7)

- **ספקי זהות נוספים (Apple/Microsoft/GitHub וכו')** — Google בלבד, לפי בקשת נוה.
- **זרימת OAuth מלאה על native (deep link בחזרה לאפליקציה)** — דורשת מחקר טכני נפרד בזמן
  המימוש (ר' 7.2); אין תקדים קיים בקוד לכך היום.
- **תיקון הבאג התיעודי הקיים בהשוואת `approverEmail`/`TeamInvite.email`** (case-sensitivity,
  `specs/02-teams-and-approval.md` §9.1, `invites.service.ts` שורה 144) — לא בתחולת הפיצ'ר
  הזה, גם אם אותה קטגוריית-סיכון רלוונטית להשוואות email חדשות כאן (ר' ברירת מחדל טכנית #3).
- **התנגשות כתובת email בין שני `User` שונים — נדחה במפורש ולא נפתר בסבב הזה** (החלטה
  מוצרית #3, 2026-09-07). המצב הידוע-ומקובל כרגע: אם משתמש מתחבר עם Google וכתובת המייל
  שלו כבר "תפוסה" ע"י `User` אחר (מאומת או לא) — הקישור/היצירה עדיין מתאפשרים, גם אם
  משמעות הדבר היא ששתי שורות `User` מחזיקות זמנית באותה כתובת (ולכן `User.email @unique`
  מוסר/מורפה, ר' 7.1). **לא הוכרע**: מי מבין השניים "מנצח" את הבעלות בפועל על הכתובת, האם
  הצד שאיבד אותה מקבל התראה כלשהי, האם הוא מנותק בכפייה, ומה בדיוק קורה בפעם הבאה
  שמישהו מנסה להתחבר/להירשם עם אותה כתובת שוב. **חובה** שתישאר הערת קוד מפורשת בנקודת
  ה-`handleCallback` הרלוונטית (ר' 7.1) שמסמנת את זה כ-edge case פתוח וידוע — לא לתקן/
  להעלים בשקט בזמן המימוש בלי לחזור לנוה עם ההחלטה הזו קודם.

### פיצ'ר 7 — ממצאי סקירה (2026-09-11, ביקורת יזומה של נוה אחרי הבאג בפרודקשן)

סקירה ממוקדת של `google-login.service.ts` / `auth.service.ts` / `teams.service.ts` /
`schema.prisma` בעקבות הבאג ב-§7.4. **לא רשימת עבודה, לא תיקון** — רק ממצאים, לפי חומרה.
כל הממצאים כאן נובעים מאותה תשתית: החלטה מוצרית #3 (`User.email` הוסר מ-`@unique`, כמה שורות
`User` יכולות לחלוק אימייל בפועל) — אבל רק `google-login.service.ts::findOrCreateUser` עודכן
בפועל להתמודד עם המצב הזה (`orderBy:{id:'asc'}` דטרמיניסטי + הערת קוד). מקומות אחרים בקוד
שגם מחפשים `User` לפי `email` **לא עודכנו** ולא מודעים שהם עכשיו יכולים למצוא כמה שורות.

1. **חמור, קשור ישירות לחשבון של נוה: `TeamsService.create` (`teams.service.ts:54-56`).**
   `ALLOWED_APPROVER_EMAILS` (`teams.service.ts:15`) הן **naveyadai@gmail.com ו-lironka13@gmail.com
   בלבד** — כלומר בדיוק המנגנון שקובע מי הופך ל-`pendingApproverId` על כל צוות חדש נשען על
   `this.prisma.user.findFirst({where:{email:{equals: dto.approverEmail, mode:'insensitive'}}})`
   **בלי `orderBy`**. אם אי-פעם ייווצרו שתי שורות `User` שחולקות את אחת משתי הכתובות האלה
   (בדיוק התרחיש שהחלטה מוצרית #3 מתירה במפורש — למשל דרך התנגשות ב-Google login, או דרך ממצא
   #3 למטה), אין שום ערובה שה-`findFirst` הזה יחזיר את השורה ה"נכונה". `TeamsService.approveTeam`
   (שורה 114: `if (team.pendingApproverId !== requesterId) throw`) בודק שוויון-מזהה מדויק — כך
   שאם השורה שנבחרה כ"מאשר" בזמן היצירה **אינה** אותה שורת `User` שנוה מחובר אליה בפועל, הוא
   עצמו יקבל שגיאת הרשאה בניסיון לאשר צוות משלו, וה-team לא יופיע לו תחת "ממתין לאישורי" (שורה
   305: `pendingApproverId: userId`). זה בדיוק סוג הבאג שהוא כבר חטף באזור הזה — רק שכאן ההשפעה
   היא על מנגנון האישור הדו-שלבי, לא על שדה פרופיל. **אין כאן שאלת מוצר** — זו סטייה טכנית
   מהדפוס שכבר אומץ ב-`google-login.service.ts` לאותה בעיה בדיוק (הוספת `orderBy:{id:'asc'}`
   ועקביות מול אותה שורה שנבחרת בכל מקום).
2. **בינוני: `AuthService.login` (`auth.service.ts:55-62`)** — אותו דפוס: `findFirst({OR:
   [{username: dto.username},{email: dto.username}]})` בלי `orderBy`. אם משתמש מקליד כתובת
   אימייל (לא username) בשדה ההתחברות, וקיימות שתי שורות שחולקות אותה כתובת (למשל שורה אחת
   Google-only עם `password:null` ושורה אחרת עם סיסמה — בדיוק המצב שהוחלט להתיר בהחלטה #3),
   ייתכן שה-lookup יחזיר את השורה ה"לא נכונה" ויציג "חשבון זה מחובר רק דרך Google" למשתמש
   שדווקא יש לו סיסמה תקינה על שורה אחרת עם אותה כתובת — שגיאה מטעה, לא קריסה.
3. **בינוני: `AuthService.register` (`auth.service.ts:15-22`)** — בדיקת הייחודיות
   (`findFirst({OR:[{username},{email}]})`) היא **case-sensitive בלבד** (לא `mode:'insensitive'`,
   בניגוד ל-`updateProfile`/`google-login`). זה כבר תועד כדפוס-סיכון קיים (ר' "ממצאי מחקר"
   למעלה), אבל המשמעות התחדדה: לפני פיצ'ר 7 היה גיבוי ברמת ה-DB (`email @unique`) שמנע כפילות
   מדויקת גם אם הקוד היה מפספס; מאז ש-`@unique` הוסר (החלטה מוצרית #3) **אין יותר שום רשת
   ביטחון ברמת ה-DB**, וגם שני בקשות `register` בו-זמניות עם אותה כתובת מייל בדיוק (race,
   TOCTOU בין ה-`findFirst` ל-`create`) יכולות כעת ליצור שתי שורות עם אותה כתובת בדיוק — בלי
   שום צורך במסלול Google בכלל.
4. **קל: אין ולידציית פורמט/ריקנות על `email` ב-DTOs (`RegisterDto`/`UpdateProfileDto`) —
   אין `class-validator`/`ValidationPipe` בכלל בפרויקט (זה דפוס קיים בכל ה-backend, לא ספציפי
   לפיצ'ר 7).** בפרט: `PATCH /auth/profile` — הפרונט (`use-profile-form.ts:14-17`) חוסם שליחה
   עם `email` ריק, אבל קריאת API ישירה (לא דרך הפרונט) יכולה לשלוח `email:''` ותעבור את בדיקת
   ה"שינוי אמיתי" ב-`updateProfile` (כי `''` שונה מהכתובת הנוכחית) ותכתוב מחרוזת ריקה כ-`email`.
5. **תיעוד לא מעודכן:** `specs/00-shared-conventions.md` תחת "`PATCH /auth/profile` — חוסר
   עקביות מול `register`" עדיין מתאר את המצב **לפני** §7.4 (טוען ש-`updateProfile` "מעדכן email
   בלי שום בדיקת ייחודיות" ושזה יגרום ל-500 לא מטופל) — זה כבר לא נכון מאז §7.4 (יש בדיקת
   התנגשות + 409 מסודר). כדאי לעדכן שם כדי שסוכנים עתידיים לא יסתמכו על תיאור שגוי.

**עדכון (2026-09-11, מיד אחרי הסקירה):** נוה ביקש לתקן מיידית, לא לחכות לעבודה עתידית —
בהתחשב בכך שממצא #1 נוגע ישירות לחשבון שלו.

- **#1, #2 — תוקנו.** `orderBy:{id:'asc'}` דטרמיניסטי נוסף גם ל-`TeamsService.create`'s approver
  lookup (`teams.service.ts`) וגם ל-`AuthService.login`'s email/username lookup
  (`auth.service.ts`) — אותו דפוס בדיוק שכבר היה ב-`google-login.service.ts`. טסטים קיימים
  עודכנו בהתאם (`teams.service.spec.ts`, `auth.service.spec.ts`); כל 192 הטסטים בבקאנד עוברים
  (חוץ מ-4 כשלונות קיימים-ולא-קשורים ב-`sprint-summary.builder.spec.ts`).
- **#5 — תוקן.** `specs/00-shared-conventions.md` ו-`specs/02-teams-and-approval.md` §9 פריט 1
  עודכנו לשקף את המצב הנוכחי (לא עוד מתארים באגים שכבר לא קיימים).
- **#3, #4 — נשארו כממצאים בלבד, לא תוקנו.** #3 (`register` case-sensitive בלבד) ו-#4 (אין
  ולידציית פורמט/ריקנות על DTOs) הם שינויי התנהגות רחבים יותר (case-insensitive ב-`register`
  ישנה מה "כבר קיים" נחשב, ו-`ValidationPipe` הוא דפוס-פרויקט רחב, לא ספציפי לפיצ'ר 7) —
  משאירים אותם לפי בחירת נוה מתי לטפל, לא תוקנו בשקט.
