## פיצ'ר 9: חברי צוות פנטום (Phantom Members) — מאופיין במלואו, מוכן למימוש — טרם הותחל

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `User.isPhantom Boolean @default(false)` (חדש — פנטום הוא שורת `User` אמיתית עם `password:null`, לא `TeamMember.userId` nullable); `Comment.postedByAdminId Int?` (FK ל-`User`, `onDelete: SetNull`); `TeamInvite.convertsMemberId Int?` (FK ל-`TeamMember`, cascade).
- **Backend:** `backend/src/teams/teams.service.ts` (יצירת פנטום), `backend/src/comments/comments.service.ts::create` (פרסום "בשם", `postedByAdminId` + `isAnonymous:false` נכפה), `backend/src/invites/invites.service.ts` (endpoint המרה חדש `consume-phantom-conversion`, נפרד מ-`consumeInvite` הקיים), guard אחיד — `assertCanManageTeamContent` (`team-permissions.util.ts`) לשלושת הפעולות.
- **Frontend:** `team-card.tsx`, `add-member-form.tsx`, `invite-links-panel.tsx`, `sprint-retro-board-web.tsx`/`-native.tsx` (UI פרסום-בשם).
- **Endpoints:** חדשים (טרם ממומשים) — יצירת פנטום, פרסום-בשם, `POST /invites/:token/consume-phantom-conversion`.
- **נוגע ישירות ב-`Comment` וב-`User`** — כל פיצ'ר שקורא/מציג תגובות (1, 2, 3, 8) צריך להתחשב בשדה `postedByAdminId` החדש והאינדיקציה הנלווית אליו; כל פיצ'ר שקורא `User` (7 — Google sign-in) צריך להיות מודע לכך ש-`isPhantom:true` הוא עוד מצב "משתמש בלי סיסמה אמיתית" נוסף על משתמשי-Google.


מטרת הפיצ'ר: לאפשר למנהל/ראש-צוות לייצג בלוח הרטרו אדם אמיתי שמסרב להירשם לאפליקציה, על ידי
יצירת "חבר צוות פנטום" — ולאחר מכן לפרסם בשמו (וגם בשם חברי צוות רשומים אמיתיים) תגובות רטרו,
עם סימון ברור שהתגובה הוזנה על ידי המנהל/ראש-הצוות ולא נכתבה ישירות. בנוסף, לאפשר שליחת קישור
הרשמה חד-פעמי **מתוך כרטיס הפנטום עצמו**, שהופך אותו לחבר רשום אמיתי תוך שמירה על כל ההיסטוריה
שלו (כולל תגובות שהוזנו בשמו).

### 9.0 החלטות

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול את נוה עליהן):**

1. **צורת המבנה של "חבר פנטום" — שורת `User` אמיתית עם `password: null`, בלי `googleId`,
   ושדה חדש `isPhantom Boolean @default(false)`.** הוחלט **לא** להפוך את `TeamMember.userId`
   ל-nullable (שינוי חוצה-מודולים ומסוכן — נוגע ב-`teams.service.ts`, `comments.service.ts`,
   `invites.service.ts`, בכל מקום שמניח `userId` קיים). במקום זה: `TeamMember`+`Comment.authorId`
   נשארים **בדיוק כפי שהם היום** (schema.prisma:132-145, 182-197) — פנטום הוא פשוט `User` שאין
   לו דרך התחברות בפועל. יש כבר תקדים בקוד ל"`User` בלי סיסמה רגילה" — `User.password` כבר
   `String?` מאז פיצ'ר 7 (למשתמשי Google, schema.prisma:19-22). `username` (`@unique`, חובה)
   ייווצר אוטומטית בשרת (למשל `phantom_${crypto.randomBytes(8).toString('hex')}`, אותו דפוס
   בדיוק כמו טוקן ב-`invites.service.ts::createInvite` שורה 59) — לא מוזן ולא מוצג למשתמש;
   `firstName`/`lastName` הם מה שהמנהל מזין ומה שמוצג בפועל בכל מקום (אותו דפוס תצוגה כמו חבר
   רגיל, `getCommentAuthorName` ב-`frontend/src/features/retro/comment-display.ts`).
   **[הוסף 2026-09-14, ביקורת חוצה-פיצ'רים]:** `User.email` הוא שדה **חובה** ב-schema
   (`email String`, לא `String?`) — גם אחרי שההסרה של `@unique` (פיצ'ר 7) הפכה אותו
   ללא-ייחודי, הוא עדיין לא-nullable. בלי ערך, `prisma.user.create` יזרוק שגיאת validation
   מיידית. ברירת מחדל טכנית: `email` = username עם סיומת `@phantom.local` (למשל
   `phantom_a1b2c3d4@phantom.local`) — נגזר דטרמיניסטית מאותו username אקראי-וכבר-ייחודי,
   לא נחשף בשום UI (בדיוק כמו ה-username עצמו), ולא דורש בדיקת-התנגשות נפרדת כי הוא נגזר
   משדה שכבר `@unique`.
   **תוצאת לוואי חשובה של הבחירה הזו:** מכיוון ש-`Comment.authorId` וגם `TeamMember.userId`
   ממשיכים להצביע על **אותה שורת `User`** גם לפני וגם אחרי ההמרה (ר' סעיף 3 למטה) — **שאלת
   "מה קורה להיסטוריית התגובות אחרי המרה" נפתרת מאליה: שום דבר לא צריך להשתנות/להיות
   ממופה-מחדש**, כי ה-`id` לא משתנה. זו לא שאלה פתוחה יותר.
2. **מנגנון הזנה "בשם מישהו" — שדה חדש `Comment.postedByAdminId Int?`** (FK ל-`User`,
   `onDelete: SetNull` — לא `Cascade`, כדי שתגובה לא תימחק אם חשבון המנהל שהזין אותה יימחק
   מאוחר יותר; אותה גישה כמו `Team.pendingApproverId`/`SetNull`, schema.prisma:70-72).
   `Comment.authorId` **נשאר תמיד** "מי שהתגובה מיוחסת אליו" (הפנטום, או החבר האמיתי שבשמו
   הוזנה) — זה בדיוק אותו שדה ואותה סמנטיקה שכבר קיימת היום, בלי שינוי. `postedByAdminId`
   הוא שדה **נוסף**, `null` לתגובה רגילה שמישהו כתב בעצמו, וממולא רק כשמדובר בפרסום-בשם. דורש
   שם יחס (`@relation`) מפורש בשני הכיוונים ב-Prisma כי זו כבר הרלציה השנייה בין `Comment`
   ל-`User` (הראשונה — `authorId`/`author` — גם היא צריכה שם יחס מפורש ברגע שמוסיפים שנייה).
3. **קישור ההמרה בונה על `TeamInvite` הקיים (`backend/AGENTS.md`: "copy `invites`, not
   `teams`"), עם שדה חדש `TeamInvite.convertsMemberId Int?`** (FK ל-`TeamMember`, cascade) —
   כשהשדה הזה מוגדר, זהו קישור-המרה ולא קישור-הצטרפות רגיל. נעשה שימוש חוזר מלא במנגנון
   `token`/`expiresAt`/`isRevoked`/`reasonForInvalidity()` הקיים ב-`invites.service.ts` —
   `maxUses` נקבע תמיד ל-`1` (המרה שייכת בדיוק לפנטום אחד ספציפי, לא הגיוני יותר מפעם אחת),
   `email: null` תמיד (זהו קישור גנרי חד-פעמי בלי נעילה לכתובת — הפנטום מטבעו לא בהכרח נתן
   כתובת אימייל מראש). **זרימת ה-consume חייבת להיות שונה מ-`consumeInvite` הקיימת**: הקישור
   הרגיל (`POST /invites/:token/consume`) מניח שמישהו **כבר מחובר** (`AuthForm` קיים,
   `frontend/src/app/invite/[token].tsx`) ויוצר לו `TeamMember` **חדש**. כאן ההפך: אין חשבון
   קיים להתחבר איתו (`password: null`), וצריך ליצור username/email/password חדשים **על גבי
   שורת ה-`User` הקיימת** של הפנטום (`prisma.user.update`, לא `create`) — ולא ליצור
   `TeamMember` חדש בכלל (הוא כבר קיים). לכן: endpoint חדש (למשל `POST
   /invites/:token/consume-phantom-conversion`, גוף `{username, email, password, firstName?,
   lastName?}`, ללא `Authorization` header כי אין עדיין למי להשתייך), לא הרחבה של
   `consumeInvite` הקיים. בהצלחה: `isPhantom: false`, `password` מוצפן (`bcrypt.hash(...,
   10)`, אותו דפוס כמו `auth.service.ts::register` שורה 28), ומחזיר `accessToken` (אותו JWT
   payload shape כמו `register`/`login`) כדי שהמשתמש ייכנס ישירות בלי צעד login נפרד.
4. **בדיקת ייחודיות username/email בזמן ההמרה חייבת להחריג את שורת הפנטום עצמה** —
   `auth.service.ts::register` (שורות 14-26) בודק `findFirst({OR:[{username},{email}]})` בלי
   סינון `id` — העתקת הבדיקה הזו כמו-שהיא תיכשל תמיד על הפנטום עצמו (הוא כבר "תופס"
   username/email משהו, גם אם רנדומלי). צריך `NOT: {id: phantomUserId}` בבדיקה.
5. **חברי פנטום מופיעים בכל מקום שרשימת חברי צוות מופיעה היום** (`TeamMemberRow`, ספירת
   `membersHeader`, בדיקת-כפילות ב-`POST /teams/:teamId/members`) בלי הסתרה — רק עם תג/badge
   מבחין ("לא רשום"/"פנטום"). לא התבקש להסתיר אותם, ולא סביר טכנית להסתיר "חצי" (הם
   `TeamMember` רגיל לכל דבר).

**החלטות מוצריות (נוה, 2026-09-11) — כל 5 השאלות הפתוחות הקודמות נענו, אין יותר שאלות פתוחות:**

1. **הרשאה (guard) — אחידה לכל שלוש הפעולות.** יצירת חבר פנטום, פרסום תגובה "בשם" מישהו
   (פנטום או חבר אמיתי), ושליחת קישור ההמרה — כולן `isAdmin===true || role==='TEAM_LEADER'`,
   כלומר `assertCanManageTeamContent` (`backend/src/teams/team-permissions.util.ts:8-15`)
   בדיוק כמו שהוא, בלי guard נפרד לאף אחת מהשלוש. להשתמש בו ישירות משלושת המקומות.
2. **פרסום "בשם" לא יכול להיות אנונימי — `isAnonymous` לא זמין/רלוונטי בזרימה הזו בכלל.**
   מכיוון שכך, אין קונפליקט עם המיסוך הקיים ל-`isAnonymous` (`comments.service.ts::
   getCommentsForSprint`, שורות 94-108) — האינדיקציה "הוזן בשם X" **תמיד גלויה לכולם**
   (לא רק למנהלים/ראשי-צוות), בדיוק כמו תגובה רגילה לא-אנונימית. ה-backend חייב לאכוף את
   זה בעצמו (לא לסמוך על שה-frontend פשוט לא מציג את הצ'קבוקס) — כשמגיע `onBehalfOfUserId`,
   `isAnonymous` נכפה ל-`false` בשרת בלי קשר למה שנשלח בגוף הבקשה.
3. **זהות המזין מוצגת במפורש, תמיד.** האינדיקציה מציינת **איזה** מנהל/ת או ראש/ת-צוות ספציפי
   הזין כל תגובה בפועל (שם מלא/שם משתמש של `postedByAdmin`, אותו דפוס תצוגה כמו `author` היום
   — `getCommentAuthorName`) — לא ניסוח גנרי. גם אם כמה מנהלים שונים מזינים תגובות שונות בשם
   אותו פנטום/חבר לאורך זמן, כל תגובה מציגה את המזין הספציפי שלה (השדה `postedByAdminId` הוא
   per-comment ממילא, ר' החלטה טכנית #2 למעלה — זה בדיוק מה שמאפשר את זה בלי שינוי נוסף).
4. **פרסום "בשם" חבר רשום אמיתי — יכולת מנהל טהורה, בלי הסכמה/הודעה.** אין שום דרישה
   להתראה/אישור מצד החבר שבשמו מתפרסמת התגובה — מנהל/ראש-צוות יכול לעשות זאת בלי ידיעתו.
5. **מותר לתת ל-חבר פנטום `TEAM_LEADER`/`isAdmin: true` עוד לפני המרה, בלי guard נוסף.**
   חבר פנטום הוא `TeamMember` רגיל לכל דבר (ר' החלטה טכנית #1) — מסכי עריכת-חבר הקיימים
   (`PATCH /teams/:teamId/members/:memberId`) כבר תומכים בזה כמו שהם, בלי שום שינוי קוד
   נדרש כדי "לאפשר" את זה. **חשוב:** זה אומר שאם חבר פנטום כבר `TEAM_LEADER`/`isAdmin`, הוא
   (התיאורטית) גם עובר את `assertCanManageTeamContent` — אבל בפועל הוא לא יכול לבצע שום
   פעולה כי אין לו דרך להתחבר (`password: null`) עד המרה; זה לא סיכון אמיתי, רק הערה
   לתיעוד.

### ממצאי מחקר

- **`Comment.authorId Int`** (חובה, FK ל-`User`, `onDelete: Cascade`) ו-**`TeamMember.userId
  Int`** (חובה, FK ל-`User`) — שניהם non-nullable היום (`backend/prisma/schema.prisma:132-145,
  182-197). אין שום מושג "חבר בלי חשבון" קיים במודל — זה בדיוק מה שהחלטה 9.0.1 באה לפתור בלי
  לשנות את שני השדות האלה.
- **`User.password String?`** כבר nullable (schema.prisma:22, מפיצ'ר 7) — יש תקדים ישיר
  לחשבון "לא-פעיל להתחברות" בקוד הזה. `User.email` הפסיק להיות `@unique` (פיצ'ר 7 decision
  #3) — כלומר גם אם המרת פנטום תיצור זמנית email שכבר "כמעט" קיים אצל מישהו אחר (לא זהה),
  אין קונפליקט DB; ה-`@unique` היחיד שנשאר על `User` הוא `username`.
- **`assertCanManageTeamContent`** (`backend/src/teams/team-permissions.util.ts:8-15`) —
  `isAdmin===true || role==='TEAM_LEADER'` — כבר קיים ומשמש פיצ'ר 2 (הדגשת הערות) ופיצ'ר 3
  (קטגוריות). **נבחר (החלטה מוצרית #1) כ-guard האחיד לשלוש הפעולות** של הפיצ'ר הזה — יצירת
  פנטום, פרסום-בשם, ושליחת קישור המרה.
- **`invites.service.ts`/`TeamInvite`** (schema.prisma:79-95) — הדפוס המלא-ביותר בקוד ל"קישור
  חד-פעמי לפעולה פר-צוות": `token` (`crypto.randomBytes(24).toString('hex')`), `expiresAt?`,
  `maxUses?`, `useCount`, `isRevoked`, ו-`reasonForInvalidity()` (שורות 25-30) שמאחד את בדיקת
  התוקף בין `getInvite` (ציבורי) ל-`consumeInvite`. **חשוב:** `consumeInvite` הקיים
  (שורות 133-178) מניח **תמיד** שהצד הצורך הוא משתמש מחובר קיים שמקבל `TeamMember` **חדש** —
  לא מתאים כמו-שהוא לזרימת המרה (ר' החלטה 9.0.3), דורש endpoint/מתודה נפרדים.
- **`frontend/src/app/invite/[token].tsx`** — עמוד ה-consume הקיים: `GET /invites/:token`
  לבדיקת תוקף, ואז אם המשתמש כבר מחובר (`useAuth().token`) — צריכה אוטומטית ל-`POST
  /invites/:token/consume`; אחרת מציג `<AuthForm>` (הרשמה/התחברות רגילה) ואז צורך אוטומטית
  ברגע שיש טוקן. **זרימת המרת-פנטום לא יכולה להשתמש ב-`<AuthForm>` הרגיל** (הוא רושם משתמש
  **חדש**, לא ממלא פרטי-התחברות על שורת `User` **קיימת**) — יידרש ענף UI נפרד בעמוד הזה,
  שמזוהה לפי שדה חדש בתשובת `GET /invites/:token` (למשל `type: 'join' | 'phantomConversion'`
  + `prefill: {firstName, lastName}` שמגיע מה-`TeamMember`/`User` המקוריים של הפנטום).
- **`team-card.tsx`** (`frontend/src/features/teams/components/team-list-web/team-card.tsx`)
  — `isTeamAdmin` כבר מחושב מ-`myMembership?.isAdmin` (שורה 29) ומועבר בתנאי ל-`AddMemberForm`
  (שורות 119-127) ול-`InviteLinksPanel` (שורות 129-131) — בדיוק אותה נקודת השחלה טבעית לפאנל
  "הוספת חבר פנטום" חדש/כפתור בכרטיס הפנטום ("שלח קישור הרשמה") שהרעיון מבקש.
- **`add-member-form.tsx`** (אותה תיקייה) — טופס "הוספת חבר" קיים, `POST
  /teams/:teamId/members`, כולל `RoleSelectorChips` לבחירת `role`. דפוס ישיר להעתיק/להרחיב
  ליצירת חבר פנטום (שדות שם פרטי/משפחה במקום username, בלי email).
- **`sprint-retro-board-web.tsx`** — `myMembership`/`canHighlight` כבר מחושבים בדיוק לפי
  הדפוס הדרוש (שורות 124-125: `team.members?.find(m => m.userId === user.id)`) — אותה טכניקה
  משמשת ליצירת `canPostOnBehalf` חדש. טופס כתיבת התגובה (`handlePostComment`, שורות 80-110)
  שולח `POST /sprints/:sprintId/comments` עם `content, type, category, isAnonymous` — צריך
  שדה נוסף `onBehalfOfUserId?` באותה בקשה, לא endpoint נפרד.
- **`CreateCommentDto`** (`backend/src/comments/dto/comments.dto.ts`) — כרגע `{content, type,
  category?, isAnonymous?}` בלי decorators (כרגיל בפרויקט הזה — ראה `backend/AGENTS.md`
  "DTOs — no runtime validation"). שדה `onBehalfOfUserId?: number` מתווסף באותו סגנון.
- **`comments.service.ts::create`** (שורות 10-54) — כרגע `authorId` תמיד `= requesterId`
  (המשתמש המזוהה מהטוקן). כדי לתמוך ב"בשם", הלוגיקה צריכה להסתעף: אם `dto.onBehalfOfUserId`
  קיים — לבדוק `assertCanManageTeamContent` (החלטה מוצרית #1), לוודא שהמטרה היא `TeamMember`
  באותו `teamId` (כולל פנטום — הוא `TeamMember` רגיל), ואז `authorId: dto.onBehalfOfUserId,
  postedByAdminId: requesterId, isAnonymous: false` (נכפה, ר' החלטה מוצרית #2) במקום
  `authorId: requesterId`.
- **`getCommentsForSprint`** (שורות 56-109) — כבר מחזיר spread מלא + `author` נבחר ידנית
  (`select: {id, username, firstName, lastName}`) — יצטרך גם `postedByAdmin` (`select` דומה)
  ו-`author.isPhantom`. **אין צורך בשום היגיון מיסוך נוסף** (החלטה מוצרית #2 — פרסום-בשם
  לא יכול להיות אנונימי בכלל, אז אין מצב שבו `postedByAdminId` מלא **וגם** `isAnonymous`
  מלא על אותה תגובה) — `postedByAdmin` פשוט מוחזר תמיד-כשקיים, גלוי לכולם, כמו `author`.
- **`comment-card-web.tsx`**/`renderCommentCard` (native, `sprint-retro-board-native.tsx`
  ~138-183) — קומפוננטות תצוגה טהורות, בלי שום מנגנון badge/indicator מלבד `isHighlighted`
  (פיצ'ר 2) — צריך badge חדש דומה מבנית (`Icon`+טקסט, `t.color.accent`/דומה מהטוקנים)
  לאינדיקציית "הוזן בשם" — תמיד גלוי כש-`comment.postedByAdmin` קיים, מציג את שם המזין
  הספציפי (החלטה מוצרית #3), לא ניסוח גנרי.

### 9.1 Backend

- [ ] `backend/prisma/schema.prisma`: `User.isPhantom Boolean @default(false)`; `Comment.
      postedByAdminId Int?` + יחס בשם מפורש (`@relation("CommentPostedByAdmin", fields:
      [postedByAdminId], references: [id], onDelete: SetNull)`, וגם לשנות את היחס הקיים
      `author`/`authorId` לשם מפורש כמו `@relation("CommentAuthor", ...)` כי יש עכשיו שני
      יחסים בין `Comment` ל-`User`); `TeamInvite.convertsMemberId Int?` + `@relation(fields:
      [convertsMemberId], references: [id], onDelete: Cascade)` אל `TeamMember` (וגם רלציית
      `convertInvites TeamInvite[]` הפוכה ב-`TeamMember`). `npx prisma db push` מול
      `postgres-test` ישירות מותר; מול Neon האמיתי — **לבקש אישור מפורש מנוה קודם** (ר'
      `backend/AGENTS.md` "Database").
- [ ] `backend/src/teams/teams.service.ts`: מתודה חדשה `createPhantomMember(teamId, dto:
      {firstName, lastName?, role?}, requesterId)` — guard `assertCanManageTeamContent`
      (החלטה מוצרית #1); יוצרת `User` חדש (`username: 'phantom_' + crypto.randomBytes(8).
      toString('hex')`, `email: \`${username}@phantom.local\`` — **חובה, ר' ברירת מחדל
      טכנית #1 למעלה, בלי זה `prisma.user.create` יזרוק** —, `password: null`,
      `isPhantom: true`, `firstName`, `lastName`) **וגם**
      `TeamMember` (`role: dto.role || 'DEVELOPER'`, `isAdmin: false`, `status: 'ACTIVE'`) —
      nested write אחד כמו `POST /teams` היום עושה ל-creator (`teams.service.ts::create`).
      Endpoint חדש: `POST /teams/:teamId/phantom-members` (`teams.controller.ts`).
- [ ] `backend/src/comments/dto/comments.dto.ts`: `CreateCommentDto.onBehalfOfUserId?:
      number` חדש.
- [ ] `backend/src/comments/comments.service.ts::create`: אם `dto.onBehalfOfUserId` קיים —
      guard `assertCanManageTeamContent` (החלטה מוצרית #1, אותו guard בדיוק כמו יצירת
      פנטום), לוודא ש-`onBehalfOfUserId` הוא `TeamMember` באותו `teamId` של הספרינט (כמו
      הבדיקה הקיימת על `authorId` היום, שורות 19-30), ואז `data: {..., authorId:
      dto.onBehalfOfUserId, postedByAdminId: requesterId, isAnonymous: false}` (**`isAnonymous`
      נכפה ל-`false` בשרת, בלי קשר למה שנשלח בגוף הבקשה** — החלטה מוצרית #2: פרסום-בשם לא
      יכול להיות אנונימי, האכיפה חייבת להיות server-side, לא רק frontend שלא מציג את
      הצ'קבוקס) במקום `authorId: requesterId`. תגובה רגילה (בלי `onBehalfOfUserId`) ממשיכה
      בדיוק כמו היום, כולל `isAnonymous` הרגיל.
- [ ] `getCommentsForSprint`: להוסיף `postedByAdmin` (`select: {id, username, firstName,
      lastName}`, אותו shape כמו `author`) ו-`author.isPhantom` ל-`select`/`include` הקיים.
      **בלי שום היגיון מיסוך נוסף** — החלטה מוצרית #2 מבטיחה שאין מצב של `postedByAdminId`
      מלא יחד עם `isAnonymous===true` על אותה תגובה, כך שהמיסוך הקיים ל-`isAnonymous`
      (שורות 94-108) ממשיך לעבוד בדיוק כמו היום, בלי לגעת בו. `postedByAdmin` מוחזר תמיד
      כשקיים, גלוי לכל חברי הצוות (החלטה מוצרית #2).
- [ ] `backend/src/invites/dto/invites.dto.ts` + `invites.service.ts`: מתודה חדשה
      `createPhantomConversionInvite(teamId, phantomMemberId, requesterId)` — guard
      `assertCanManageTeamContent` (החלטה מוצרית #1); יוצרת `TeamInvite{token, teamId,
      convertsMemberId: phantomMemberId, email: null, maxUses: 1, createdById: requesterId,
      expiresAt: לפי קלט אופציונלי כמו קישורים רגילים}`. Endpoint: `POST /teams/:teamId/
      phantom-members/:memberId/conversion-invite` (או דומה — לתעד את הבחירה הסופית
      ב-controller).
- [ ] מתודה חדשה `consumePhantomConversionInvite(token, dto: {username, email, password,
      firstName?, lastName?})` ב-`invites.service.ts` — **לא** להרחיב את `consumeInvite`
      הקיים. שימוש חוזר ב-`reasonForInvalidity()` הקיים לבדיקת תוקף. מוודא
      `invite.convertsMemberId` קיים ושה-`TeamMember`/`User` המקושרים עדיין `isPhantom:
      true` (לא הומר כבר — אחרת `ConflictException`). בודק ייחודיות `username`/`email` **תוך
      החרגת שורת הפנטום עצמה** (`NOT: {id: phantomUserId}` — ר' החלטה 9.0.4, שונה מ-
      `auth.service.ts::register` הקיים ששם אין החרגה כזו כי הוא תמיד `create`, לא `update`).
      `prisma.user.update({where:{id: phantomUserId}, data: {username, email, password:
      await bcrypt.hash(dto.password, 10), firstName: dto.firstName ?? existing, lastName:
      dto.lastName ?? existing, isPhantom: false}})`, מסמן את ה-invite כמנוצל (`useCount:
      {increment:1}` כמו `consumeInvite`), ומחזיר `{accessToken, user}` באותו shape בדיוק כמו
      `auth.service.ts::register`/`login` (JWT `{sub, username, email}`, `expiresIn:'12h'`,
      `jwtSecret` זהה). Endpoint: `POST /invites/:token/consume-phantom-conversion` (בלי
      `Authorization` header — אין עדיין חשבון מחובר).
- [ ] `GET /invites/:token` (`getInvite`, `invites.service.ts:84-100`): להרחיב את התשובה עם
      `type: 'join' | 'phantomConversion'` ו-(אם `phantomConversion`) `prefill: {firstName,
      lastName}` נשלף מה-`User`/`TeamMember` המקושרים — כדי שה-frontend ידע להציג את הענף
      הנכון (ר' ממצאי מחקר על `[token].tsx`).

### 9.2 Frontend

- [ ] `team-card.tsx` (web+native): כפתור/פאנל "הוסף חבר פנטום" חדש. מוצג לפי `canManageTeamContent
      = myMembership?.isAdmin || myMembership?.role === 'TEAM_LEADER'` (**לא** `isTeamAdmin`
      הקיים לבדו, שהוא רק `isAdmin` — צריך משתנה חדש, אותו דפוס בדיוק כמו `canHighlight`
      ב-`sprint-retro-board-web.tsx` שורות 124-125, כדי לעמוד בהחלטה מוצרית #1) — דפוס דומה
      ל-`AddMemberForm` (טופס מוטבע/Collapse), שדות: שם פרטי (חובה)+שם משפחה (אופציונלי)+
      `RoleSelectorChips` קיים. `POST /teams/:teamId/phantom-members` בהצלחה מרענן את רשימת
      החברים (`onAddMemberSuccess` הקיים, אותו pattern כמו `AddMemberForm`).
- [ ] `TeamMemberRow` (`frontend/src/features/teams/components/team-list-web/
      team-member-row.tsx` + מקבילת native): badge חדש "לא רשום"/"פנטום" כש-`member.user.
      isPhantom === true` — דורש ש-`isPhantom` יגיע בפועל ב-`GET /teams/user/me`/`GET
      /teams/:id/members` (לוודא שאין `select` מצומצם על `User` ששומט את השדה, בדומה
      לבדיקה שנעשתה בפיצ'ר 2 על `isHighlighted`).
- [ ] כפתור "שלח קישור הרשמה" בכרטיס/שורת הפנטום (`TeamMemberRow` או קומפוננטה חדשה
      דומה ל-`InviteLinksPanel` אך ממוקדת לפנטום ספציפי אחד), מוצג לפי אותו `canManageTeamContent`
      (החלטה מוצרית #1) — `POST /teams/:teamId/phantom-members/:memberId/conversion-invite`,
      מציג/מעתיק את הקישור המתקבל (אותו `inviteUrl()`/UX-דפוס כמו `invite-links-panel.tsx`
      שורות 16-18, 94-111).
- [ ] `frontend/src/app/invite/[token].tsx`: ענף חדש כש-`GET /invites/:token` מחזיר
      `type: 'phantomConversion'` — **לא** מציג `<AuthForm>` הרגיל; במקום זה טופס ייעודי
      (username/email/password חדשים, עם `firstName`/`lastName` **מוצגים כ-prefill מתוך
      `prefill`** שחוזר מהשרת, לפי הבקשה המקורית) ששולח `POST /invites/:token/
      consume-phantom-conversion` (בלי `Authorization` header), ואז שומר את ה-`accessToken`
      המוחזר דרך `useAuth().login(...)` (אותו pattern כמו הרשמה/התחברות רגילה) ומנווט הביתה
      (אותו דפוס `window.location.href = '/'`/`router.replace('/')` שכבר קיים בקובץ, שורות
      54-61).
- [ ] `sprint-retro-board-web.tsx`/`-native.tsx`: `canPostOnBehalf` מחושב מ-`myMembership`
      (אותו דפוס בדיוק כמו `canHighlight`, שורות 124-125: `myMembership?.isAdmin ||
      myMembership?.role === 'TEAM_LEADER'`, החלטה מוצרית #1). כש-`true`, בורר נוסף בטופס
      כתיבת התגובה ("פרסם בשם:" — ברירת מחדל "אני", אחרת רשימת `team.members` כולל פנטומים,
      לפי שם) — נשלח כ-`onBehalfOfUserId` ב-`handlePostComment` (`POST
      /sprints/:sprintId/comments`). **כשנבחר יעד שונה מ"אני" (כלומר `onBehalfOfUserId`
      מוגדר), צ'קבוקס "אנונימי" הקיים בטופס מוסתר/מנוטרל לגמרי** (החלטה מוצרית #2 — פרסום-בשם
      לא יכול להיות אנונימי; ה-UI לא אמור אפילו להציע את זה, מעבר לאכיפה ב-backend).
- [ ] `comment-card-web.tsx` + `renderCommentCard` (native): badge/אינדיקציה חדשה, **תמיד
      גלויה לכל חברי הצוות** (החלטה מוצרית #2) כש-`comment.postedByAdmin` מוחזר מה-API —
      מציגה את שם המזין הספציפי (`getCommentAuthorName`-style על `postedByAdmin`, אותו דפוס
      תצוגה כמו `author` היום), למשל "הוזן/ה בשם {authorName} על ידי {postedByAdminName}"
      (ניסוח מדויק לבחור בזמן המימוש, אבל **חייב לנקוב בשם המזין הספציפי**, לא ניסוח גנרי —
      החלטה מוצרית #3). אין תלות ב-`isAnonymous` כאן כלל (לא רלוונטי לתגובות מהזרימה הזו).
- [ ] **[הוסף 2026-09-14, ביקורת חוצה-פיצ'רים עם פיצ'ר 8]: אותה אינדיקציה חייבת להגיע גם
      ללוח הזיכרון** (`memory-card-web.tsx`/`memory-card-native.tsx`,
      `frontend/src/features/retro/comment-display.ts`) — אלה נתיב תצוגה תקף לאותו `Comment`
      בדיוק, ופיצ'ר 8 (לוח זיכרון) לא מסונן לפי סוג-תגובה. החלטה מוצרית #3 קובעת "תמיד
      גלויה" בלי הגבלה לנתיב תצוגה מסוים — לכן `getCommentAuthorName`/הפונקציה המשותפת
      ב-`comment-display.ts` היא המקום הנכון להוסיף את הלוגיקה פעם אחת, כדי ששני נתיבי
      התצוגה (`comment-card-web.tsx` ולוח הזיכרון) ישתמשו באותה מקור-אמת ולא יסטו זה מזה.
- [ ] `Strings.teamList.*`/`Strings.retroBoard.*`/`Strings.invites.*`: מחרוזות עבריות חדשות
      (כותרת טופס יצירת פנטום, badge "לא רשום", כפתור "שלח קישור הרשמה", בורר "פרסם בשם",
      טקסט אינדיקציית "הוזן בשם {authorName} על ידי {postedByAdminName}", מסך ההמרה בעמוד
      ה-invite).
- [ ] `trackEvent()` על: יצירת חבר פנטום, שליחת קישור המרה, פרסום תגובה "בשם" מישהו, השלמת
      המרת פנטום לחשבון אמיתי — לפי הכלל הקבוע בפרויקט (ר' `feedback-frontend-track-events-
      required`).

### 9.3 בדיקות

- [ ] Playwright e2e: מנהל/ראש-צוות (`isAdmin` או `role==='TEAM_LEADER'`, החלטה מוצרית #1)
      יוצר חבר פנטום → מופיע ברשימת החברים עם badge מבחין; מפרסם תגובת KEEP/IMPROVE "בשמו"
      (בלי אפשרות לסמן אנונימי בטופס — לוודא שהצ'קבוקס מוסתר/מנוטרל, החלטה מוצרית #2) →
      התגובה מופיעה עם אינדיקציית "הוזן בשם" **שנוקבת בשם המנהל/ת הספציפי/ת שהזין** (החלטה
      מוצרית #3), גלויה גם למשתמש שני שהוא חבר-צוות רגיל (לא רק למנהלים — החלטה מוצרית #2);
      שולח קישור המרה מתוך כרטיס הפנטום, פותח את הקישור בהקשר דפדפן נקי (`browser.
      newContext()`, לא מחובר), ממלא טופס המרה (שם פרטי מוצג כ-prefill) → מועבר לחשבון אמיתי
      מחובר, והתגובות הישנות שהוזנו בשמו עדיין מוצגות תחת אותו שם (`authorId` לא השתנה) עם
      אותה אינדיקציית "הוזן בשם" כמו לפני ההמרה. חבר צוות רגיל (`DEVELOPER`, לא admin/leader)
      **לא** רואה את כפתורי יצירת פנטום/פרסום-בשם/שליחת קישור המרה בכלל (לא רק מוסתרים-אבל-
      קיימים).
- [ ] Jest (backend): `teams.service.spec.ts` (`createPhantomMember` — guard, יצירת
      User+TeamMember יחד, username ייחודי-אוטומטי), `comments.service.spec.ts`
      (`create` עם `onBehalfOfUserId` — guard, שיוך נכון של `authorId`/`postedByAdminId`,
      בדיקת שהמטרה חברה בצוות), `invites.service.spec.ts`
      (`createPhantomConversionInvite`/`consumePhantomConversionInvite` — תוקף/מיצוי/כפל-המרה
      חסום, ייחודיות username/email תוך החרגת הפנטום עצמו, `accessToken` מוחזר תקין).
- [ ] Jest (frontend) לרכיבי ה-UI החדשים (badge פנטום, בורר "פרסם בשם" כולל ניטרול צ'קבוקס
      "אנונימי" כשנבחר יעד שאינו "אני", אינדיקציית "הוזן בשם" עם שם המזין הספציפי).
- [ ] בדיקת מובייל — `Mobile Chrome` project ב-Playwright, עקבי עם כל שאר הפיצ'רים בבאקלוג.

### לא בטיפול (פיצ'ר 9)

- מחיקה/השבתה של חבר פנטום שטרם הומר — לא התבקש, אפשר להוסיף בעתיד כפעולה נפרדת.
- עריכת פרטי פנטום (שם) אחרי יצירה, לפני המרה — לא התבקש ב-MVP הזה.
- הגבלת מספר חברי פנטום לצוות — אין הגבלה, כמו שאין הגבלה על מספר חברים רגילים.
