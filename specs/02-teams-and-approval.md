# Teams & Approval Workflow Spec

זהו קובץ האפיון בעל תעדוף הכי גבוה בסבב הזה — התהליך הכי חדש באפליקציה, וללא שום כיסוי בדיקות היום (0 טסטים ב-backend, 0 ב-frontend).

ראה גם [`00-shared-conventions.md`](./00-shared-conventions.md) ל: מנגנון auth (`validateToken`), error→HTTP mapping, דפוס קריאות axios מה-frontend, storage.

## 1. Overview

יצירת צוות היא כיום תהליך דו-שלבי: משתמש (creator) יוצר צוות ומזין email של "מאשר" (approver) — שחייב להיות אחת משתי כתובות קשיחות בקוד. הצוות נוצר במצב `PENDING_APPROVAL` והיוצר הופך מיד לחבר צוות (`TEAM_LEADER`, admin). הצוות הופך `ACTIVE` (ושימושי בפועל — למשל ליצירת ספרינטים) רק אחרי שה-approver עצמו מאשר אותו דרך ה-UI. גם היוצר וגם המאשר יכולים לבטל (decline) את הצוות בזמן שהוא עדיין ממתין.
מכסה: `backend/src/teams/*` (יצירה, אישור, דחייה, חברים, תפקידים) ו-`frontend/src/features/teams/*` (טופס יצירה, רשימת צוותים כולל כרטיסי אישור/דחייה).

## 2. Data Model

מ-`backend/prisma/schema.prisma`:

```prisma
enum TeamStatus { PENDING_APPROVAL  ACTIVE }
enum TeamRole   { TEAM_LEADER  PRODUCT_MANAGER  TESTER  DEVELOPER }

model Team {
  id                Int          @id @default(autoincrement())
  name              String
  mainOffice        String?
  status            TeamStatus   @default(PENDING_APPROVAL)
  createdAt         DateTime     @default(now())
  creatorId         Int
  pendingApproverId Int?
  creator           User  @relation("TeamCreator", fields:[creatorId], onDelete: Cascade)
  pendingApprover   User? @relation("TeamPendingApprover", fields:[pendingApproverId], onDelete: SetNull)
  members           TeamMember[]
  comments          Comment[]
  sprints           Sprint[]
}

model TeamMember {
  id       Int      @id @default(autoincrement())
  userId   Int
  teamId   Int
  role     TeamRole @default(DEVELOPER)
  isAdmin  Boolean  @default(false)
  user User @relation(fields:[userId], onDelete: Cascade)
  team Team @relation(fields:[teamId], onDelete: Cascade)
  @@unique([userId, teamId])
}
```

הערות שאינן מובנות מאליהן:
- `pendingApproverId` הוא `Int?` (nullable) ו-`onDelete: SetNull` — אם ה-approver המוזמן נמחק מהמערכת בזמן שהצוות ממתין, הצוות **לא** נמחק; הוא נשאר `PENDING_APPROVAL` לנצח עם `pendingApproverId: null`, ואף אחד לא יכול יותר לאשר או לדחות אותו (אף אחד לא עומד בבדיקת `requesterId === pendingApproverId`, וגם היוצר לא יכול לדחות כי decline דורש גם התאמה ל-creatorId **או** ל-pendingApproverId — היוצר כן עומד בזה, אז decline עדיין אפשרי ליוצר; ראה §9.5).
- `creator` הוא `onDelete: Cascade` — מחיקת היוצר מוחקת את כל הצוות (כולל cascades הלאה ל-`TeamMember`, `Sprint`, `Comment`).
- `@@unique([userId, teamId])` על `TeamMember` — הבסיס לכך שאישור כפול-מקביל עלול לזרוק unique-constraint violation (ראה §8, §9).

## 3. API Contract

כל ה-endpoints דורשים `Authorization: Bearer <token>` תקין (ראה `00-shared-conventions.md` §3). **חשוב:** `CreateTeamDto`/`AddMemberDto`/`UpdateMemberDto` הם מחלקות TypeScript רגילות בלי decorators של `class-validator`, ואין `ValidationPipe` גלובלי רשום ב-`main.ts`. כלומר **אין שום ולידציה בזמן ריצה על גוף הבקשה** — שדה חסר לא מייצר 400 מסודר, הוא פשוט `undefined` שממשיך לתוך הקוד.

### `POST /teams`
- Auth: נדרש. Status הצלחה: `201`.
- Body (`CreateTeamDto`): `{ name!: string, mainOffice?: string, approverEmail!: string }`
- הצלחה: יוצר `Team{status:'PENDING_APPROVAL', pendingApproverId: approver.id}` + `TeamMember{userId:creatorId, role:'TEAM_LEADER', isAdmin:true}` יחד באותה קריאת `create` (לא בטרנזקציה נפרדת — אטומי מבחינת Prisma כי זה nested write יחיד). מחזיר את ה-Team כולל `members`.

| # | תנאי מדויק | Exception | Status | הודעה |
|---|---|---|---|---|
| E1 | `approverEmail` לא נשלח בכלל (`undefined`) | **לא נתפס** — `TypeError` על `.toLowerCase()` | **500** | `Internal server error` (ברירת מחדל של Nest, לא הודעה מבוקרת) |
| E2 | `approverEmail.toLowerCase()` לא ב-`ALLOWED_APPROVER_EMAILS = ['naveyadai@gmail.com','lironka13@gmail.com']` | `ForbiddenException` | 403 | `רק כתובות אימייל מורשות יכולות לאשר יצירת צוות.` |
| E3 | `approverEmail` עובר את E2 אבל `prisma.user.findUnique({email: dto.approverEmail})` (⚠️ **לא** lowercased — ראה §9.1) לא מוצא משתמש | `NotFoundException` | 404 | `לא נמצא משתמש עם כתובת האימייל הזו. בקש/י מהחבר להירשם קודם ולנסות שוב.` |
| E4 | המשתמש שנמצא הוא היוצר עצמו (`approver.id === creatorId`) | `ConflictException` | 409 | `לא ניתן להזמין את עצמך כמאשר/ת` |
| E5 | `name` לא נשלח בכלל (`undefined`) | **לא נתפס** — Prisma זורק (שדה `name: String` חובה ב-schema) | **500** | הודעת שגיאת Prisma גולמית, לא מבוקרת |
| E6 | `name` נשלח כמחרוזת ריקה `''` | **אין שגיאה** | 201 | הצוות **נוצר** עם שם ריק — אין שום חסימה |
| E7 | `mainOffice` לא נשלח | **אין שגיאה** | 201 | הצוות נוצר עם `mainOffice: null` (שדה אופציונלי כדין) |

### `POST /teams/:id/approve`
- Auth נדרש. Status הצלחה: `201` (אין `@HttpCode` override).
- Body: ריק.
- הצלחה: `$transaction` (שתי פעולות, אטומיות ביחד): (1) `TeamMember.create{teamId, userId:requesterId, role:'TEAM_LEADER', isAdmin:true}`, (2) `Team.update{status:'ACTIVE', pendingApproverId:null}`. מחזיר את ה-Team המעודכן כולל `members`.

| # | תנאי מדויק | Exception | Status | הודעה |
|---|---|---|---|---|
| A1 | `teamId` לא קיים | `NotFoundException` | 404 | `Team not found` |
| A2 | `requesterId !== team.pendingApproverId` — כולל: היוצר מנסה לאשר את הצוות שלו-עצמו, וכולל: **כל ניסיון שני לאשר אחרי שכבר אושר פעם** (כי אחרי אישוש `pendingApproverId` הופך `null`, ואף `requesterId` לא שווה ל-`null`) | `ForbiddenException` | 403 | `רק המשתמש שהוזמן לאשר יכול לאשר את הצוות הזה` |
| A3 | `team.status !== 'PENDING_APPROVAL'` | `ConflictException` | 409 | `הצוות כבר אושר או בוטל` |

**⚠️ A3 הוא בעצם dead code בזרימה רגילה (sequential).** כל קריאה ל-approve שמצליחה מנקה את `pendingApproverId` **באותה טרנזקציה** שמעדכנת את ה-`status`, כך שאין מצב בו `status !== PENDING_APPROVAL` בעוד `pendingApproverId` עדיין שווה למישהו — כל קריאה שנייה (סדרתית) תיפול על A2, לא A3. הבדיקה הזו רלוונטית רק תחת race condition אמיתי — ראה §8 (E2E-ראס') ו-§9.2.

### `POST /teams/:id/decline`
- Auth נדרש. Status הצלחה: `201`.
- הצלחה: `prisma.team.delete({id})` — מוחק את שורת ה-Team לגמרי; cascade מוחק גם את כל שורות `TeamMember`, `Sprint`, `Comment` ששייכות לצוות (`onDelete: Cascade` בכל היחסים האלה בסכימה). מחזיר `{ success: true }`.

| # | תנאי מדויק | Exception | Status | הודעה |
|---|---|---|---|---|
| D1 | `teamId` לא קיים | `NotFoundException` | 404 | `Team not found` |
| D2 | `requesterId` הוא לא `team.creatorId` וגם לא `team.pendingApproverId` | `ForbiddenException` | 403 | `רק היוצר/ת או המאשר/ת המוזמן/ת יכולים לבטל את הצוות` |
| D3 | `team.status !== 'PENDING_APPROVAL'` (כלומר כבר `ACTIVE`) **וגם** המבקש עבר את D2 | `ConflictException` | 409 | `הצוות כבר אושר` |

**D3 כן ניתן להשגה בפועל** (בניגוד ל-A3): אחרי שהצוות אושר, ה-`pendingApproverId` מתאפס ל-`null`, כך שרק **היוצר** עדיין עומד בבדיקת D2 (`requesterId === creatorId`); הוא מגיע ל-D3 ונופל על ה-409 "הצוות כבר אושר" אם ינסה "לבטל" צוות שכבר אושר. המאשר-לשעבר לא יכול אפילו להגיע לכאן — הוא נופל על D2 (403) כי `pendingApproverId` כבר `null`.

### `POST /teams/:id/members`
- Auth נדרש; requester **חייב `role === 'TEAM_LEADER'`** (⚠️ לא `isAdmin` — שונה מ-`updateMember`/`updateTeam`, ראה §9.6). Body (`AddMemberDto`): `{ username!: string, role!: TeamRole }`.
- מחפש משתמש קיים לפי `username` **או** `email` (`OR` query).
- שגיאות: `NotFoundException('Team not found')` (404); `ForbiddenException('Only team leaders can add members to the team')` (403) אם המבקש לא חבר-TEAM_LEADER; `NotFoundException("User with username or email '${dto.username}' not found")` (404); `ConflictException('User is already a member of this team')` (409, מבוסס על `@@unique([userId,teamId])`).
- `finalRole = dto.role || userToJoin.role || 'DEVELOPER'` — שים לב: `userToJoin.role` הוא ה-`User.role` (string חופשי, ברירת מחדל `'DEVELOPER'`), לא `TeamRole` enum — יכול תיאורטית להיות כל string שהוזן ב-registration/profile.

### `GET /teams/:id/members`
- Auth: `validateToken` + דורש חברות ACTIVE בצוות (אחרת `ForbiddenException`) — תוקן ב-BUG-03. `NotFoundException('Team not found')` אם לא קיים.

### `GET /teams/user/me`
- מחזיר מערך מאוחד: חברויות בפועל (`{...team, roleInTeam: m.role}`) **בצירוף** צוותים שהמשתמש הוא ה-`pendingApprover` שלהם ועדיין `PENDING_APPROVAL` (`{...team, roleInTeam: null}`). ה-frontend מבחין בין השניים לפי `team.status`/`pendingApproverId`/`creatorId` ולא לפי `roleInTeam` ישירות (ראה §6).
- אם משתמש הוא גם חבר בצוות A וגם ה-approver הממתין של צוות B — שני האובייקטים יופיעו במערך, ללא דה-דופליקציה (אין חפיפת `id` אפשרית כי אלה צוותים שונים, אז זה תקין).

### `PATCH /teams/:teamId/members/:memberId`
- Auth נדרש; requester חייב `isAdmin === true` בצוות. חוסם הורדת admin מהאדמין האחרון: `ConflictException('Cannot remove admin status from the only admin in the team')` (409) אם `dto.isAdmin === false && targetMember.isAdmin && adminCount <= 1`.

### `PATCH /teams/:id`
- Auth נדרש; requester חייב `isAdmin === true`. Body inline (לא DTO class מיובא): `{name?, mainOffice?}`. `ForbiddenException('Only team admins can edit team details')` (403).

## 4. Business Rules & Constants

- `ALLOWED_APPROVER_EMAILS = ['naveyadai@gmail.com', 'lironka13@gmail.com']` — קשיח בקוד (`backend/src/teams/teams.service.ts:13`), לא DB/env-driven.
- יוצר צוות תמיד הופך `TEAM_LEADER` + `isAdmin:true` באופן אוטומטי, ללא אפשרות בחירה.
- מאשר-שמאשר תמיד הופך גם הוא `TEAM_LEADER` + `isAdmin:true` (לא תפקיד אחר) — כלומר לכל צוות שאושר יש **בדיוק שני** `TEAM_LEADER`/admin כתוצאה ישירה מהתהליך (היוצר + המאשר), עד שינוי ידני.
- `TeamRole` enum: `TEAM_LEADER | PRODUCT_MANAGER | TESTER | DEVELOPER`.
- `addMember` שער-כניסה הוא `role==='TEAM_LEADER'` דווקא, לא `isAdmin` — ראו §9.6.

## 5. Client-Side Validation — `create-team-form.tsx`

טופס יצירת צוות (`frontend/src/features/teams/components/create-team-form.tsx:29-47`), מוצג משני מקומות: `app/index.tsx` (native בלבד) ו-`app/settings.tsx` (שני הפלטפורמות).

| שדה | כלל | מתי מופעל | הודעה |
|---|---|---|---|
| `newTeamName` | `!name.trim()` → חוסם | on submit (לפני קריאת API) | `שם הצוות שדה חובה.` (טקסט hardcoded, **לא** דרך `Strings`) |
| `approverEmail` | `!approverEmail.trim()` → חוסם | on submit, **אחרי** בדיקת השם (סדר: שם ואז מייל) | `Strings.dashboard.approverEmailRequiredError` = `צריך להזין אימייל של חבר/ת צוות שני/ה כדי לאשר את הקמת הצוות.` |
| `newMainOffice` | אין ולידציה | — | — |

- הוולידציה הזו **חוזרת** על הצד השרת אבל לא מכסה את אותם מקרים: השרת בכלל לא בודק `name` ריק (§3 E6) — ה-FE כן חוסם `''`/רווחים-בלבד, אבל **לא** בודק פורמט email (כל string לא-ריק עובר), בעוד השרת דוחה email לא ברשימה/לא קיים.
- בהצלחה: `onSubmit` (מועבר מהעמוד הקורא) מנקה את שלושת השדות; ב-`catch`, `localError` מוצג עם `err.message` (ה-`Error` שנזרק מ-`onSubmit`, לא בהכרח `err.response.data.message` — תלוי במימוש בעמוד הקורא, ראה §7).

## 6. UI States & Components

הלוגיקה כפולה במלואה — כל derivation ומאזין-אירועים מוגדרים **בנפרד** ב-`team-list-native.tsx` וב-`team-list-web.tsx` (ללא hook משותף). לתעד ולבדוק את שניהם בנפרד, לא להניח שהתנהגות web ⇒ native.

### Derived state (זהה בשני הקבצים, בכל אחד בנפרד)
```ts
const isPending      = team.status === 'PENDING_APPROVAL';
const isMyApproval    = isPending && team.pendingApproverId === userId;
const isMyPendingTeam = isPending && team.creatorId === userId;
```

### `isMyApproval === true` → כרטיס אישור נפרד
- native: `team-list-native.tsx:166-208`; web: `team-list-web.tsx:196-238`.
- מציג: שם הצוות, `Strings.dashboard.approvalInviteText(creatorName)` (`"${creatorName} הזמין/ה אותך להצטרף כמנהל/ת שווה בצוות"`), כפתורי **אשר**/**דחה** (`approveTeamButton`/`declineTeamButton`) שקוראים `handleApproveTeam`/`handleDeclineTeam`.
- `creatorName` מחושב מ-`team.members.find(m => m.userId === team.creatorId)` — **אם `creatorMember` לא נמצא** (למשל אם ה-`members` array לא כלל אותו מסיבה כלשהי), `creatorName` נופל ל-`"@"` (string ריק אחרי `@`) — מקרה קצה שקשה להגיע אליו כי היוצר תמיד נוסף כחבר ב-`create`, אבל שווה לתעד כ-defensive code שלא נבדק.

### `isMyPendingTeam === true` → צ'יפ + כפתור ביטול (בתוך הכרטיס הרגיל של הצוות, לא כרטיס נפרד)
- native: `team-list-native.tsx:226-244`; web: `team-list-web.tsx:270-291`.
- מציג צ'יפ `Strings.dashboard.pendingApprovalFromLabel(team.pendingApprover?.email || '')` (`"ממתין לאישור מ-${email}"`) + כפתור `cancelPendingTeamButton` (`"בטל"`) שקורא ל-**`handleDeclineTeam`** (אותה פונקציה כמו "דחה" בכרטיס האישור — אין הבחנה ב-handler בין "אני מבטל כיוצר" ל"אני דוחה כמאשר", ההבדל הוא רק בטקסט הכפתור).
- אם `team.pendingApprover` הוא `undefined`/`null` (למשל אם ה-relation לא נכלל בתשובה) → מוצג `"ממתין לאישור מ-"` בלי מייל בכלל, בלי קריסה.

### שגיאות ו-loading (משותף לשני הכרטיסים, per-team, מבודד)
- `approvalErrors[teamId]` / `approvalLoadings[teamId]` — state מפתח לפי `teamId`, כך ששגיאה בצוות אחד לא דולפת לצוות אחר באותה רשימה.
- `handleApproveTeam`/`handleDeclineTeam` (native: `:40-68`; web: `:55-83`): `POST /teams/:id/approve|decline`, בהצלחה קוראים ל-`onAddMemberSuccess()` (=`() => token && fetchMyTeams(token)`, מוגדר ב-`app/index.tsx`) שמרענן את `GET /teams/user/me` ומעדכן את כל הרשימה — **אין עדכון אופטימי (optimistic update)**, יש רענון מלא מהשרת.
- בכישלון: `err.response?.data?.message || err.message || Strings.dashboard.teamActionFailedError` נשמר ב-`approvalErrors[teamId]` ומוצג כ-`Alert`/באנר אדום בתוך הכרטיס הרלוונטי.

### טופס `create-team-form.tsx`
ראה §5. שים לב שהטופס **לא** מוצג ב-`app/index.tsx` בפלטפורמת web כלל (רק native) — ב-web היוצר חייב לעבור דרך `/settings` כדי ליצור צוות. זו א-סימטריה מכוונת בין הפלטפורמות שכדאי לתעד כדי שטסט לא "יצפה" לטופס יצירה בדף הבית ב-web.

## 7. Cross-Cutting Flows

### Flow A — יצירת צוות מוצלחת עד אישור
1. [FE] `create-team-form.tsx`: משתמש ממלא שם + (אופציונלי) משרד + `approverEmail`; ולידציית client חוסמת שדות ריקים (§5).
2. [FE] `handleCreateTeamSubmit` (ב-`app/index.tsx` או `app/settings.tsx`) → `POST /teams {name, mainOffice, approverEmail}`.
3. [BE] בדיקות E1-E7 (§3); בהצלחה: `Team{PENDING_APPROVAL}` + `TeamMember` ליוצר.
4. [FE] בהצלחה: `app/index.tsx` סוגר את הטופס ומרענן `fetchMyTeams`; `app/settings.tsx` **לא** סוגר, מציג הודעת הצלחה מקומית `הצוות "${name}" ממתין לאישור של ${approverEmail}.` ומרענן `fetchAdminTeams` (⚠️ הבדל התנהגות בין שני העמודים — לתעד ולבדוק בנפרד).
5. [FE] בצד המאשר: בפעם הבאה ש-`GET /teams/user/me` נטען (login, רענון, ניווט), הצוות מופיע ברשימה שלו כ-`isMyApproval` → כרטיס אישור.
6. [FE] המאשר לוחץ "אשר" → `handleApproveTeam` → `POST /teams/:id/approve`.
7. [BE] בדיקות A1-A3 (§3); בהצלחה: טרנזקציה → `ACTIVE` + המאשר מתווסף כחבר.
8. [FE] רענון אוטומטי (`onAddMemberSuccess`) → אצל שני הצדדים (ברענון הבא) הצוות מופיע כרגיל, לא יותר עם כרטיס/צ'יפ מיוחדים.

### Flow B — ביטול/דחייה
1. [FE] היוצר (כרטיס צוות רגיל, צ'יפ "ממתין לאישור מ-X") או המאשר (כרטיס אישור, כפתור "דחה") לוחצים.
2. [FE] `handleDeclineTeam` → `POST /teams/:id/decline`.
3. [BE] בדיקות D1-D3 (§3); בהצלחה: מחיקה מלאה של Team + cascade.
4. [FE] רענון → הצוות נעלם משתי הרשימות (היוצר וגם המאשר, אם רענן).

### Flow C — ניסיון יצירה עם approverEmail לא-תואם-אותיות (ראה §9.1)
1. [FE] יוצר מזין `approverEmail = "NaveYadai@Gmail.com"` בעוד המשתמש בפועל רשום עם `"naveyadai@gmail.com"`.
2. [BE] E2 (allowlist check, lowercased) **עובר**.
3. [BE] E3 (`findUnique({email: dto.approverEmail})`, לא lowercased) **נכשל** — 404, למרות שמדובר באותו אדם בפועל.
4. [FE] היוצר רואה `"לא נמצא משתמש עם כתובת האימייל הזו..."` — הודעה מטעה, כי המשתמש כן קיים, רק case לא תואם.

## 8. Edge Cases / Test Scenarios

**יצירת צוות**
1. Given שם+משרד+approverEmail תקינים ב-allowlist, When `POST /teams`, Then 201 + Team `PENDING_APPROVAL` + יוצר כחבר TEAM_LEADER/admin. `[unit-BE][e2e]`
2. Given `approverEmail` באותיות גדולות/מעורבות שתואם ל-allowlist אחרי lowercase **אך לא תואם בדיוק לרשומת ה-DB** (case-sensitive lookup), Then 404, לא 201 — ראו Flow C. **זו תקלה אמיתית שכדאי לבדוק קודם כל.** `[unit-BE][e2e]`
3. Given `approverEmail` לא נשלח כלל, Then קריסה לא-מבוקרת → 500 (לא 400 "clean"). `[unit-BE]`
4. Given `approverEmail` תקין+קיים אבל שווה לאימייל היוצר עצמו, Then 409. `[unit-BE]`
5. Given `name` לא נשלח כלל, Then קריסה לא-מבוקרת → 500. `[unit-BE]`
6. Given `name` נשלח כמחרוזת ריקה/רווחים, Then נוצר בהצלחה עם שם ריק (ה-FE חוסם את זה, אבל קריאה ישירה ל-API לא). `[unit-BE]`
7. Given `mainOffice` הושמט, Then נוצר בהצלחה עם `mainOffice: null`. `[unit-BE]`
8. FE: שם/מייל ריקים חוסמים submit לפני קריאת API, עם ההודעות המדויקות מ-§5. `[unit-FE]`
9. FE: `err.message` מוצג ב-`localError` אחרי כישלון POST — לוודא שה-message שמגיע מה-API (`err.response.data.message`) אכן מגיע ל-`err.message` בשרשרת ה-`throw err` (ב-`app/index.tsx`/`app/settings.tsx`) → `onSubmit` → `create-team-form.tsx` catch. `[unit-FE]`
10. FE web vs native: הטופס לא מוצג בכלל בדף הבית ב-web (רק דרך `/settings`) — לוודא שההבדל הזה מכוון ולא רגרסיה. `[unit-FE]`

**אישור**
11. Given `teamId` לא קיים, Then 404. `[unit-BE]`
12. Given המבקש אינו ה-pendingApprover (כולל: היוצר עצמו מנסה לאשר), Then 403. `[unit-BE]`
13. Given אישור מוצלח: לוודא אטומיות — Team מקבל `status:'ACTIVE'` **ו-** `pendingApproverId:null` **ו-** TeamMember נוצר, שלושתם יחד או אף אחד. `[unit-BE]`
14. Given ניסיון אישור שני (סדרתי) על ידי אותו מאשר אחרי שכבר אושר, Then 403 (**לא** 409 — ראה §3 A2/A3). `[unit-BE]`
15. Given שני קריאות approve כמעט-מקבילות (race), Then להריץ בפועל מול DB אמיתי ולתעד את מה שקורה בפועל — לפי קריאת הקוד (§9.2) הצפי הוא unique-constraint violation לא-מטופל (500), **לא** 409 מסודר; זו הנחה שצריכה אימות אמפירי, לא רק ניתוח קוד. `[unit-BE][e2e]`
16. FE (native+web בנפרד): `isMyApproval` מציג כרטיס אישור רק למאשר הנכון; אחרי success, הרשימה מתעדכנת דרך רענון מלא (`onAddMemberSuccess`), לא עדכון אופטימי. `[unit-FE]`
17. FE: `approvalErrors[teamId]` מבודד — שגיאה בצוות אחד לא משפיעה על כרטיס של צוות אחר באותה רשימה. `[unit-FE]`

**דחייה**
18. Given `teamId` לא קיים, Then 404. `[unit-BE]`
19. Given המבקש לא יוצר ולא pendingApprover, Then 403. `[unit-BE]`
20. Given היוצר מבטל צוות `PENDING_APPROVAL` משלו, Then 201 + מחיקה מלאה. `[unit-BE][e2e]`
21. Given המאשר דוחה צוות שהוזמן אליו, Then 201 + מחיקה מלאה. `[unit-BE][e2e]`
22. Given היוצר מנסה "לבטל" צוות שכבר `ACTIVE` (כבר אושר), Then 409 "הצוות כבר אושר" — התרחיש היחיד שבו D3 נגיש בפועל (§3). `[unit-BE]`
23. Given מחיקת צוות, Then כל שורות `TeamMember` (כולל של היוצר שנוצרה מיד ביצירה), `Sprint`, `Comment` הקשורות נמחקות ב-cascade — לוודא שאין שורות יתומות. `[unit-BE]`
24. FE: היוצר רואה צ'יפ "בטל" (לא כרטיס אישור מלא), המאשר רואה כרטיס עם כפתור "דחה" — לוודא ששני ה-UI states לא מתערבבים לאותו משתמש על אותו צוות (בלתי אפשרי מבחינה לוגית כי `isMyApproval`/`isMyPendingTeam` מוגדרים הדדית-בלעדיים דרך `creatorId`≠`pendingApproverId` שנאכף ב-E4, אבל שווה טסט מפורש). `[unit-FE]`
25. FE: אחרי decline, הצוות נעלם גם מרשימת היוצר וגם מרשימת המאשר (שניהם דרך `GET /teams/user/me` בנפרד). `[unit-FE][e2e]`

**`GET /teams/user/me`**
26. Returns גם חברויות (`roleInTeam` ממולא) וגם אישורים ממתינים (`roleInTeam: null`) — לוודא shape מדויק. `[unit-BE]`
27. משתמש שהוא בו-זמנית יוצר של צוות אחד וממתין-לאישורו בצוות אחר — שניהם מופיעים נכון בלי בלבול. `[unit-BE][e2e]`

**auth חוצה-endpoints**
28. כל שבעת ה-endpoints (`POST /teams`, `:id/approve`, `:id/decline`, `:id/members`, `GET /:id/members`, `GET user/me`, `PATCH .../members/:id`, `PATCH /:id`) דוחים בקשה בלי/עם טוקן פגום — כולם קוראים `validateToken` ידנית, לוודא שאף אחד לא "נשכח" (401 `'Missing authorization header'` או `'Invalid token'`, ראה `00-shared-conventions.md` §3.1 — לעולם לא `'User not found'`). `[unit-BE]`

## 9. Known Discrepancies & Risks

כל הפריטים כאן מתועדים בלבד — לא לתקן בשלב הזה.

1. **[עודכן 2026-09-11, STATUS: Fixed]** Case-mismatch בין allowlist-check ל-DB lookup ב-`POST
   /teams` — **כבר לא קיים**. `teams.service.ts::create` משתמש היום ב-
   `findFirst({where:{email:{equals: dto.approverEmail, mode:'insensitive'}}})`, לא ב-
   `findUnique` case-sensitive כפי שתועד כאן במקור. **תיעוד היסטורי, לא לסמוך עליו יותר** —
   Flow C (§8) ו-test case #2 (§8) שמתארים את הבאג הזה **גם הם כבר לא נכונים**, צריך עדכון
   נפרד אם מישהו כותב טסטים לאזור הזה. בנוסף (פיצ'ר 7 §7.4 fallout, 2026-09-11): מאז ש-
   `User.email` הפסיק להיות `@unique` (כדי לאפשר קישור Google), אותו lookup קיבל גם
   `orderBy:{id:'asc'}` דטרמיניסטי — בלי זה, אם אי-פעם שתי שורות `User` יחלקו את אחת מכתובות
   `ALLOWED_APPROVER_EMAILS`, הבחירה ביניהן הייתה תלוית סדר-סריקה של ה-DB, לא דטרמיניסטית. ר.
   `00-shared-conventions.md` §"PATCH /auth/profile" לפירוט המלא של תוספת §7.4.
2. **A3 (`ConflictException` באישור כפול) הוא dead code בזרימה סדרתית**, ומתחת לרייס אמיתי כנראה זורק unique-constraint violation לא-מטופל (500) במקום 409 מסודר, כי הבדיקה (`findUnique`) והפעולה (`$transaction`) לא אטומיות יחד. STATUS: Bug candidate.
3. **אין ולידציית runtime על גוף הבקשה בכלל** (`CreateTeamDto`/`AddMemberDto`/`UpdateMemberDto` בלי class-validator, בלי `ValidationPipe` ב-`main.ts`) — שדות חסרים גורמים ל-500 גולמי (E1, E5) במקום 400 מסודר. STATUS: Bug candidate.
4. **`ALLOWED_APPROVER_EMAILS` קשיח בקוד**, לא DB/env-driven — הוספת מאשר שלישי דורשת שינוי קוד + דיפלוי. STATUS: Bug candidate (config risk).
5. **אם ה-pendingApprover נמחק מהמערכת** (`onDelete: SetNull`), הצוות נשאר `PENDING_APPROVAL` לצמיתות בלי אף אחד שיכול לאשר אותו (רק היוצר עדיין יכול לדחות/לבטל, כי decline בודק `creatorId` **או** `pendingApproverId`, וה-creatorId עדיין תקף). STATUS: Bug candidate (orphaned-team risk) — אין מנגנון "בחר מאשר חדש".
6. **`addMember` בודק `role === 'TEAM_LEADER'`, בעוד `updateMember`/`updateTeam` בודקים `isAdmin === true`** — שני מסלולי הרשאה שונים לגמרי באותו מודול; חבר עם `isAdmin:true` אבל `role !== 'TEAM_LEADER'` (מצב אפשרי — הם שדות עצמאיים ב-`TeamMember`) לא יוכל להוסיף חברים, למרות שהוא "מנהל". STATUS: Bug candidate (inconsistent authorization).
7. **`GET /teams/:id/members` לא בודק חברות בצוות בכלל** (רק טוקן תקין) — כל משתמש מחובר יכול לראות רשימת חברים של כל צוות בעזרת ה-id שלו. STATUS: Bug candidate (access-control gap).
8. **לוגיקת approve/decline/derived-state כפולה במלואה** בין `team-list-native.tsx` ל-`team-list-web.tsx` — כל שינוי עתידי חייב להיעשות בשני מקומות; אין הבטחה ששניהם יישארו מסונכרנים. STATUS: Bug candidate (maintenance risk); ראה גם §6.
9. **`creatorName` נופל בשקט ל-`"@"` אם `creatorMember` לא נמצא** (§6) — defensive code שאף פעם לא נבדק, כי בפועל היוצר תמיד קיים ב-`members`. STATUS: Intentional-but-verify.
10. **א-סימטריה בין `app/index.tsx` (סוגר טופס+מרענן ישירות) ל-`app/settings.tsx` (משאיר טופס פתוח, מציג הודעת הצלחה טקסטואלית)** אחרי יצירת צוות מוצלחת — לא ברור אם זו כוונה מוצרית או חוסר-תשומת-לב. STATUS: Open question, ראה §10.

## 10. Open Questions

- האם ההבדל בין התנהגות `app/index.tsx` ל-`app/settings.tsx` אחרי יצירת צוות מוצלחת (§9.10) מכוון?
- האם יש כוונה עתידית לאפשר בחירת מאשר-חדש לצוות "יתום" (§9.5), או שזה תרחיש שפשוט לא נלקח בחשבון?
- מהי ההתנהגות הרצויה בפועל תחת race condition באישור כפול (§9.2) — 409 מסודר, idempotent success, או שהמצב הנוכחי (קריסה לא-מבוקרת) מקובל כי הסבירות למקרה נמוכה?
