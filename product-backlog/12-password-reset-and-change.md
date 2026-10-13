## פיצ'ר 12: שכחתי סיסמה + הגדרה/החלפת סיסמה — מאופיין, חסום ע"י BUG-59 (כל ההחלטות נסגרו 2026-10-13)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `User` — שדה חדש `passwordChangedAt DateTime?` (ביטול טוקנים ישנים); מודל חדש `PasswordResetToken` (`userId` FK cascade, `tokenHash`, `expiresAt`, `usedAt?`, `createdAt`).
- **Backend:** `backend/src/auth/auth.service.ts` (`requestPasswordReset`, `resetPassword`, `changePassword`; `validateToken` — דחיית טוקן שהונפק לפני `passwordChangedAt`), `backend/src/auth/auth.controller.ts`, `backend/src/auth/dto/auth.dto.ts`, `backend/src/email/email.service.ts` (`sendPasswordReset` חדש, אותו דפוס Resend + `escapeHtml`).
- **Endpoints:** חדשים — `POST /auth/password/forgot` (`{ email }`, בלי auth), `POST /auth/password/reset` (`{ token, newPassword }`, בלי auth), `POST /auth/password/change` (`{ currentPassword?, newPassword }`, עם auth).
- **Frontend:** `features/auth/components/auth-form-web.tsx`/`-native.tsx` (קישור "שכחתי סיסמה"), route חדש `src/app/reset-password/[token].tsx`, `features/settings/components/settings-screen-web.tsx`/`-native.tsx` (כרטיס "החלפת סיסמה" / "הגדר סיסמה"), `src/constants/strings.ts`.
- **נוגע ב-`validateToken`** — כל endpoint מאומת עובר דרכו. **נוגע ב-`User.email` הלא-ייחודי** (פיצ'ר 7) ובמשתמשים עם `password: null` (Google בלבד — פיצ'ר 7; פנטום — פיצ'ר 9). **פיצ'ר 15** מוסיף `User.deletedAt` — גם השאילתות כאן צריכות להחריג משתמש שנמחק.

מטרת הפיצ'ר: לאפשר למשתמש ששכח סיסמה לחזור לחשבון דרך קישור במייל, ולמשתמש מחובר להחליף
סיסמה (או להגדיר סיסמה ראשונה, אם נרשם דרך Google) מתוך ההגדרות.

### 12.0 החלטות

**שלב הכנה (חוסם):** לתקן את BUG-59 — לאמת דומיין שולח ב-Resend ולהגדיר `EMAIL_FROM` בפרודקשן.
בלי זה, מייל האיפוס לא יגיע לאף אחד חוץ מבעל חשבון ה-Resend.

**החלטות מוצריות (נוה, 2026-10-13):**

1. **משתמש Google בלבד שלוחץ "שכחתי סיסמה" יכול להגדיר סיסמה ראשונה** דרך אותו קישור. אחרי זה
   יש לו שתי דרכי כניסה: Google וסיסמה.
2. **בהגדרות, משתמש Google בלבד רואה "הגדר סיסמה"** בלי שדה "סיסמה נוכחית". משתמש עם סיסמה רואה
   "החלפת סיסמה" עם סיסמה נוכחית.
3. **אין מייל "הסיסמה שלך שונתה"** אחרי איפוס או החלפה.

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול את נוה עליהן):**

1. **תשובה אחידה ל-`forgot`.** תמיד 200 עם אותה הודעה ("אם קיים חשבון עם המייל הזה, נשלח אליו
   קישור"), גם אם לא נמצא משתמש. אחרת אפשר לברר אילו מיילים רשומים במערכת.
2. **הטוקן נשמר כ-hash בלבד** (`sha256`), חד-פעמי (`usedAt`), ותוקפו 60 דקות. בקשה חדשה מבטלת
   את הטוקנים הקודמים של אותו משתמש. הטוקן הגולמי מופיע רק בקישור שבמייל.
3. **ביטול כל ה-sessions אחרי איפוס, החלפה או הגדרה.** ה-JWT תקף 12 שעות ואין היום דרך לבטל
   אותו. `passwordChangedAt` נבדק ב-`validateToken`: טוקן עם `iat` מוקדם יותר נדחה. המכשיר שממנו
   בוצעה הפעולה מקבל טוקן חדש בתשובה, כדי שלא יתנתק.
4. **בחירת משתמש לפי מייל לא-ייחודי:** `forgot` בוחר בדיוק את מי ש-`login` היה בוחר — אותה שאילתה
   (`findFirst` לפי `id asc`), בלי פנטומים (`isPhantom: false`) ובלי משתמשים שנמחקו (פיצ'ר 15).
   כך הקישור תמיד מאפס את החשבון שבאמת מתחבר עם המייל הזה.
5. **כללי סיסמה זהים ל-`register`** (אותה ולידציה, `bcrypt.hash(..., 10)`).
6. **הגבלת קצב ל-`forgot`:** לכל היותר 3 בקשות למייל בשעה. נספר מטבלת הטוקנים, בלי ספריית
   throttling.
7. **`currentPassword` נדרש רק כש-`user.password !== null`.** כשאין סיסמה (Google בלבד), זו הגדרה
   ראשונה מתוך session מחובר.

### ממצאי מחקר (מצב הקוד היום, 2026-10-13)

- `PATCH /auth/profile` (`auth.service.ts:176`) מקבל רק `firstName`/`lastName`/`email`. אין
  endpoint שנוגע ב-`password` אחרי ההרשמה.
- `login` (`auth.service.ts:87`) מחפש לפי username **או** email, עם `orderBy: { id: 'asc' }`, כי
  `User.email` כבר לא `@unique` מאז פיצ'ר 7. משתמש עם `password: null` מקבל הודעה מפורשת להתחבר
  דרך Google.
- JWT נחתם עם `expiresIn: '12h'` בשלושה מקומות (`register`, `login`, `issueSession` של Google).
  `validateToken` בודק רק חתימה, `purpose` וקיום משתמש. אין ביטול מוקדם.
- `EmailService` עובד עם Resend, עם `escapeHtml` ו-`sanitizeSubject`. בלי `RESEND_API_KEY` המייל
  רק נרשם בלוג — שימושי לטסטים.
- `EMAIL_FROM` לא מוגדר בפרודקשן (BUG-59), כך שהשולח הוא `onboarding@resend.dev`.
- אין throttling באפליקציה.

### 12.1 Backend

- [ ] (הכנה) BUG-59: דומיין מאומת ב-Resend + `EMAIL_FROM` ב-Fly secrets.
- [ ] Prisma: `User.passwordChangedAt DateTime?` + מודל `PasswordResetToken`. `db push` מול `postgres-test`, ואז Neon.
- [ ] `POST /auth/password/forgot`: ולידציה, הגבלת קצב, יצירת טוקן, `EmailService.sendPasswordReset` עם `${FRONTEND_URL}/reset-password/<token>`. תשובה אחידה.
- [ ] `POST /auth/password/reset`: טוקן קיים, לא פג ולא שומש → עדכון סיסמה (גם כשהייתה `null`) + `passwordChangedAt` + `usedAt`, בטרנזקציה אחת. מחזיר `accessToken` חדש.
- [ ] `POST /auth/password/change`: `currentPassword` לפי ברירת מחדל 7, עדכון + `passwordChangedAt`. מחזיר `accessToken` חדש.
- [ ] `validateToken`: לדחות טוקן ש-`iat * 1000 < passwordChangedAt`.
- [ ] Unit tests: תשובה אחידה למייל לא קיים; טוקן פג/שומש/לא קיים → 400; הגבלת קצב; טוקן ישן נדחה; סיסמה נוכחית שגויה → 401; משתמש Google מגדיר סיסמה בלי `currentPassword` ✓ ואז מתחבר עם סיסמה ✓.

### 12.2 Frontend

- [ ] קישור "שכחתי סיסמה" בטופס ההתחברות (web+native) → הזנת מייל → הודעת "אם קיים חשבון...". `trackEvent('forgot_password_clicked' / 'forgot_password_submitted')`.
- [ ] Route `reset-password/[token]`: סיסמה חדשה + אימות → כניסה ישירה. מצב טוקן פג/לא תקין עם נתיב חזרה למסך הכניסה. `trackEvent('password_reset_completed')`.
- [ ] כרטיס בהגדרות (web+native): "החלפת סיסמה" או "הגדר סיסמה" לפי `hasPassword` (שדה חדש בתשובת `GET /auth/me`). שמירת הטוקן החדש דרך `auth-context`. `trackEvent('password_change_submitted')`.
- [ ] כל המחרוזות ב-`Strings`. Jest לכל מסך.

### 12.3 בדיקות

- [ ] Playwright e2e (Desktop+Mobile): בקשת איפוס → קריאת הטוקן מ-DB הבדיקות (אין מייל אמיתי) → איפוס → כניסה עם הסיסמה החדשה; החלפת סיסמה מההגדרות → הסיסמה הישנה נכשלת.
- [ ] Backend e2e: מחזור forgot→reset מלא, וטוקן session ישן שנדחה אחרי reset.

### לא בטיפול (פיצ'ר 12)

- מייל התראה על שינוי סיסמה (נדחה — החלטה 3).
- אימות דו-שלבי (2FA).
- החלפת כתובת מייל עם אימות (קיים חלקית בפיצ'ר 7 §7.4).
- מסך "המכשירים המחוברים שלי".
