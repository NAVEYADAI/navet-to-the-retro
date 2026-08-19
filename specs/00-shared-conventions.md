# Shared Conventions

## 1. Overview

מוסכמות שחוצות את כל המודולים ב-backend וכל הפיצ'רים ב-frontend: איך אימות (auth) עובד, איך שגיאות מתורגמות ל-HTTP, ואיך ה-frontend קורא ל-API. קבצי ספק אחרים (`02-teams-and-approval.md` וכו') מפנים לכאן במקום לחזור על התיאור.

מקורות: `backend/src/auth/auth.service.ts`, `frontend/src/context/auth-context.tsx`, `frontend/src/api/client.ts`, `frontend/src/api/config.ts`.

## 2. Data Model

`User` (מ-`backend/prisma/schema.prisma`):
- `id: Int @id @default(autoincrement())`
- `username: String @unique`
- `email: String @unique`
- `password: String` — hash של bcrypt, תמיד מוסר ידנית מתשובות API (`const { password, ...result } = user`)
- `firstName: String?`, `lastName: String?`
- `role: String @default("DEVELOPER")` — **שדה טקסט חופשי, לא enum** (בניגוד ל-`TeamRole` שכן enum). לא נאכף שום ולידציה על הערך הזה ברמת ה-DB.
- `createdAt: DateTime @default(now())`

## 3. Auth Mechanism (gates almost every endpoint)

אין NestJS Guards/Passport. כל controller method מוגן קורא ידנית ל-`AuthService.validateToken(authHeader)`, עם `@Headers('authorization') authHeader: string`.

### `validateToken(authHeader)` — `backend/src/auth/auth.service.ts:86-107`

```
1. אם authHeader חסר/ריק → throw UnauthorizedException('Missing authorization header')
2. token = authHeader.replace(/^Bearer\s+/i, '')   // מסיר "Bearer " אם קיים; לא בודק שהפריפיקס בכלל היה שם
3. try:
     payload = jwt.verify(token, jwtSecret)         // זורק אם פג תוקף / חתימה לא תקינה / token לא JWT בכלל
     user = prisma.user.findUnique({ id: payload.sub })
     אם user לא נמצא → throw UnauthorizedException('User not found')   // ⚠️ ראה סעיף 3.1
     return user without password
   catch (err):
     throw UnauthorizedException('Invalid token')
```

**§3.1 — באג מתועד: `'User not found'` אף פעם לא מגיע ללקוח.** ה-`throw new UnauthorizedException('User not found')` נמצא *בתוך* בלוק ה-`try`, כך שהוא נתפס על ידי ה-`catch (err)` שמתחתיו ונזרק מחדש כ-`UnauthorizedException('Invalid token')` הגנרי. בפועל, כל כשל ב-`validateToken` — טוקן פג תוקף, טוקן פגום, ומשתמש-נמחק-אחרי-שהטוקן-הונפק — כולם מחזירים בדיוק `401 'Invalid token'`. STATUS: Bug candidate (לא קריטי מבחינת אבטחה, אבל הופך את ה-message הזה לבלתי-נבדק/בלתי-מושג בפועל; טסט שמצפה ל-`'User not found'` צריך למעשה לצפות ל-`'Invalid token'`).

### JWT

- Secret: `process.env.JWT_SECRET || 'retro-secret-key-12345'` — **STATUS: Bug candidate (security risk)**: אם `JWT_SECRET` לא מוגדר בסביבת production, המערכת נופלת לסוד קבוע וידוע בקוד המקור.
- Payload: `{ sub: user.id, username: user.username, email: user.email }`
- `expiresIn: '12h'`
- Signed/verified עם `jsonwebtoken` (`jwt.sign` / `jwt.verify`).

### Passwords

- Hash: `bcryptjs.hash(password, 10)` (10 salt rounds).
- Compare: `bcryptjs.compare(dto.password, user.password)`.
- כל תשובת API שמכילה `User` מסירה `password` ידנית (`const { password, ...result } = user`) — אין `@Exclude` ברמת ה-schema, זה נאכף בכל endpoint בנפרד. אם endpoint חדש ישכח לעשות את זה, ה-hash ידלוף בתשובה.

### `PATCH /auth/profile` — חוסר עקביות מול `register`

`AuthService.updateProfile` (`auth.service.ts:109-121`) מעדכן `email` בלי שום בדיקת ייחודיות — לעומת `register` שבודק `OR: [{username}, {email}]` לפני יצירה. **STATUS: Bug candidate**: משתמש יכול לעדכן את המייל שלו לערך שכבר תפוס ע"י משתמש אחר; Prisma יזרוק שגיאת unique-constraint לא-מטופלת (500, לא 409 מסודר). זה משפיע ישירות על `02-teams-and-approval.md` כי `approverEmail` lookup נשען על ייחודיות מייל.

## 4. Error → HTTP Status Mapping (NestJS built-ins בשימוש בקוד)

| Exception class | HTTP status | שימוש טיפוסי |
|---|---|---|
| `UnauthorizedException` | 401 | טוקן חסר/פגום/פג תוקף, קרדנציאלים שגויים |
| `ForbiddenException` | 403 | המבקש מזוהה אבל אין לו הרשאה לפעולה |
| `NotFoundException` | 404 | ישות לא קיימת (team, sprint, user) |
| `ConflictException` | 409 | הפעולה סותרת מצב קיים (כבר קיים, race, מצב לא תואם) |

כל השגיאות האלה מגיעות ל-frontend כ-`err.response?.data?.message` (axios), ואין error envelope אחיד מעבר לזה — ה-`message` הוא בדיוק המחרוזת שהועברה ל-constructor של ה-exception ב-NestJS.

## 5. Frontend API Call Pattern

**אין client מרכזי בשימוש בפועל.** קיים `frontend/src/api/client.ts` (`apiClient` axios instance + `getAuthHeaders(token)`), אבל הוא בשימוש רק ב-`auth-context.tsx` (לבדיקת session ב-mount). כל שאר הפיצ'רים (`teams`, `sprints`, `retro`) קוראים ל-`axios` ישירות עם header ידני:

```ts
axios.post(`${getBackendUrl()}/teams/${teamId}/approve`, {}, {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

`getBackendUrl()` (`frontend/src/api/config.ts`):
```ts
Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
  ? 'https://navet-to-retro-backend.fly.dev'
  : 'http://localhost:5005'
```

## 6. Auth Context & Storage — `frontend/src/context/auth-context.tsx`

`AuthProvider` חושף `{token, user, loading, login, logout}` דרך `useAuth()`.

- Storage helper (שורות 7-29): על web — `localStorage`; על native — `memoryStorage` (אובייקט JS בזיכרון, לא AsyncStorage/SecureStore). **STATUS: Intentional-but-document**: session על native לא שורד restart של האפליקציה — כל תרחיש e2e על native שדורש "משתמש מחובר מראש" לא יכול להסתמך על session שנשמר בין הרצות; צריך להתחבר מחדש בכל תרחיש.
- ב-mount (`useEffect`, שורות 46-63): קורא `userToken` מה-storage; אם קיים, קורא `GET /auth/me` עם `getAuthHeaders(token)`. בהצלחה: `setToken` + `setUser(response.data)`. בכישלון: `storage.removeItem('userToken')` + `console.error` (משתמש נשאר בשקט מול מסך ה-login, בלי שום הודעת שגיאה).
- `login(token, user)`: שומר טוקן ב-storage, מעדכן state.
- `logout()`: מנקה storage + state.

כל קומפוננטת feature קוראת `token` מ-`useAuth()` ומצרפת אותו ידנית לכל בקשה (ראה סעיף 5) — אין axios interceptor גלובלי.

## 7. Open Questions

- האם `role: String` ב-`User` אמור להיות מוגבל לערכים מסוימים (כמו `TeamRole`), או שהוא כן מיועד להיות טקסט חופשי?
- האם יש כוונה עתידית להחליף storage native ל-SecureStore/AsyncStorage, או שזו החלטה מכוונת (למשל בשביל לא לשמור טוקן על מכשיר משותף)?
