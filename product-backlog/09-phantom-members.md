## פיצ'ר 9: חברי צוות פנטום (Phantom Members) — מומש ✅ (Backend §9.1 + Frontend §9.2 + בדיקות §9.3 כולם סגורים)

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `User.isPhantom Boolean @default(false)` (חדש — פנטום הוא שורת `User` אמיתית עם `password:null`, לא `TeamMember.userId` nullable); `Comment.postedByAdminId Int?` (FK ל-`User`, `onDelete: SetNull`); `TeamInvite.convertsMemberId Int?` (FK ל-`TeamMember`, cascade).
- **Backend:** `backend/src/teams/teams.service.ts` (יצירת פנטום), `backend/src/comments/comments.service.ts::create` (פרסום "בשם", `postedByAdminId` + `isAnonymous:false` נכפה), `backend/src/invites/invites.service.ts` (endpoint המרה חדש `consume-phantom-conversion`, נפרד מ-`consumeInvite` הקיים), guard אחיד — `assertCanManageTeamContent` (`team-permissions.util.ts`) לשלושת הפעולות.
- **Frontend:** `team-card.tsx`+`team-member-row.tsx` (web+native), `add-phantom-member-form.tsx`+`phantom-conversion-link.tsx` חדשים (web+native), `invite/[token].tsx` (ענף המרה חדש), `sprint-retro-board-web.tsx`/`-native.tsx` (בורר "פרסם בשם"), `comment-card-web.tsx`/`renderCommentCard`/`memory-card-web.tsx`/`memory-card-native.tsx`+`comment-display.ts` (אינדיקציית "הוזן בשם").
- **Endpoints:** ממומשים — `POST /teams/:teamId/phantom-members`, `POST /teams/:teamId/phantom-members/:memberId/conversion-invite`, `POST /invites/:token/consume-phantom-conversion`, `POST /sprints/:sprintId/comments` (עם `onBehalfOfUserId`).
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

- [x] `backend/prisma/schema.prisma`: `User.isPhantom Boolean @default(false)`; `Comment.
      postedByAdminId Int?` + יחס בשם מפורש (`@relation("CommentPostedByAdmin", ...)`), וגם
      שינוי היחס הקיים `author`/`authorId` לשם מפורש `@relation("CommentAuthor", ...)`;
      `TeamInvite.convertsMemberId Int?` + `@relation(..., onDelete: Cascade)` אל `TeamMember`
      + רלציית `convertInvites TeamInvite[]` הפוכה ב-`TeamMember`. `npx prisma db push`
      **הורץ מול `postgres-test` בלבד** (מותר ישירות) — **לא** הורץ מול Neon האמיתי; זה עדיין
      ממתין לאישור מפורש של נוה לפני שה-frontend/e2e האמיתיים יכולים לרוץ מול הדאטהבייס
      האמיתי.
- [x] `backend/src/teams/teams.service.ts::createPhantomMember` — guard
      `assertCanManageTeamContent`; יוצרת `User` (`username: phantom_<16-hex>`,
      `email: <username>@phantom.local`, `password: null`, `isPhantom: true`, `firstName`,
      `lastName`) **וגם** `TeamMember` (`role: dto.role || 'DEVELOPER'`, `isAdmin: false`,
      `status: 'ACTIVE'`) בכתיבה מקוננת אחת. Endpoint חדש `POST /teams/:teamId/phantom-members`
      (`teams.controller.ts`). DTO: `CreatePhantomMemberDto` (`teams/dto/teams.dto.ts`).
- [x] `backend/src/comments/dto/comments.dto.ts`: `CreateCommentDto.onBehalfOfUserId?: number`.
- [x] `backend/src/comments/comments.service.ts::create`: כשיש `dto.onBehalfOfUserId` —
      `assertCanManageTeamContent`, בדיקת `TeamMember` יעד באותו `teamId`
      (`NotFoundException` אם לא נמצא), `authorId: onBehalfOfUserId, postedByAdminId:
      requesterId, isAnonymous: false` (נכפה server-side בלי קשר לגוף הבקשה). זרימה רגילה
      (בלי `onBehalfOfUserId`) לא שונתה.
- [x] `getCommentsForSprint`: הוספת `postedByAdmin` (select זהה ל-`author`) ו-`author.
      isPhantom` ל-`select`. תגובה אנונימית ממשיכה למסך את ה-`author` בדיוק כמו קודם (הוספתי
      `isPhantom: false` גם לאובייקט ה-Anonymous הממוסך, לעקביות טיפוסים).
- [x] `backend/src/invites/dto/invites.dto.ts` + `invites.service.ts::
      createPhantomConversionInvite(teamId, phantomMemberId, dto, requesterId)` — guard
      `assertCanManageTeamContent`, מוודא שהחבר היעד קיים בצוות וש-`user.isPhantom===true`
      (אחרת `ConflictException`), יוצרת `TeamInvite{token, teamId, convertsMemberId, email:
      null, maxUses: 1, createdById, expiresAt}`. Endpoint: `POST /teams/:teamId/
      phantom-members/:memberId/conversion-invite` (`invites.controller.ts`).
- [x] `invites.service.ts::consumePhantomConversionInvite(token, dto)` — מתודה נפרדת, **לא**
      הרחבה של `consumeInvite`. `reasonForInvalidity()` הקיים לבדיקת תוקף; `ConflictException`
      אם לא קישור-המרה או אם הפנטום כבר הומר; בדיקת ייחודיות username/email עם `NOT:
      {id: phantomUserId}`; `prisma.user.update` על שורת הפנטום הקיימת (לא `create`),
      `isPhantom: false`, `password` מוצפן; `useCount: {increment:1}` על ה-invite; מחזיר
      `{accessToken, user}` באותו shape כמו `register`/`login`. Endpoint: `POST
      /invites/:token/consume-phantom-conversion` (`invites.controller.ts`, בלי
      `Authorization` header).
- [x] `GET /invites/:token` (`getInvite`): מחזיר עכשיו גם `type: 'join' | 'phantomConversion'`
      ו-`prefill: {firstName, lastName} | undefined` (מ-`convertsMember.user` כשמדובר בקישור
      המרה).

  Jest (backend) נכתבו/עודכנו כחלק מהמימוש (ר' 9.3 למטה): `teams.service.spec.ts`
  (`createPhantomMember`), `comments.service.spec.ts` (`create` עם `onBehalfOfUserId`),
  `invites.service.spec.ts` (`createPhantomConversionInvite`/`consumePhantomConversionInvite`
  + `getInvite` עם `type`/`prefill`) — כולם ירוקים, וגם כל שאר הסוויטה (`npm test`: 239/239,
  `npm run test:e2e`: 47/47, מול `postgres-test`).

### 9.2 Frontend

- [x] `team-card.tsx` (web+native): `canManageTeamContent = !!myMembership && (myMembership.
      isAdmin || myMembership.role === 'TEAM_LEADER')` חדש (נפרד מ-`isTeamAdmin` הקיים, שנשאר
      isAdmin-בלבד ומשמש רק את `AddMemberForm`/`InviteLinksPanel` הקיימים כפי שהם). כפתור/פאנל
      "הוסף חבר פנטום" חדש (`add-phantom-member-form.tsx`, web+native) — דפוס מוטבע/Collapse
      זהה ל-`AddMemberForm`, שדות שם פרטי (חובה)+שם משפחה (אופציונלי)+`RoleSelectorChips`
      קיים. `POST /teams/:teamId/phantom-members` בהצלחה מרענן דרך `onAddMemberSuccess` הקיים.
- [x] `TeamMemberRow` (web+native): badge "לא רשום" כש-`member.user.isPhantom === true`.
      **תוקן ב-backend כחלק מהמשימה הזו** — `teams.service.ts::TEAM_MEMBER_USER_SELECT` לא
      כלל `isPhantom` (רק שני המקומות שהוסיף פיצ'ר 9.1 עצמו כללו אותו); עודכן קבוע ה-select
      המשותף לכלול `isPhantom`+`email`, והוחלפו אליו כל שאר בלוקי ה-`select` הידניים שכפלו
      אותו (`getTeamMembers`, `addMember`, `acceptMemberInvite`, `updateMember`) — כך ש-badge
      הפנטום יעבוד בכל מסך שמציג חברי צוות, לא רק בתשובת היצירה עצמה.
- [x] כפתור "שלח קישור הרשמה" — קומפוננטה חדשה `phantom-conversion-link.tsx` (web+native,
      דפוס `inviteUrl()`/העתקה זהה ל-`invite-links-panel.tsx`), מוצגת בתוך `TeamMemberRow` רק
      כש-`member.user.isPhantom && canManageTeamContent`. `POST /teams/:teamId/
      phantom-members/:memberId/conversion-invite`, מציגה/מעתיקה (web: clipboard; native:
      `Share.share`) את הקישור המתקבל.
- [x] `frontend/src/app/invite/[token].tsx`: ענף חדש (`PhantomConversionForm`) כש-`GET
      /invites/:token` מחזיר `type: 'phantomConversion'` — **לא** מציג `<AuthForm>`; טופס
      ייעודי (username/email/password חדשים, firstName/lastName prefill-ים מ-`prefill`,
      עדיין ניתנים לעריכה) ששולח `POST /invites/:token/consume-phantom-conversion` (בלי
      `Authorization`), ואז `useAuth().login(accessToken, user)` וניווט הביתה באותו דפוס
      reload קיים. אפקט ה-auto-consume הרגיל (`consumeInvite`) מדולג במפורש כש-
      `type==='phantomConversion'`. נבנה עם רכיבי RN גולמיים (`TextInput`/`TouchableOpacity`
      + טוקני `t.*`) ולא `@/components/ui` — קובץ ה-route הזה משותף ל-web+native באותו קובץ
      (לא מפוצל `-web`/`-native`), ו-`Button`/`Field` הם MUI-בלבד בלי מקבילת native (בניגוד
      ל-`Icon` שיש לו `icon.native.tsx`) — ייבוא שלהם היה שובר build native.
- [x] `sprint-retro-board-web.tsx`/`-native.tsx`: `canPostOnBehalf` (= `canHighlight`, אותו
      חישוב בדיוק). בורר "פרסם בשם:" חדש בטופס כתיבת התגובה (web: `Field type="select"`;
      native: כפתור+Modal/FlatList זהה בדפוסו לבורר הקטגוריה הקיים) — ברירת מחדל "אני" (`''`),
      אחרת `team.members` (כולל פנטומים, שכבר מגיעים דרך אותו `include` קיים) ממוינים לפי שם
      תצוגה, נשלח כ-`onBehalfOfUserId` (מספרי) ב-`POST /sprints/:sprintId/comments`. כשנבחר
      יעד שונה מ"אני" — צ'קבוקס/Segmented "אנונימי" **מוסר לגמרי מה-render** (לא רק מנוטרל)
      גם ב-web וגם ב-native, ו-`isAnonymous` נשלח כ-`false` תמיד מהקליינט במצב הזה.
- [x] `comment-card-web.tsx` + `renderCommentCard` (native): badge/אינדיקציה חדשה (web:
      `<Badge tone="accent">`; native: `View` בסגנון badge זהה לשאר התג-ים הקיימים בקובץ),
      תמיד גלויה כש-`comment.postedByAdmin` קיים — טקסט "הוזן/ה בשם {authorName} על ידי
      {postedByAdminName}" (`Strings.retroBoard.postedOnBehalfIndicator`), נוקב בשם המזין
      הספציפי. אין תלות ב-`isAnonymous`.
- [x] **[הוסף 2026-09-14]: אותה אינדיקציה הגיעה גם ללוח הזיכרון** — `getPostedByAdminLabel`
      חדש ב-`frontend/src/features/retro/comment-display.ts` (שיתוף-קוד עם
      `getCommentAuthorName`/`formatUserDisplayName` פנימי חדש), נצרך משני נתיבי התצוגה:
      `comment-card-web.tsx`/`renderCommentCard` למעלה, וגם `memory-card-web.tsx`/
      `memory-card-native.tsx` (שורת caption נוספת על צד הקדמי של הקלף בלבד — הגב ממשיך
      לא להראות מידע, לפי §8.0 default #4). `MemoryCardComment`
      (`frontend/src/features/retro/memory-card-flip.ts`) הורחב עם `postedByAdmin?`.
- [x] `Strings.teamList.*`/`Strings.retroBoard.*`/`Strings.invites.*`: כל המחרוזות העבריות
      החדשות נוספו (badge "לא רשום", כותרת/שדות טופס יצירת פנטום, כפתור "שלח קישור הרשמה"
      וטקסטי הקישור, בורר "פרסם בשם:"/"אני", `postedOnBehalfIndicator`, כותרת/תת-כותרת/כפתור
      מסך ההמרה ב-invite). שדות username/email/password/firstName/lastName בטופס ההמרה עשו
      שימוש חוזר ב-`Strings.auth.*` הקיימים במקום כפילות.
- [x] `trackEvent()`: `phantom_member_created` (יצירת פנטום), `phantom_conversion_link_created`
      (שליחת קישור המרה), `retro_comment_posted_on_behalf` (בנוסף ל-`retro_comment_added`
      הקיים, כשנבחר יעד "בשם" — web+native), `phantom_conversion_completed` (השלמת המרה
      בעמוד ה-invite).

### 9.3 בדיקות

- [x] Playwright e2e (`frontend/e2e/phantom-members.spec.ts`, Desktop+Mobile Chrome): מנהל/ת
      (leader, `isAdmin`+`role==='TEAM_LEADER'` דרך יצירת הצוות) יוצר חבר פנטום → מופיע ברשימת
      החברים עם badge "לא רשום"; מפרסם תגובת KEEP "בשמו" — נבדק שצ'קבוקס/אינדיקציית "אנונימי"
      **מוסר לגמרי מה-DOM** (`toHaveCount(0)`, לא רק `not.toBeVisible()`) ברגע שנבחר יעד שאינו
      "אני" → התגובה מוצגת עם אינדיקציית "הוזן/ה בשם Phanto Mm על ידי {שם המשתמש הספציפי של
      ה-leader}"; אותה אינדיקציה נבדקה **גם** בהתחברות כחבר-צוות רגיל (DEVELOPER) שני — גלויה לו
      במלואה (החלטה מוצרית #2), בעוד שכפתורי "הוסף חבר פנטום"/בורר "פרסם בשם"/"שלח קישור הרשמה"
      נבדקו **נעדרים לחלוטין מה-DOM** עבורו (`toHaveCount(0)`, לא viewport-hidden). לאחר מכן
      נשלח קישור המרה מתוך כרטיס הפנטום (leader), נפתח בהקשר דפדפן נקי (`browser.newContext()`,
      לא מחובר) — טופס ההמרה מציג `firstName`/`lastName` כ-prefill, לאחר שליחה המשתמש נכנס
      אוטומטית לחשבון האמיתי, והתגובה הישנה שהוזנה בשמו עדיין מוצגת תחת אותו שם עם אותה
      אינדיקציית "הוזן בשם" (`authorId` לא השתנה). רץ ירוק, Desktop+Mobile Chrome (הועלה
      `test.setTimeout(60_000)` — הזרימה המלאה קרובה לגבול ברירת המחדל של 30 שנ' על ריצה קרה,
      אותו דפוס כמו `memory-board.spec.ts`). **באג אמיתי שנמצא (לא בפיצ'ר הזה עצמו, בקומפוננטת
      `Field` המשותפת, `frontend/src/components/ui/field.tsx`):** כש-`type="select"` וערך
      ה-`MenuItem` הנבחר הוא מחרוזת ריקה (`value: ''`) — בדיוק ברירת המחדל של בורר "פרסם בשם:"
      ("אני") וגם של בורר הקטגוריה הקיים ("ללא קטגוריה") — ה-combobox **לא** מציג את תווית
      ה-option הנבחרת בתוכו (טקסט ריק/zero-width space בפועל, אומת ידנית ב-DOM); MUI לא מספק
      `renderValue` מותאם ב-`Field`, ורק `comment-filter-bar-web.tsx` (שימוש נפרד, לא דרך
      `Field`) עוקף את זה עם `displayEmpty`+`renderValue` משלו. לא חוסם פונקציונלית (הבחירה
      עצמה עובדת) אבל פוגע בבהירות ה-UI — המשתמש לא יכול לראות בוודאות "אני" בתיבה. לא תוקן
      כאן (קומפוננטה משותפת, מחוץ להיקף פיצ'ר 9) — מומלץ פיצ'ר/תיקון נפרד ב-`Field`.
- [x] Jest (backend): `teams.service.spec.ts` (`createPhantomMember` — guard, יצירת
      User+TeamMember יחד, username ייחודי-אוטומטי), `comments.service.spec.ts`
      (`create` עם `onBehalfOfUserId` — guard, שיוך נכון של `authorId`/`postedByAdminId`,
      בדיקת שהמטרה חברה בצוות), `invites.service.spec.ts`
      (`createPhantomConversionInvite`/`consumePhantomConversionInvite` — תוקף/מיצוי/כפל-המרה
      חסום, ייחודיות username/email תוך החרגת הפנטום עצמו, `accessToken` מוחזר תקין). נכתב
      כחלק ממימוש ה-Backend (סעיף 9.1); אומת מחדש כאן — כל הכיסוי הדרוש קיים, לא נדרשו תוספות.
      `npm test`: 239/239 ירוק, `npm run test:e2e`: 47/47 ירוק (מול `postgres-test` אחרי ניקוי
      נתוני-שאריות מריצה קודמת שנקטעה — `TRUNCATE` ישיר על ה-DB המבודד, לא על Neon).
- [x] Jest (frontend) לרכיבי ה-UI החדשים — כבר נכתבו כחלק מהמימוש, אומתו ירוקות כאן (`npm test`:
      95 עברו/3 דולגו, 12 חבילות): badge פנטום + גילוי/הסתרה מלאה של "שלח קישור הרשמה" לפי
      `canManageTeamContent`
      (`team-list-native/__tests__/team-member-row.test.tsx`); טופס יצירת פנטום כולל טיפול
      ב-lastName ריק (`team-list-native/__tests__/add-phantom-member-form.test.tsx`); בורר
      "פרסם בשם" כולל היעלמות מוחלטת של צ'קבוקס "אנונימי" מה-DOM כשנבחר יעד שאינו "אני", ואי-
      רינדור הבורר כלל לחבר רגיל (`components/__tests__/sprint-retro-board.test.tsx`);
      אינדיקציית "הוזן בשם" — פונקציית `getPostedByAdminLabel` הטהורה, כולל fallback
      ל-username וזיהוי מזין שונה per-comment
      (`features/retro/__tests__/comment-display.test.ts`).
- [x] בדיקת מובייל — `Mobile Chrome` project ב-Playwright, אותו קובץ spec (שני הפרויקטים רצים
      מאותו `test()` יחיד לפי קונפיגורציית ה-e2e הקיימת) — ירוק.

### לא בטיפול (פיצ'ר 9)

- מחיקה/השבתה של חבר פנטום שטרם הומר — לא התבקש, אפשר להוסיף בעתיד כפעולה נפרדת.
- עריכת פרטי פנטום (שם) אחרי יצירה, לפני המרה — לא התבקש ב-MVP הזה.
- הגבלת מספר חברי פנטום לצוות — אין הגבלה, כמו שאין הגבלה על מספר חברים רגילים.
