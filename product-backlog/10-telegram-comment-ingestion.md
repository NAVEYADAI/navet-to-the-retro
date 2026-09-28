## פיצ'ר 10: הזנת תגובות רטרו דרך טלגרם — טיוטה, ממתין להחלטות

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `UserMessagingLink` (חדש) — `{id, userId (FK, cascade), channel: enum
  MessagingChannel {TELEGRAM}, externalId, isRevoked, activeTeamId?, activeSprintId?,
  pendingCommentContent?, pendingCommentType?, linkedAt}` (שם/שדות בדיוק — ר' §10.0 ברירת מחדל
  טכנית #1; המבנה הגנרי `channel`+`externalId` **נעול**, לא `telegramChatId` על `User`). אין שינוי
  לשום מודל קיים (`User`, `Comment`, `TeamCommentCategory`, `TeamMember`, `Sprint`).
- **Backend:** מודול חדש `backend/src/telegram/` (webhook controller + adapter service + resolver
  service), **קורא ישירות ל-`CommentsService.create`** הקיים (`backend/src/comments/
  comments.service.ts`) — לא בונה שום נתיב יצירת-תגובה מקביל. משתמש ב-`GET /teams/:teamId/
  categories?enabledOnly=true` (מודול `team-categories`, פיצ'ר 3) לרשימת קטגוריות, וב-
  `assertCanManageTeamContent`-**style** ולידציית חברות (`TeamMember` רגיל, לא guard-מנהלים) לזיהוי
  צוותים/ספרינטים פתוחים של המשתמש.
- **Frontend:** `frontend/src/features/settings/components/telegram-link-card.tsx` (חדש, על תבנית
  `google-calendar-card.tsx`), `frontend/src/features/settings/hooks/use-telegram-link.ts` (חדש, על
  תבנית `use-google-calendar.ts`), `frontend/src/app/settings.tsx` (הטמעה, שורה מקבילה ל-
  `<GoogleCalendarCard/>`).
- **Endpoints:** `POST /telegram/webhook` (ציבורי, מאומת ע"י `secret_token` — לא JWT), `POST
  /auth/telegram/link` (מאומת JWT, מאמת חתימת Telegram Login Widget ומקשר), `DELETE
  /auth/telegram/link` (ניתוק, ר' ברירת מחדל טכנית #6).
- **חולק את דפוס ה-per-team-owned-entity/soft-disable עם פיצ'ר 3** (`TeamCommentCategory`) ואת
  דפוס "חיבור אישי לגורם חיצוני עם ניתוק-רך" עם פיצ'ר 6 (`GoogleCalendarConnection`).
- **נוגע ב-`CommentsService.create` בעקיפין בלבד** (קורא לו, לא משנה אותו) — כל שינוי עתידי בולידציה
  של יצירת תגובה (למשל פיצ'ר 3/9) חל אוטומטית גם על תגובות שמגיעות מטלגרם, בלי עדכון נפרד כאן.

מטרת הפיצ'ר: לאפשר לחבר צוות מקושר להזין תגובת רטרו (KEEP/IMPROVE + קטגוריה) ישירות מטלגרם, בלי
לפתוח את האפליקציה — קישור חד-פעמי בין חשבון טלגרם לחשבון המשתמש דרך מסך ה-Settings, ואז שיחה קצרה
עם הבוט (בחירת צוות אם צריך → טקסט חופשי → בחירת קטגוריה → אישור) שיוצרת תגובה אמיתית בלוח הרטרו
הפתוח, דרך אותו שירות יצירת-תגובה שה-UI הרגיל כבר משתמש בו.

### 10.0 החלטות

**החלטות מוצריות (נוה, כבר סוכמו בשיחה נפרדת — לא לשאול עליהן שוב):**

1. **טלגרם, לא WhatsApp, ל-v1.** WhatsApp Cloud API הרשמי דורש הרשמת עסק/מפתח ב-Meta (הטייר
   החינמי מוגבל למספרי-נמענים מאומתים-מראש בודדים); הספריות הלא-רשמיות (whatsapp-web.js/Baileys)
   חינמיות אך מפרות את ה-ToS של WhatsApp (סיכון חסימה אמיתי) ודורשות תהליך Node מחובר-session
   24/7 — נדחה במפורש כ"לא יציב". Telegram Bot API (דרך `@BotFather`) חינמי רשמית, בלי אימות-עסק,
   בלי הגבלת נמענים, ויציב — נבחר ל-v1. **הארכיטקטורה חייבת להשאיר מסלול זול להוספת WhatsApp
   בעתיד** — זו הסיבה הישירה להחלטה הטכנית הבאה.
2. **הפרדת ערוץ גנרית — לא `telegramChatId` על `User`.** מודל `UserMessagingLink` גנרי
   (`channel` enum + `externalId`), וצינור העיבוד (webhook נכנס → זיהוי שולח → זיהוי צוות/ספרינט →
   זיהוי קטגוריה → יצירת תגובה) נבנה כך שאדפטר ספציפי-לטלגרם מנרמל את ה-payload לצורה משותפת וקורא
   לאותה לוגיקת-resolve/יצירה שאדפטר WhatsApp עתידי גם יקרא לה. עקבי עם עקרון "מקור אמת אחד, לא
   מסלולים מקבילים" שכבר תועד בפרויקט (פיצ'ר 3).
3. **יצירת התגובה חייבת לעבור דרך `CommentsService.create` הקיים** — לא bypass. כך התגובה יורשת
   בחינם את כל הבדיקות הקיימות (חברות בצוות, קטגוריה מופעלת ושייכת לצוות, וכו') ונשארת עקבית עם כל
   שינוי עתידי בלוגיקה הזו. **נבדק במחקר**: `CommentsService.create(sprintId, dto, requesterId)`
   מקבל `requesterId` כפרמטר רגיל (לא קורא ל-`AuthService.validateToken` בעצמו — זה קורה ב-
   controller) — כלומר אין שום צימוד ל-HTTP session/JWT שיחסום קריאה אליו מתוך controller של
   webhook. ר' "ממצאי מחקר" למטה לפירוט.
4. **קישור זהות:**
   - Web: **Telegram Login Widget** הרשמי מוטמע בעמוד ה-Settings (`frontend/src/features/
     settings/`) — כפתור "התחברות עם טלגרם"; הווידג'ט מטפל באימות מול טלגרם ומחזיר payload חתום
     (`id, first_name, username?, photo_url?, auth_date, hash`) ל-callback; ה-backend מאמת את
     ה-`hash` (HMAC-SHA256 לפי התיעוד הרשמי של טלגרם, עם `bot_token`) ומקשר את ה-`id` שחזר
     ל-`User` המחובר הנוכחי.
   - Native (Expo): הווידג'ט הוא סקריפט JS ל-DOM דפדפן בלבד — לא רץ ב-React Native. מסך ה-Settings
     ב-native מקבל כפתור ("קישור טלגרם זמין באתר בלבד" / "פתח בדפדפן") שפותח את כתובת ה-Settings
     של האתר בדפדפן חיצוני (`Linking`/`expo-web-browser`, אותה טכניקה כמו `ExternalLink`
     (`frontend/src/components/external-link.tsx`) — `openBrowserAsync` על native), שם אותו
     וידג'ט web משלים את הקישור. **אין** מנגנון קישור native-בלבד נפרד.
5. **פתרון הקשר צוות/ספרינט — session-based, בלי תפוגה מבוססת-זמן** (מחליף רעיון קודם של "זיכרון
   דביק ל-24 שעות" שנוה חזר בו ממנו במפורש):
   - בכל אינטראקציה חדשה, הבוט מזהה את השולח לפי `UserMessagingLink` המקושר שלו.
   - אם המשתמש חבר (`TeamMember.status==='ACTIVE'`) בדיוק בצוות אחד עם ספרינט פתוח כרגע →
     resolve שקט, בלי שאלה.
   - אם המשתמש חבר בכמה צוותים עם ספרינט פתוח → הבוט מציג רשימה ממוספרת/כפתורים ("לאיזו קבוצה?").
   - לאחר הבחירה, הצוות+הספרינט הופכים ל"הקשר הפעיל" לשארית השיחה — **בלי תפוגה מבוססת-זמן**.
   - אפשרות קבועה "🔙 החלף צוות" זמינה בכל שלב בזרימה (כולל באמצע, למשל בזמן בחירת קטגוריה),
     ומחזירה לבחירת צוות מחדש.
6. **בחירת Keep/Improve + קטגוריה — שתי שאלות נפרדות, לא רשימה משולבת אחת (נעול, החליף ניסוח
   קודם מעורפל).** אחרי כל הודעת-טקסט חופשי (גוף התגובה):
   - **שאלה 1 (חובה):** "Keep או Improve?" — קובעת את `type: CommentType` (שדה `!` חובה ב-
     `CreateCommentDto`/`Comment`, ר' ממצאי מחקר).
   - **שאלה 2 (אופציונלית, כוללת "דלג"):** "איזו קטגוריה? (או דלג)" — מציגה בדיוק את רשימת
     `TeamCommentCategory` המופעלות (`isEnabled===true`) של הצוות הפעיל — **אותו מקור-נתונים
     בדיוק** ש-`category-management-panel.tsx` (פיצ'ר 3) כבר קורא ממנו, בלי כפילות. תשובה "דלג"
     שולחת `categoryId: undefined` — **נבדק במחקר**: `Comment.categoryId`/`CreateCommentDto.
     categoryId` שניהם `Int?`/אופציונליים, כך שדילוג הוא ערך תקין לגמרי, לא workaround.
   הבוט **לא** מאפשר יצירת קטגוריה חדשה דרך הצ'אט — ניהול קטגוריות נשאר בלעדית באפליקציה
   (admin/team-leader בלבד, פיצ'ר 3).
7. **UX אישור:** אחרי יצירת תגובה מוצלחת, הבוט שולח הודעת אישור אחת (למשל "נוספה ל-Sprint X /
   Keep ✅"). **אין** ביטול/עריכה/מחיקה דרך הבוט — טעויות מתוקנות דרך ה-UI הרגיל של האפליקציה.
   הוחלט במפורש **נגד** כפתור "מחק" עם חלון-חסד — לשמור פשוט.
8. **טיפול בלתי-מקושר/בלי הקשר:**
   - הודעה מחשבון טלגרם בלי `UserMessagingLink` → תשובה שמכוונת לקישור דרך Settings ("החשבון שלך
     עוד לא מקושר. קשרי ב-Settings"), בלי לחשוף פרטים פנימיים.
   - הודעה ממשתמש מקושר שכרגע אינו חבר בשום צוות עם ספרינט פתוח → תשובה מסבירה ("אתה לא חבר בצוות
     עם ספרינט פתוח כרגע").
9. **הגבלת קצב/הגנה מפני שימוש-לרעה:** **אין ב-v1** — משטח ההתקפה קטן מספיק (רק משתמשים מקושרים
   ומזוהים יכולים להודיע לבוט) שלא שווה לבנות עכשיו. לתעד כתוספת עתידית אפשרית, לא כשאלה פתוחה.
10. **אבטחת webhook:** מנגנון ה-`secret_token` המובנה של טלגרם (סוד שמוגדר בזמן רישום כתובת ה-
    webhook מול טלגרם, מוחזר בכותרת `X-Telegram-Bot-Api-Secret-Token` על כל update נכנס, מאומת
    ב-backend) — פרט מימוש סגור, לא שאלה מוצרית.

**ברירות מחדל טכניות (נקבעו כאן, לא לשאול את נוה עליהן):**

1. **צורת `UserMessagingLink` — כולל שדות state שיחה, לא רק זהות.** מעבר ל-`{userId, channel,
   externalId, isRevoked, linkedAt}` הבסיסי (עקבי עם דפוס `GoogleCalendarConnection` — חיבור אישי
   עם ניתוק-רך, לא מחיקה קשיחה), השורה גם נושאת state שיחה: `activeTeamId Int?`, `activeSprintId
   Int?` (ההקשר הפעיל, ר' החלטה מוצרית #5), ו-`pendingCommentContent String?` +
   `pendingCommentType CommentType?` (הטקסט שהוזן, ממתין לבחירת קטגוריה — כי הבוט חייב "לזכור" את
   גוף ההודעה בין ה-round-trip של "איזו קטגוריה?" לתשובה). `@@unique([channel, externalId])` (לא
   `externalId` בלבד) כדי לתמוך בעתיד בערוצים נוספים בלי קונפליקט מזהים בין ערוצים.
2. **מודול backend חדש `backend/src/telegram/`, לא הרחבת `comments`/`auth`.** תואם ל"one NestJS
   module per domain" (`backend/AGENTS.md`). מייבא את `CommentsModule` (כדי להזריק
   `CommentsService`) ואת `TeamCategoriesModule`/`PrismaService` ישירות — בלי circular dependency
   (אף מודול קיים לא צריך לייבא בחזרה את `telegram`).
3. **קליינט Telegram Bot API — קריאות HTTP ידניות (axios), לא ספריית bot מלאה
   (`node-telegram-bot-api`/`telegraf`).** עקבי עם הסגנון הידני-בלי-פריימוורק-נוסף של הבקאנד הזה
   (`backend/AGENTS.md`: "manual JWT... no Guards, no Passport") — `sendMessage`/`setWebhook` הם
   קריאות `POST https://api.telegram.org/bot<token>/<method>` פשוטות, לא מצדיקות תלות כבדה חדשה
   (בניגוד ל-OAuth מול Google, ששם `googleapis` כבר היה הכרח אמיתי).
4. **אימות ה-Telegram Login Widget — HMAC-SHA256 לפי המפרט הרשמי של טלגרם** (`secret_key =
   SHA256(bot_token)`, `hash = HMAC-SHA256(data_check_string, secret_key)`), מוודא גם ש-`auth_date`
   לא ישן מדי (למשל <1 יום) לפני קבלת הקישור — לא לוגיקה מומצאת, זה בדיוק הפרוטוקול המתועד של
   טלגרם, ואין תקדים-קוד קיים שמדגים HMAC (בניגוד ל-Google OAuth שיש לו תקדים מלא ב-`google-
   calendar.service.ts`) — זה המחקר הטכני החדש היחיד שהפיצ'ר הזה דורש שלא היה קיים בקוד.
5. **"הקשר פתוח" (open sprint) לצורך resolve — מוגדר server-side מחדש, אין פונקציה משותפת
   קיימת.** `Sprint` אין לו שדה `status`/`isOpen` ב-DB בכלל — ההגדרה היחידה הקיימת בקוד היא
   `getSprintState(startDateStr, endDateStr)` ב-`frontend/src/features/sprints/components/sprint-
   list-web.tsx` (שורות 23-33, client-side בלבד): "פעיל" = תאריך היום בין `startDate` ל-`endDate`
   (השוואת תאריכים בלבד, בלי שעה). יש לשכפל את אותה לוגיקה **בשרת** בתוך שירות ה-resolve של הבוט
   (`sprint.startDate <= now <= sprint.endDate`, ולסנן `TeamMember.status==='ACTIVE'` בלבד —
   עקבי עם ה-fix שכבר בוצע לבעיה מקבילה בפיצ'ר 9/6, `syncSprintCreated`).
6. **ניתוק (`DELETE /auth/telegram/link`) — ניתוק-רך (`isRevoked=true`), לא מחיקת שורה.** עקבי עם
   דפוס `GoogleCalendarConnection.isRevoked`/`TeamCommentCategory.isEnabled` — לא נדרש ע"י נוה
   במפורש, אבל היעדר דרך לנתק הוא פער-UX ברור לצד "התחברות עם טלגרם", וחיובי-בעלות טכני-בלבד
   (סימטרי לכרטיס Google Calendar הקיים שכן תומך disconnect).
7. **משתנה סביבה חדש `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME`** (frontend, public — הווידג'ט של טלגרם
   דורש `data-telegram-login="<bot_username>"` ישירות ב-DOM, בניגוד לזרימת Google שבה ה-frontend
   אף פעם לא צריך client id). Backend: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (infisical,
   כמו `GOOGLE_CLIENT_SECRET`/`JWT_SECRET` הקיימים).
8. **פריסת Fly.io עם `min_machines_running=0` (scale-to-zero) — נבדק במפורש, לא הוזכר בטעות.**
   `backend/fly.toml` (שורות 12-18): `auto_stop_machines='suspend'`, `auto_start_machines=true`,
   `min_machines_running=0` — כל בקשה שמגיעה כשהמכונה מושהית (suspended) גורמת ל-resume לפני
   שהיא נענית. **זה לא בעיה חדשה שנוצרה ע"י הפיצ'ר הזה** לגבי state — כל ה-state של השיחה
   (`activeTeamId`/`activeSprintId`/`pendingComment*`) כבר מתוכנן לשבת ב-DB (`UserMessagingLink`,
   ר' ברירת מחדל #1), לא בזיכרון תהליך — כלומר suspend/resume לא מאבד שום דבר. ההשפעה האמיתית
   היחידה: **זמן תגובה** על ה-webhook הראשון אחרי תקופת חוסר-פעילות (Fly "suspend" הוא resume מהיר
   יחסית — לא cold start מלא — אבל לא אפס). **הוחלט לא לשנות את `min_machines_running`/`fly.toml`
   בשביל הפיצ'ר הזה** (זה בדיוק החיסכון-בעלויות שכל האפליקציה בנויה עליו, ולא רק Telegram) — הפתרון
   הוא ברירת המחדל הבאה (התמודדות ב-webhook עצמו, לא בתשתית).
9. **התמודדות עם עיכוב/idempotency ב-webhook (נובע ישירות מהחלטה #8).** טלגרם עלול לשלוח מחדש
   (`retry`) את אותו update אם לא קיבל `200 OK` מספיק מהר (בדיוק התרחיש של resume מ-suspend) —
   בלי הגנה, זה עלול ליצור תגובה כפולה. ברירת מחדל: כל update נכנס נבדק מול `update_id` שכבר טופל
   (שדה/טבלה חדשים, למשל `UserMessagingLink.lastProcessedUpdateId Int?` — update עם `update_id`
   קטן-שווה מהערך השמור מתעלם ממנו כ-no-op, לא יוצר תגובה שנייה). זו נקודת-סיכון חדשה שלא הייתה
   קיימת קודם בקוד (שאר האפליקציה נקראת רק מדפדפן, לא מקבל at-least-once delivery מגורם חיצוני).
10. **רישום ה-webhook מול טלגרם — אוטומטי ב-bootstrap, לא סקריפט ידני נפרד.** `setWebhook` הוא
    קריאה אידמפוטנטית (בטוח לקרוא לה שוב עם אותה כתובת/secret — no-op אם כבר מוגדר) — נקראת פעם
    בכל עליית תהליך (`TelegramModule::onModuleInit`, לא `main.ts` הגלובלי) במקום endpoint
    admin-only/סקריפט ידני שדורש הרצה ידנית אחרי כל שינוי כתובת. עדכון מהחלטה קודמת (שהשאירה את
    זה כ"להחליט בזמן הבנייה") — עכשיו סגור: זה גם פותר בעקיפין תרחיש שבו כתובת ה-webhook
    משתנה (deploy חדש/דומיין חדש) בלי צעד ops נוסף.
11. **צ'אטים פרטיים בלבד (`chat.type==='private'`) — לא קבוצות/ערוצים.** כל מודל ה-session/הקשר-
    פעיל (החלטה מוצרית #5) מניח "זהות טלגרם אחת ⇔ שיחה אחת" — קבוצה שוברת את ההנחה הזו (מי בקבוצה
    "הבעלים" של ההקשר הפעיל? האם אישור נשלח לכל הקבוצה?). אין כאן החלטה מוצרית עדינה שדורשת את נוה
    — קבוצה פשוט לא מתאימה למודל הקיים: ה-webhook מתעלם (או עונה תשובה קצרה "הבוט עובד רק בצ'אט
    פרטי") מכל update שבו `chat.type !== 'private'`.
12. **הודעות שאינן טקסט (תמונה/הקלטה/מדבקה וכו') — לא נתמכות.** האדפטר מטפל רק ב-`message.text`;
    כל סוג הודעה אחר מקבל תשובה קצרה ("נתמך טקסט בלבד כרגע") בלי ליצור תגובה. `Comment.content` הוא
    `String` בלתי-מוגבל ב-Postgres — אין צורך בקיצוץ אורך הודעת טלגרם (מוגבל ל-4096 תווים ע"י
    טלגרם עצמה ממילא).
13. **פיתוח מקומי — אין מצב polling כגיבוי ל-webhook.** Webhook של טלגרם דורש כתובת HTTPS ציבורית
    — `localhost:5005` לא יכול לקבל ממנו updates אמיתיים. **לא נבנה מסלול קוד שני (polling)** רק
    בשביל dev — זה כפילות-לוגיקה שהפרויקט הזה בדיוק מנסה למנוע (עקרון "מקור אמת אחד"). בדיקה
    מקומית/בפיתוח נעשית ע"י קריאה ישירה ל-`POST /telegram/webhook` עם payload מדומה + כותרת
    `secret_token` תקינה (אותה גישה בדיוק כמו אסטרטגיית ה-stub ב-§10.3) — לא ע"י דיבור עם טלגרם
    האמיתי מהמכונה המקומית.

**שאלות פתוחות (לא לנחש, לסמן ולהמתין):**

1. **ניסוח מדויק/ליטוש של הודעות הבוט בעברית** (טקסט "לאיזו קבוצה?", טקסט אישור מדויק, טון כללי) —
   לא סוכם, סיכון נמוך. אפשר להתחיל עם ניסוח סביר ולעדכן ב-`Strings`/קובץ הודעות ייעודי בלי לשנות
   מבנה.
2. **האם פקודת `/start` (או דומה) אמורה להציג הודעת עזרה/הסבר קצרה** — לא נדון בכלל. אם לא
   יוחלט לפני המימוש, ברירת המחדל הסבירה: `/start` שולח הודעת פתיחה קצרה (הסבר על מה הבוט עושה +
   הפניה ל-Settings אם עדיין לא מקושר) ולא עושה כלום מעבר לכך.

### ממצאי מחקר

- **`CommentsService.create(sprintId, dto, requesterId)`** (`backend/src/comments/
  comments.service.ts:10-114`) מקבל `requesterId` כארגומנט רגיל — האימות (`AuthService.
  validateToken`) קורה אך ורק ב-`CommentsController.create` (`comments.controller.ts:13-21`), לא
  בתוך ה-service עצמו. זה בדיוק מה שמאפשר לקרוא ל-service הזה מתוך controller של webhook (שאין לו
  `Authorization` header בכלל — יש רק `secret_token` על ה-webhook) בלי לעקוף/לשכפל שום ולידציה:
  ה-webhook controller פשוט צריך "לדעת" מי ה-`requesterId` (המשתמש שמאחורי הודעת הטלגרם, נפתר דרך
  `UserMessagingLink`) ולקרוא ל-`create` ישירות עם אותו מספר. `dto` שנבנה ע"י האדפטר צריך
  `{content, type, categoryId, sprintId}` — **בלי** `onBehalfOfUserId`/`isAnonymous` (הבוט תמיד
  מזין בשם עצמו, לא "בשם מישהו אחר" — זו יכולת נפרדת מפיצ'ר 9, לא בשימוש כאן).
- **`CreateCommentDto`** (`backend/src/comments/dto/comments.dto.ts`) כבר תומך בכל השדות
  הדרושים — אין צורך בשדה DTO חדש כלשהו לצורך הפיצ'ר הזה; ולידציית `categoryId` (שייך לצוות +
  מופעל) כבר קיימת ב-`create` עצמו (§3.1) ותיאכף אוטומטית גם על תגובות שמגיעות מטלגרם.
- **קטגוריות מופעלות — `GET /teams/:teamId/categories?enabledOnly=true`** (`backend/src/team-
  categories/`, פיצ'ר 3) הוא ה-endpoint הקיים המדויק לרשימה שהבוט צריך להציג — אין צורך ב-endpoint
  חדש, רק לקרוא לו מתוך שירות ה-resolve.
- **אין מושג "ספרינט פתוח" ב-DB בכלל.** `model Sprint` (`schema.prisma:212-225`) מכיל רק
  `startDate`/`endDate` גולמיים — אין `status`. ההגדרה היחידה שקיימת בקוד כלשהו היא client-side,
  `getSprintState` ב-`sprint-list-web.tsx` (שורות 17-33): `'active'` = היום בין `startDate` ל-
  `endDate` (השוואת תאריכים, שעה מאופסת). יש לבנות מקבילה server-side חדשה — אין לזה תקדים backend
  קיים להעתיק.
- **`assertCanManageTeamContent`** (`backend/src/teams/team-permissions.util.ts:8-15`) הוא guard
  ל"מנהל/ראש-צוות" — **לא רלוונטי** לפיצ'ר הזה: הבוט לא דורש הרשאת ניהול, רק חברות רגילה
  (`TeamMember` כלשהו עם `status==='ACTIVE'`). לא להשתמש ב-guard הזה כאן — ר' טעות פוטנציאלית
  להימנע ממנה.
- **`TeamInvite`/`GoogleCalendarConnection`** — שני התבניות הקיימות הכי-קרובות ל"ישות פר-משתמש עם
  קישור-חיצוני חד-פעמי": `TeamInvite` (טוקן חד-פעמי, `backend/AGENTS.md`: "copy `invites`, not
  `teams`") רלוונטי בעקיפין בלבד (הקישור כאן הוא זהות-חיצונית, לא הצטרפות-לצוות); `GoogleCalendarConnection`
  (`schema.prisma:137-150`) הוא הדוגמה המדויקת יותר ל"חיבור אישי לגורם חיצוני, per-user, עם
  ניתוק-רך" — `UserMessagingLink` בנוי על אותה סמנטיקה בדיוק (`isRevoked`, לא מחיקה).
- **`use-google-calendar.ts`** (`frontend/src/features/settings/hooks/`) הוא דפוס ה-hook המדויק
  להעתיק: fetch-סטטוס ב-mount בלבד (בלי auto-refetch-on-focus, per `[[feedback-frontend-data-
  freshness]]`), `handleConnect`/`handleDisconnect` עם `trackEvent`, קריאת query-param בחזרה
  מ-redirect (`?googleCalendar=connected|error`) לניקוי/הודעה חד-פעמית. הזרימה של טלגרם שונה
  (widget עם callback ב-DOM, לא redirect מלא), אבל מבנה ה-hook (status/loading/message state,
  handlers עם trackEvent) זהה.
- **`google-calendar-card.tsx`** (`frontend/src/features/settings/components/`) הוא דפוס ה-card
  המדויק להעתיק — `Card` מ-`@/components/ui`, `Button variant="secondary"` למצב "לא מחובר",
  `variant="danger"` לניתוק, הודעת `Alert` להצלחה/כישלון.
- **הערה מחקרית חשובה: מסך ה-Settings כולו (`frontend/src/app/settings.tsx` וכל שלושת ה-cards
  שלו) כתוב היום MUI-בלבד (`Box`/`Typography` מ-`@mui/material` ישירות, בלי `Platform.OS` branching
  ובלי קובצי `-web`/`-native` נפרדים)** — בניגוד לדפוס ה-platform-branching שמתואר ב-
  `frontend/AGENTS.md`. זה מצב קיים ולא קשור לפיצ'ר הזה (לא לתקן כאן) — אבל המשמעות המעשית:
  כרטיס הטלגרם החדש יכול להמשיך באותו דפוס (MUI ישירות) בלי לפצל קובצי web/native נפרדים, עם ענף
  `Platform.OS==='web'` פנימי רק במקום שבאמת צריך (טעינת סקריפט הווידג'ט מול כפתור "פתח בדפדפן"),
  בדיוק כמו ש-`ExternalLink` (`frontend/src/components/external-link.tsx`) כבר עושה עם
  `process.env.EXPO_OS !== 'web'` + `openBrowserAsync`.
- **`EXPO_PUBLIC_*` הוא המנגנון הקיים ל-env ציבורי בפרונט** (`frontend/.env`, למשל
  `EXPO_PUBLIC_POSTHOG_KEY`) — `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` עוקב אחרי אותו דפוס בדיוק.
- **`trackEvent`** (`frontend/src/lib/analytics.ts`) — כל control חדש (כפתור קישור/ניתוק) חייב
  לקרוא לו, עקבי עם הכלל הכללי בפרויקט (ר' `[[feedback-frontend-track-events-required]]`).
- **`backend/fly.toml` (שורות 12-18): `min_machines_running=0` מאומת בפועל, לא הנחה.**
  `[http_service]` מגדיר `auto_stop_machines='suspend'`, `auto_start_machines=true`,
  `min_machines_running=0` — הבקאנד כולו רץ על 0 מכונות כברירת מחדל וקם רק לפי בקשה נכנסת. שום
  endpoint קיים באפליקציה לא רגיש לזה כי כל הקריאות מגיעות מדפדפן/native client שסובל latency
  ראשוני בלי בעיה אמיתית — **זה הפיצ'ר הראשון שמכניס caller חיצוני עם ציפיות delivery/timeout
  משלו (טלגרם)**, ולכן ההתייחסות המפורשת בברירות מחדל טכניות #8-10 למעלה.

### 10.1 Backend

- [x] `backend/prisma/schema.prisma`: `enum MessagingChannel { TELEGRAM }` + מודל
      `UserMessagingLink` (`id, userId (FK cascade), channel, externalId, isRevoked
      @default(false), activeTeamId Int?, activeSprintId Int?, pendingCommentContent String?,
      pendingCommentType CommentType?, lastProcessedUpdateId Int?, linkedAt DateTime
      @default(now())`, `@@unique([channel, externalId])`). `lastProcessedUpdateId` הוא שדה
      ה-idempotency (ר' ברירת מחדל טכנית #9) — לא רק זהות/הקשר-שיחה. `npx prisma db push` מול
      `postgres-test` בלבד תחילה (מותר ישירות לפי `backend/AGENTS.md`) — **לא** מול Neon בלי
      אישור מפורש של נוה. **בוצע מול postgres-test בלבד** (localhost:5433) — **לא** רץ מול Neon
      dev/prod, נדרש אישור נוה מפורש לפני שמריצים שם.
- [x] מודול חדש `backend/src/telegram/` (`telegram.module.ts`, מייבא `CommentsModule` +
      `TeamCategoriesModule` + `PrismaService`). `onModuleInit` קורא ל-`setWebhook` (ר' פריט הבא)
      — רישום אוטומטי בכל עליית תהליך, לא סקריפט/endpoint ידני נפרד (ברירת מחדל טכנית #10).
- [x] `TelegramApiService` (או שם דומה) — עטיפה דקה סביב `axios` ל-`https://api.telegram.org/
      bot<TELEGRAM_BOT_TOKEN>/<method>` (`sendMessage`, `setWebhook`, אופציונלי `answerCallbackQuery`
      אם משתמשים ב-inline keyboard לכפתורים). `setWebhook` נקרא עם `url` (מ-`FRONTEND_URL`-style
      env, כתובת הבקאנד עצמו) + `secret_token: TELEGRAM_WEBHOOK_SECRET`; קריאה אידמפוטנטית, בטוח
      לקרוא בכל boot. `TELEGRAM_BOT_TOKEN` מ-`process.env` (infisical, כמו `GOOGLE_CLIENT_SECRET`).
      מומש: `TelegramApiService` (`sendMessage`/`setWebhook` בלבד — לא נבנה `answerCallbackQuery`,
      כי הבחירה המימושית הייתה reply keyboard מבוסס-טקסט, לא inline keyboard/callback_query, ר'
      הפריט הבא); `url` נבנה מ-`BACKEND_URL` env חדש (fallback ל-`https://navet-to-retro-backend.
      fly.dev`, אותו דפוס בדיוק כמו `FRONTEND_URL` הקיים) + `/telegram/webhook`. `axios` נוסף
      כתלות חדשה ל-`backend/package.json`.
- [x] `POST /telegram/webhook` — controller ציבורי (בלי `AuthService.validateToken`, אין JWT
      כאן בכלל); מאמת כותרת `X-Telegram-Bot-Api-Secret-Token` מול `TELEGRAM_WEBHOOK_SECRET`
      (`UnauthorizedException` אם לא תואם) **לפני** כל עיבוד. **בדיקת idempotency**: אם
      `update.update_id <= link.lastProcessedUpdateId` (אחרי resolve ה-`UserMessagingLink`) —
      מחזיר `200 OK` מיד בלי לעבד שוב (ברירת מחדל טכנית #9, מטפל ב-retry אחרי resume מ-suspend
      של Fly, ר' ברירת מחדל טכנית #8). **סינון סוג צ'אט**: `chat.type !== 'private'` → תשובה
      קצרה/התעלמות, לא מעבד (ברירת מחדל טכנית #11). **סינון סוג הודעה**: אין `message.text` (יש
      photo/voice/sticker וכו') → תשובה "טקסט בלבד נתמך כרגע" (ברירת מחדל טכנית #12). מזהה
      Telegram update, שולף `chatId`/`text` גולמיים, ומעביר ל-adapter. מומש ב-
      `telegram-webhook.controller.ts`: הבדיקות (secret token, סינון chat.type, resolve הקישור,
      idempotency, סינון הודעה-בלי-טקסט) יושבות ישירות ב-controller (לא הועברו ל-adapter), כדי
      שיהיו ניתנות-לבדיקה ישירות ב-`telegram-webhook.controller.spec.ts` כפי שהפריט הבא בסעיף
      הבדיקות מציין.
- [x] `TelegramAdapterService` (או שם דומה) — מנרמל payload נכנס לצורה גנרית `{channel:
      'TELEGRAM', externalId, text}` וקורא ללוגיקת ה-resolve המשותפת (ר' פריט הבא). זו נקודת
      ההפרדה הארכיטקטונית הנעולה (§10.0 החלטה מוצרית #2) — אדפטר WhatsApp עתידי יקרא לאותה
      לוגיקה עם `channel: 'WHATSAPP'`. מומש כשירות נורמליזציה טהור/סינכרוני (`normalize()`, בלי
      I/O) — ה-controller קורא לו לחילוץ `{externalId, chatType, text, updateId}` מה-update הגולמי
      ואז קורא ישירות למתודות הגנריות של `TelegramConversationService`.
- [x] שירות resolve משותף (למשל `TelegramConversationService`, שם פנימי — הלוגיקה עצמה לא
      תלוית-טלגרם):
      1. `findUnique({channel_externalId: {channel, externalId}})` על `UserMessagingLink`
         (`isRevoked=false`) → אם לא נמצא, שולח הודעת "לא מקושר" (§10.0 החלטה מוצרית #8) ועוצר.
      2. אם `activeTeamId`/`activeSprintId` כבר מוגדרים על השורה — ולידציה שהצוות עדיין
         "פתוח" עבור המשתמש הזה (`TeamMember.status==='ACTIVE'` + ספרינט עדיין בטווח
         `startDate<=now<=endDate`, ר' ברירת מחדל טכנית #5); אם לא — מנקה ומתחיל resolve מחדש.
      3. אם אין הקשר פעיל: שולף את כל `TeamMember` (`status==='ACTIVE'`) של המשתמש → לכל צוות
         בודק אם יש ספרינט "פתוח" כרגע (השוואת תאריכים server-side, ר' ברירת מחדל טכנית #5). 0
         תוצאות → הודעת "אין צוות עם ספרינט פתוח" (החלטה מוצרית #8) ועוצר. 1 תוצאה → resolve
         שקט, שומר `activeTeamId`/`activeSprintId`. יותר מ-1 → שולח רשימה ממוספרת/כפתורים,
         ממתין לתשובה הבאה (state-machine פשוט לפי טקסט/callback הבא).
      4. טיפול בהודעת "🔙 החלף צוות" (טקסט קבוע/callback ייעודי) בכל שלב — מנקה
         `activeTeamId`/`activeSprintId`/`pendingComment*` וחוזר לשלב 3.
      5. הודעת טקסט חופשי (לא פקודה מוכרת) כשיש הקשר פעיל → שומרת ב-`pendingCommentContent`,
         שואלת "Keep או Improve?" (§10.0 החלטה מוצרית #6, **שתי שאלות נפרדות — נעול**).
      6. תשובה Keep/Improve תואמת → שומרת ב-`pendingCommentType`, קורא ל-`GET /teams/:teamId/
         categories?enabledOnly=true` דרך `TeamCategoriesService`, ומציג רשימה + אפשרות "דלג"
         (§10.0 החלטה מוצרית #6).
      7. תשובה עם בחירת קטגוריה **או "דלג"** → קורא ל-`CommentsService.create(activeSprintId,
         {content: pendingCommentContent, type: pendingCommentType, categoryId: categoryId ??
         undefined}, userId)` (`categoryId` אופציונלי — "דלג" תקין, ר' ממצאי מחקר); בהצלחה מנקה
         `pendingComment*` ושולח הודעת אישור (החלטה מוצרית #7); בכישלון (למשל הקטגוריה הושבתה
         בינתיים) שולח שגיאה ברורה ולא מוחק את ה-pending state (המשתמש יכול לנסות שוב).
      7. **בכל מקרה (כל אחד מהשלבים 1-6, כולל דחייה/שגיאה)** — מעדכן `lastProcessedUpdateId` על
         שורת ה-`UserMessagingLink` ל-`update.update_id` הנוכחי, כך שה-idempotency check
         ב-controller (ברירת מחדל טכנית #9) יעבוד גם על updates שנדחו/נכשלו, לא רק על הצלחות.

      מומש ב-`telegram-conversation.service.ts::TelegramConversationService`, פועל על מזהה
      גנרי `{channel, externalId}` (לא תלוי-טלגרם). "הקשר עדיין פתוח" (שלב 2) ו"מציאת מועמדים"
      (שלב 3) ממומשים ב-`isContextStillOpen`/`getOpenTeamsForUser` פנימיים — server-side
      `startDate<=now<=endDate` + `TeamMember.status==='ACTIVE'` (ברירת מחדל טכנית #5). בחירת
      צוות מתוך רשימה מרובה מתבצעת לפי אינדקס מספרי (1-based) או התאמת שם מדויקת — אין שדה DB
      נפרד לזכור את רשימת המועמדים בין הודעות, היא מחושבת מחדש בכל פעם (דטרמיניסטית). "Keep"/
      "Improve" מזוהים לפי טקסט מדויק (case-insensitive) — לא כפתורי inline keyboard.
- [x] `POST /auth/telegram/link` (מאומת, `AuthService.validateToken` כרגיל) — מקבל payload גולמי
      של Telegram Login Widget (`id, first_name, username?, photo_url?, auth_date, hash`), מאמת
      HMAC-SHA256 מול `TELEGRAM_BOT_TOKEN` (ר' ברירת מחדל טכנית #4) + `auth_date` לא ישן מדי,
      ואז `upsert` על `UserMessagingLink` (`channel:'TELEGRAM', externalId: String(id),
      userId: requesterId, isRevoked:false`). אם `externalId` הזה כבר מקושר למשתמש **אחר**
      (`isRevoked=false`) — `ConflictException` ברור ("חשבון הטלגרם הזה כבר מקושר למשתמש אחר").
      מומש ב-`telegram-link.service.ts`/`telegram-link.controller.ts`
      (`TelegramLinkController@Controller('auth/telegram')`) + `telegram-auth.util.ts`
      (`verifyTelegramLoginHash`/`isTelegramAuthDateFresh`, HMAC-SHA256 לפי המפרט הרשמי).
- [x] `DELETE /auth/telegram/link` (מאומת) — `isRevoked=true` על השורה של המשתמש הנוכחי (לא
      מחיקה, ר' ברירת מחדל טכנית #6); `NotFoundException` אם אין קישור פעיל.
- [x] `GET /auth/telegram/link/status` (מאומת) — `{connected: boolean}` (ואופציונלי `username`
      טלגרם אם קיים בפיילוד המקושר) — לצורך ה-hook בפרונט (עקבי עם `GET /google-calendar/status`).
      מומש: `{connected: boolean}` בלבד — הוחלט לא להחזיר `username`, כי `UserMessagingLink` (שדות
      נעולים "בדיוק" בפריט הראשון של הסעיף הזה) לא כולל שדה לאחסון שם המשתמש הטלגרמי; לא הומצא
      שדה חדש שלא נדרש במפורש.
- [x] Jest: `telegram-webhook.controller.spec.ts` (דחיית secret_token שגוי/חסר; update כפול
      עם `update_id<=lastProcessedUpdateId` מוחזר כ-no-op בלי תגובה כפולה; `chat.type` לא-פרטי
      מתעלם; הודעה בלי `message.text` מקבלת תשובת "טקסט בלבד"), `telegram-
      conversation.service.spec.ts` (כל שלבי ה-state machine: לא-מקושר, בלי צוות-פתוח, resolve
      שקט על צוות יחיד, רשימת-בחירה על כמה צוותים, "החלף צוות" מכל שלב, יצירת תגובה מוצלחת דרך
      `CommentsService.create` ממוק, קטגוריה שהושבתה בין הבחירה ליצירה), `telegram-link.controller/
      service.spec.ts` (אימות HMAC תקין/פגום/ישן-מדי, קונפליקט חשבון-מקושר-למשתמש-אחר, ניתוק),
      `telegram.module.spec.ts` או בדיקה ל-`onModuleInit` (`setWebhook` נקרא עם ה-`url`/`secret_token`
      הנכונים בזמן עליית המודול, ממוק ברמת `TelegramApiService`). מומש: 5 קבצי spec
      (`telegram-webhook.controller.spec.ts`, `telegram-conversation.service.spec.ts`,
      `telegram-link.service.spec.ts`, `telegram-link.controller.spec.ts`,
      `telegram.module.spec.ts`), 49 טסטים, כולם עוברים (`npm test --prefix backend`, 320/320
      עוברים בסך הכל בסוויטה המלאה; `npm run test:e2e --prefix backend`, 47/47 עוברים —
      `postgres-test` היה זמין).

### 10.2 Frontend

- [x] `frontend/src/features/settings/hooks/use-telegram-link.ts` (חדש, על תבנית `use-google-
      calendar.ts`): `GET /auth/telegram/link/status` ב-mount בלבד; `handleLinked(widgetPayload)`
      שולח `POST /auth/telegram/link`; `handleUnlink` שולח `DELETE /auth/telegram/link`; state
      `connected/statusLoading/linkLoading/unlinkLoading/message`. כל handler שולח `trackEvent`
      (`telegram_link_widget_completed`, `telegram_unlink_clicked` וכו').
      מומש: `{connected}` בלבד מוחזר מ-`GET .../status` (עקבי עם §10.1, אין `username` בפיילוד) —
      הכרטיס מציג טקסט "מחובר" גנרי, לא שם משתמש טלגרמי.
- [x] `frontend/src/features/settings/components/telegram-link-card.tsx` (חדש, על תבנית
      `google-calendar-card.tsx`): מצב "לא מחובר" → כפתור/אזור שטוען את סקריפט ה-Telegram Login
      Widget (`https://telegram.org/js/telegram-widget.js?22`, `data-telegram-login=
      {EXPO_PUBLIC_TELEGRAM_BOT_USERNAME}`, `data-onauth`/callback גלובלי) **רק כש-
      `Platform.OS==='web'`**; ב-native מציג טקסט+כפתור "פתח בדפדפן" שפותח את כתובת ה-Settings
      של האתר (`openBrowserAsync`, אותו דפוס כמו `ExternalLink`). מצב "מחובר" → שם המשתמש
      הטלגרמי (אם קיים) + כפתור `variant="danger"` לניתוק (זהה ויזואלית לכפתור הניתוק של
      `GoogleCalendarCard`).
      מומש: קומפוננטה אחת עם ענף `Platform.OS==='web'` פנימי (לא קבצים נפרדים), עקבי עם ההערה
      המחקרית שמסך ה-Settings כולו עדיין MUI-בלבד בלי platform-branching על רמת קובץ. אם
      `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` ריק (עדיין לא נרשם בוט אמיתי) — ה-widget לא נטען כלל,
      מוצג טקסט "קישור טלגרם אינו מוגדר כרגע" במקום. נבדק ידנית ב-Playwright מול backend/frontend
      מבודדים (postgres-test, פורטים 5006/8086): מצב לא-מחובר+widget-לא-מוגדר, מצב לא-מחובר
      עם `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` מדומה (סקריפט ה-widget נטען בפועל עם התכונות
      הנכונות, מציג את שגיאת "Bot domain invalid" של טלגרם עצמה — צפוי, אין בוט אמיתי רשום),
      ורוחב מובייל 375px — שני המצבים נראים תקינים, בלי גלילה אופקית.
- [x] `frontend/src/app/settings.tsx`: הוספת `<TelegramLinkCard/>` באותה עמודה/מיקום כמו
      `<GoogleCalendarCard/>` (אחריו, לא לפניו — סדר עקבי עם סדר החיבור/יצירה של פיצ'רי Settings
      קודמים).
- [x] מחרוזות חדשות ב-`Strings.settings.*` (כותרת/תת-כותרת הכרטיס, כפתורי קישור/ניתוק/פתח-בדפדפן,
      הודעות הצלחה/כישלון) — לפי אותו דפוס כמו `Strings.settings.googleCalendar*`.
- [x] `trackEvent()` על כל control חדש בכרטיס (טעינת widget, קישור הצליח/נכשל, ניתוק, לחיצה על
      "פתח בדפדפן" ב-native).
      מומש: `telegram_link_widget_loaded`, `telegram_link_widget_completed`,
      `telegram_link_succeeded`, `telegram_link_failed`, `telegram_unlink_clicked`,
      `telegram_unlink_succeeded`, `telegram_unlink_failed`, `telegram_open_in_browser_clicked`.

### 10.3 בדיקות

- [x] Jest (backend): כיסוי ה-state machine המלא של `telegram-conversation.service.spec.ts`
      (ר' §10.1) — כולל מקרה הקצה שבו יצירת התגובה נכשלת אחרי בחירת קטגוריה (קטגוריה הושבתה
      בין השלבים) ומוודא שה-pending state לא נמחק בטעות. כיסוי אימות ה-HMAC (`telegram-link.
      *.spec.ts`) — hash תקין, hash מזויף, `auth_date` ישן מדי, קונפליקט חשבון-כפול.
      נמצא שהכיסוי כבר מומש במלואו כחלק מ-§10.1 (5 קבצי spec, 49 טסטים) — הורצו מחדש כאן
      ואומתו ירוקים (`npx jest telegram`, 49/49 עוברים); לא נדרש קוד טסט נוסף, כולל בדיוק את
      מקרה הקצה של כישלון-אחרי-בחירת-קטגוריה (`sends a clear error and keeps the pending state
      when comment creation fails`) ואת כל 4 מקרי ה-HMAC שהתבקשו.
- [x] Playwright e2e (`frontend/e2e/telegram-comment-ingestion.spec.ts`, Desktop+Mobile Chrome):
      **אין דרך אמיתית להריץ שיחת טלגרם אמיתית בסביבת e2e מבודדת** (אותה בעיה שכבר תועדה ב-
      OAuth של פיצ'ר 6/7 §6.3/§7.3) — יש להחליט על אסטרטגיית stub לפני כתיבת התרחיש (למשל: seed
      ישיר של `UserMessagingLink` ב-DB + קריאה ישירה ל-`POST /telegram/webhook` עם
      `X-Telegram-Bot-Api-Secret-Token` תקין וגוף update מדומה, כדי לבדוק את השרשרת המלאה
      resolve→category→create מקצה-לקצה בלי טלגרם אמיתי). כרטיס ה-Settings (widget
      load/כפתור "פתח בדפדפן"/מצב מחובר-מנותק) כן ניתן לבדיקה אמיתית ב-UI, בלי סימולציית
      widget-callback עצמה (זה סקריפט חיצוני של טלגרם).
      מומש: נכתב סקריפט seed חדש `backend/scripts/e2e-seed-telegram-link.js` (על תבנית
      `e2e-seed-google-connection.js`, guarded ל-`postgres-test` בלבד) + `npm run
      e2e:seed-telegram-link`. נוסף `TELEGRAM_WEBHOOK_SECRET` ל-`backend/.env.test` (היה חסר —
      בלעדיו `POST /telegram/webhook` תמיד מחזיר 401, כי `webhookSecret` על ה-controller נטען
      פעם אחת ב-constructor מ-`process.env`; `TELEGRAM_BOT_TOKEN` נשאר בכוונה לא מוגדר, כי
      `TelegramApiService.sendMessage`/`setWebhook` כבר עושים no-op בטוח בלעדיו). 10 טסטים
      (5 תרחישים × Desktop+Mobile Chrome): דחיית secret_token חסר/שגוי + הודעה מ-chat לא-מקושר
      שלא יוצרת שום דבר; שרשרת resolve→Keep/Improve→קטגוריה→יצירת-תגובה אמיתית דרך
      `CommentsService.create` + אימות ש-retry על אותו `update_id` לא יוצר כפילות; זרימת "דלג"
      (`categoryId: null`); כרטיס ה-Settings במצב לא-מחובר (widget לא נטען כי
      `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` ריק ב-e2e, מוצג טקסט "לא מוגדר") עם בדיקת-הרשאה
      אמיתית (חבר-צוות רגיל, לא admin); כרטיס מחובר (seed ישיר) + ניתוק אמיתי דרך
      `DELETE /auth/telegram/link`, מאומת מול ה-DB. כל 10 עוברים (`npx playwright test
      e2e/telegram-comment-ingestion.spec.ts`). **הענף native ("פתח בדפדפן") לא נבדק** — גדור
      מאחורי `Platform.OS !== 'web'`, שלעולם לא נכון בפרויקטי Chrome/Mobile-Chrome של Playwright
      (שניהם עדיין ה-build של Expo web) — אותה קטגוריית מגבלה כמו ה-widget-callback עצמו, לא
      ניתן לבדיקה מהסוויטה הזו. **באג אמיתי שנמצא ותוקן**: כרטיס ה-Telegram וה-nav bar
      (`app-tabs.web.tsx`) חולקים את אותו טקסט מדויק "מחובר" — לא באג בקוד המוצר עצמו (שני
      השימושים תקינים בפני עצמם), אלא מלכודת לכל טסט e2e עתידי שיחפש את הטקסט הזה בלי scoping
      לכרטיס; תועד בהערה בקוד הטסט (`telegramCard()` helper) ותוקן שם.
- [ ] בדיקה ידנית מול בוט טלגרם אמיתי (`@BotFather`, סביבת פיתוח/staging) לפני production —
      קישור אמיתי, שיחה מלאה כולל "החלף צוות", ווידוא שה-webhook `secret_token` נדחה נכון על
      בקשה בלי הכותרת. **כולל בדיקה ספציפית לתרחיש suspend/resume**: לתת למכונה ב-Fly להגיע
      ל-suspend (חוסר פעילות, `min_machines_running=0`, ר' §10.0 ברירת מחדל טכנית #8-9), אז
      לשלוח הודעה מטלגרם ולוודא שהיא מטופלת נכון (בלי תגובה כפולה, גם אם טלגרם שלח retry בזמן
      ה-resume) — לא רק תרחיש "מכונה כבר ערה".
- [x] פיתוח מקומי (ר' §10.0 ברירת מחדל טכנית #13): לוודא בפועל שקריאה ישירה ל-`POST
      /telegram/webhook` עם payload מדומה + `secret_token` תקין (בלי טלגרם אמיתי בכלל) מספיקה
      לבדוק את כל שרשרת ה-resolve→category→create מקומית — זו הדרך היחידה שתוכננה לבדיקה מקומית,
      לא polling.
      מאומת בפועל: גם ידנית (`curl` מקומי מול `npm run start:e2e`, `postgres-test`) וגם דרך
      ה-Playwright e2e שלמעלה (שמריץ בדיוק את אותה קריאה ישירה, פשוט אוטומטית) — שרשרת
      resolve→Keep/Improve→category→create עובדת מקצה-לקצה בלי טלגרם אמיתי, כולל
      idempotency על `update_id` כפול. **נשאר פתוח, לא ניתן להשלמה כאן**: הבדיקה הידנית מול בוט
      טלגרם אמיתי (הפריט הקודם) — דורשת רישום בוט אמיתי דרך `@BotFather` וסביבת
      פיתוח/staging פרוסה בפועל, לא רק קוד; זה חורג מהיקף סוכן כתיבת-בדיקות.

### 10.4 עדכון UX (פידבק מבדיקה חיה, 2026-09-22)

לאחר בדיקה ידנית ראשונה מול הבוט האמיתי (§10.3, מנהרת ngrok מקומית), נוה ביקש שני שיפורים ל-UX
של השיחה — לא נדונו קודם, מיושמים ומכוסים בטסטים:

- [x] **כפתורי בחירה אמיתיים (Telegram reply keyboard), לא הקלדה חופשית בלבד** — לבחירת צוות (כש
      יש כמה מועמדים), Keep/Improve, ובחירת קטגוריה. **לא** inline keyboard/`callback_query` (זה
      עדיין היה נגד §10.0 ברירת מחדל טכנית #3 — לא רוצים תלות/מורכבות נוספת) — reply keyboard
      פשוט שולח את טקסט הכפתור כהודעת טקסט רגילה, כך שכל לוגיקת ההתאמה-לפי-טקסט הקיימת
      (`matchCandidate`/`parseCommentType`/`handleCategoryAnswer`) ממשיכה לעבוד בלי שינוי — רק
      נוסף `reply_markup` אופציונלי ל-`TelegramApiService.sendMessage`. מומש ב-
      `telegram-messages.ts` (`teamListKeyboard`/`keepImproveKeyboard`/`categoryKeyboard`).
- [x] **אפשרות "❌ ביטול" זמינה בכל שלב של הזנת תגובה** (לא רק "🔙 החלף צוות" שהיה קיים) — מנקה
      רק את `pendingCommentContent`/`pendingCommentType` (**לא** את `activeTeamId`/`activeSprintId`
      — בשונה מ"החלף צוות" שמנקה גם את ההקשר), כך שההודעה הבאה מתחילה תגובה חדשה באותו צוות.
      אם אין תגובה באמצע הזנה — מודיע "אין כרגע תגובה... לבטל" בלי לגעת ב-DB. מומש כבדיקה חדשה
      ב-`processText` (לפני resolve הצוות, אחרי "החלף צוות"), עם 3 טסטים חדשים ב-
      `telegram-conversation.service.spec.ts` (מתוך שלב Keep/Improve, מתוך שלב קטגוריה, ו-"אין
      מה לבטל"). כל 52 הטסטים של מודול הטלגרם (ו-323 הטסטים של הבקאנד כולו) ירוקים אחרי השינוי.
- [x] **תרגום שימור/שיפור לעברית + ניסוח מחדש + אימוג'י לדלג** — עוד פידבק מאותה בדיקה חיה: הכפתורים/
      הטקסט הציגו "Keep"/"Improve" באנגלית (לא עקבי עם שאר האפליקציה, ר' `frontend/src/constants/
      strings.ts` — `keepLabel: 'שימור'`, `improveLabel: 'שיפור'`), וההודעה "התגובה נשמרה. Keep או
      Improve?" נשמעה מוזרה (התגובה עוד לא נשמרה בפועל בשלב הזה — רק ה-draft). מומש: הכפתורים/
      ההודעות עכשיו "שימור"/"שיפור" בעברית (`ASK_KEEP_OR_IMPROVE_MESSAGE` נוסח מחדש ל"קיבלתי את
      התגובה — זו הערת שימור או שיפור?", `confirmationMessage` מציג "שימור"/"שיפור" גם הוא); זיהוי
      התשובה (`parseCommentType`) עדיין מקבל גם "Keep"/"Improve" באנגלית לתאימות-לאחור. כפתור הדלג
      קיבל אימוג'י (`SKIP_CATEGORY_COMMAND = '⏭️ דלג'`), עם זיהוי גם ל"דלג" הפשוט בלי אימוג'י.
- [x] **סבב פידבק שלישי (אותה בדיקה חיה, 2026-09-22):** (1) אימוג'י תואמים לאייקונים שכבר קיימים
      בפרונטאנד ללוח הרטרו (`sprint-retro-board-web.tsx`: `Icon name="check"` ל-KEEP, `Icon
      name="wrench"` ל-IMPROVE) — `KEEP_LABEL = '✅ שימור'`, `IMPROVE_LABEL = '🔧 שיפור'`, מוגדרים
      פעם אחת ב-`telegram-messages.ts` ומשמשים גם את הכפתורים וגם את `confirmationMessage`.
      (2) **סדר הכפתורים הפוך** — "שימור" מוצג עכשיו בצד ימין, "שיפור" בצד שמאל (לפי בקשה מפורשת של
      נוה, ההפך מהסדר הראשוני) — `keepImproveKeyboard()` בונה את השורה `[IMPROVE_LABEL,
      KEEP_LABEL]`. (3) **הודעת ביטול ברורה יותר** — "בוטל. אפשר לשלוח תגובה חדשה" לא היה ברור
      שההערה שהוקלדה נמחקה בפועל; הוחלף ל-"ההערה שהתחלת להזין נמחקה ולא נשמרה. אפשר להתחיל תגובה
      חדשה בכל עת." (4) **בלי מקפים ארוכים (—) בהודעות הבוט** — נוה ציין שזה נשמע "AI"/מוזר; כל
      המחרוזות ב-`telegram-messages.ts` עברו לפסיקים/נקודות, מקף קצר (`-`) רק במקום שבאמת נדרש
      (ב-`CREATE_FAILED_MESSAGE`). (5) **הודעות שגיאה/הצלחה משופרות** — `CREATE_FAILED_MESSAGE`
      עכשיו מסביר שהתגובה **לא אבדה** ומציע פעולה קונקרטית (לבחור קטגוריה אחרת או לדלג);
      `confirmationMessage` נוסח מחדש ל"נשמר בהצלחה! התגובה נוספה ל-\"{sprint}\" בתור {label}."
      זיהוי התשובה (`parseCommentType`) עודכן ל-`includes` במקום השוואה מדויקת כדי לזהות טקסט עם
      האימוג'י החדש. 52 טסטי הטלגרם (ו-323 טסטי הבקאנד כולו) נשארו ירוקים אחרי כל השינויים.
- [x] **סבב פידבק רביעי:** כל הודעות הבוט קוצרו דרסטית (בלי משפטי-הסבר מיותרים) + `parse_mode:
      'Markdown'` נוסף ל-`TelegramApiService.sendMessage` לתמיכה ב-**בולד** (עם `escapeMarkdown()`
      חדש ב-`telegram-messages.ts` שמגן על שמות צוות/ספרינט/קטגוריה דינמיים מתווים מיוחדים).
      כפתור הביטול הוחלף מ"❌ ביטול" ל-**"🗑️ מחק הערה"** (`CANCEL_COMMAND`) — אומר "מחיקה" במפורש
      על הכפתור עצמו, לא רק בהודעת האישור. `isCancelCommand` מזהה גם "מחק"/"ביטול"/"cancel" כטקסט
      חופשי לתאימות. 52/52 + 323/323 ירוקים.
- [x] **סבב פידבק חמישי (2026-09-27):** (1) **הודעה ראשונה כשיש כמה צוותים כבר לא נזרקת** —
      `resolveTeamContext` שומרת אותה כ-`pendingCommentContent` ("draft" מוחזק) בזמן שרשימת
      הצוותים מוצגת; ברגע שנבחר צוות, ממשיך ישר לשאלת שימור/שיפור בלי לבקש להקליד שוב. ניסיון
      נוסף שלא תואם לא דורס draft שכבר מוחזק (רק ההודעה הראשונה נחשבת התוכן האמיתי). (2) **כפתור
      "↩️ חזור" חדש** (`BACK_COMMAND`), זמין לצד "🗑️ מחק הערה" בשלבי שימור/שיפור וקטגוריה — חוזר
      שלב אחד אחורה (מקטגוריה → חוזר לשאלת שימור/שיפור, שומר את התוכן; משימור/שיפור → מוחק את
      התוכן ומבקש להקליד מחדש), בשונה מ"מחק הערה" שמוחק הכל. 5 טסטים חדשים (328/328 ירוקים).
- [x] **סבב פידבק שישי (2026-09-27) — שינוי משמעותי בזרימה, כולל ביטול מפורש של §10.0 החלטה
      מוצרית #5 המקורית ("session-based, בלי תפוגה מבוססת-זמן"):**
      1. **תפוגת-זמן להקשר צוות/ספרינט, כברירת מחדל** — שדות חדשים ב-`UserMessagingLink`:
         `contextSetAt` (מתעדכן בכל resolve) + `contextStickyHours` (ברירת מחדל `24`, `null`=לעולם
         לא פג). `isContextStillOpen` בודק גם את זה עכשיו. תפוגה פסיבית **לא** מפעילה אישור-מפורש
         (`awaitingContextConfirm`) — אם נשאר צוות יחיד, ה-resolve הבא עדיין שקט.
      2. **שלב "איזה ספרינט?" חדש**, בין בחירת צוות לשאלת שימור/שיפור — **אותו מנגנון בדיוק** כמו
         בחירת צוות (שקט אם ספרינט פתוח יחיד לצוות, רשימה+כפתורים אם כמה). מודל הנתונים לא אכף
         "ספרינט פתוח יחיד לצוות" מעולם — עכשיו זה נתמך באמת, לא רק הונח. סדר הזרימה המלא עכשיו:
         **צוות → ספרינט → שימור/שיפור → קטגוריה**.
      3. **"↩️ חזור" משלב שימור/שיפור עכשיו חוזר לבחירת צוות (לא מוחק את ההערה)** — מנקה
         `activeTeamId`/`activeSprintId`/`contextSetAt`, מסמן `awaitingContextConfirm=true` (שומר
         את `pendingCommentContent`). ה-flag הזה **רק** מכריח את **שלב הצוות** להציג רשימה מפורשת
         (כולל צוות יחיד — "רשימה של 1" + כפתור "🗑️ מחק הערה") במקום resolve שקט; שלב הספרינט
         תמיד שקט-אם-אחד, ללא קשר ל-flag (לא התבקש כפול-אישור). `teamListKeyboard`/
         `sprintListKeyboard` קיבלו שורת "🗑️ מחק הערה" בעצמן, כך שהמשתמש רואה במפורש את אפשרות
         המחיקה בזמן אישור/שינוי צוות — לא רק דרך הקלדה חופשית.
      4. **אזכור צוות+ספרינט בתחילת שאלת שימור/שיפור** — `askTypeMessage(teamName, sprintName)`
         חדש, מציג "🏷️ *{צוות}* · ספרינט *{ספרינט}*" לפני השאלה, בכל מקום שבו היא נשאלת.
      5. **הגדרת `contextStickyHours` דרך Settings — עדיין לא ממומש.** הבקאנד תומך בזה מלא (השדה
         כבר קיים וניתן לעדכון), אבל **אין עדיין endpoint או UI** לשנות אותו — זה הפריט הבא, לא
         נשכח.
      דחפתי את שינוי הסכמה גם ל-`postgres-test` וגם ל-Neon (תוספתי בלבד, שלושה שדות חדשים).
      נכתבו טסטים חדשים ל-getOpenSprintsForTeam/רב-ספרינט/תפוגת-זמן/back-לצוות; 333/333 טסטי
      הבקאנד ירוקים.

### לא בטיפול (פיצ'ר 10)

- כל דבר מעבר להזנת תגובה בודדת ומקוטלגת לספרינט פתוח — יצירת ספרינט, הצטרפות לצוות, שליחת הזמנות,
  ניהול חברים, עריכת/מחיקת תגובה דרך הבוט (ר' §10.0 החלטה מוצרית #7) — כל אלה **לא בטיפול** בפיצ'ר
  זה במפורש.
- יצירת קטגוריה חדשה דרך הצ'אט — נשאר בלעדית באפליקציה (פיצ'ר 3).
- הגבלת קצב/הגנה מפני spam — לא ב-v1 (§10.0 החלטה מוצרית #9), אפשר להוסיף בעתיד אם משטח ההתקפה
  ישתנה (למשל אם יתווספו דרכי-קישור פחות מאומתות).
- אדפטר WhatsApp בפועל — הארכיטקטורה בפיצ'ר הזה רק *משאירה מסלול זול* להוספתו (§10.0 החלטה
  מוצרית #1-2); המימוש עצמו לא בהיקף הזה.
