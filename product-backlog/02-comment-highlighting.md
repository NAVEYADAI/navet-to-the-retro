## פיצ'ר 2: הדגשת הערות

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** `Comment.isHighlighted Boolean @default(false)` (שדה חדש).
- **Backend:** `backend/src/teams/team-permissions.util.ts::assertCanManageTeamContent` — **נוצר כאן**, משותף גם לפיצ'רים 3, 5, 9; `backend/src/comments/comments.controller.ts`+`comments.service.ts::setHighlighted`.
- **Frontend:** `comment-card-web.tsx`, `sprint-retro-board-native.tsx` (`renderCommentCard`), `comment-filter-bar-web.tsx`/`-native.tsx` (toggle "מודגשות בלבד").
- **Endpoints:** `PATCH /comments/:commentId/highlight`.
- **משפיע על:** פיצ'ר 1 (שקף ייעודי לתגובות מודגשות במצגת, עדיין לא מומש שם).


מטרת הפיצ'ר: לאפשר למנהלי צוות ולראשי צוותים לסמן תגובות רטרו ספציפיות כ"מודגשות", כדי
שיבלטו ויזואלית ללוח לכל חברי הצוות — למשל תגובות חשובות במיוחד שכדאי שלא יאבדו בין שאר
התגובות.

### 2.0 החלטות שנקבעו

- **הרשאה:** רק מי ש-`TeamMember.isAdmin === true` **או** `TeamMember.role === 'TEAM_LEADER'`
  (בעברית: "מנהלי צוות וראשי צוותים") יכול להדגיש/לבטל הדגשה של תגובה. זו החלטה מפורשת של
  נוה. **הערה חשובה לתיעוד בקוד:** כפי שהוסבר בפיצ'ר 1 סעיף 1.0 — `role` הוא לדברי
  `teams.service.ts` "free-text job title" שכל admin יכול לשנות בחופשיות, כך ש-`TEAM_LEADER`
  יכול תיאורטית "לדלוף" למישהו שאינו ראש הצוות המקורי (או להיעלם ממי שהוא כן). זה סיכון
  מקובל שהמשתמש מודע לו ובחר בו במפורש עבור הפיצ'ר הזה — לא באג לתקן.
- **שילוב עתידי עם פיצ'ר 1 (ייצוא למצגת):** תגובות מודגשות יקבלו שקף/סעיף ייעודי משלהן
  במצגת שמופקת בפיצ'ר 1 (ראו פריט תלוי ב-1.1 למעלה) — לממש את פיצ'ר 2 **קודם** לפיצ'ר 1
  אם רוצים את השילוב הזה בפועל, או לפחות לפני שקף התגובות המודגשות הספציפי שם.

### ממצאי מחקר

- **אין שום מנגנון mutation קיים על Comment היום.** `backend/src/comments/` חושף רק
  `POST /sprints/:sprintId/comments` ו-`GET /sprints/:sprintId/comments` — אין PATCH/DELETE/
  edit/react/pin בכלל. הדגשה תהיה ה-mutation הראשונה על תגובה קיימת.
- **מודל `Comment`** (`backend/prisma/schema.prisma:202-217 (עודכן 2026-09-14)`): `id, content, type, category?,
  isAnonymous, createdAt, authorId, teamId, sprintId` — אין שדה הדגשה/pin/star קיים, ואין
  טבלת junction. יידרש שדה חדש.
- **`CommentCardWeb`** (`frontend/src/features/retro/components/comment-card-web.tsx`) הוא
  קומפוננטה תצוגתית טהורה — `{comment, index}` בלבד, בלי שום prop הרשאה ובלי שום כפתור
  פעולה קיים (לא עריכה, לא מחיקה, שום דבר). המקבילה ב-native היא `renderCommentCard` מוטמע
  בתוך `sprint-retro-board-native.tsx` (שורות ~138-183), באותו מצב — בלי כפתורי פעולה.
- **`isAdmin` לא מגיע ל-`SprintRetroBoard` היום** (`props: {sprint, team, token, user,
  onBack}` בלבד, `frontend/src/features/retro/index.tsx`) — אבל הנתון הגולמי כן קיים על
  אובייקט `team` שכבר מגיע לשם: או `team.roleInTeam` (משורת `teams.service.ts:311-316`), או
  `team.members.find(m => m.user.id === user.id)` (מערך `members` מלא, כולל `role`+
  `isAdmin`), **בדיוק אותו דפוס שכבר בשימוש** ב-`team-list-web/team-card.tsx:29`
  (`myMembership?.isAdmin`). כלומר אין צורך בשינוי API כדי לדעת בצד הלקוח האם המשתמש
  הנוכחי יכול להדגיש — רק בהוספת prop חדש שמעביר את זה הלאה עד לכרטיס התגובה.
- **`comment-filter-bar-web.tsx`/`-native.tsx`** כיום: `{categories: string[],
  onCategoriesChange, searchText, onSearchTextChange}` — צורת state שטוחה. הוספת
  `highlightedOnly: boolean` + `onHighlightedOnlyChange` מתאימה בקלות לאותו דפוס, בלי
  שינוי מבני.

### 2.1 Backend — done

- [x] שדה חדש `Comment.isHighlighted Boolean @default(false)` ב-`schema.prisma`. **אין
      migrations בפרויקט הזה** (workflow הוא `prisma db push`, לא `prisma migrate`) —
      הורץ `npx prisma db push` הן מול ה-DB האמיתי (Neon `neondb` — זה גם ה-DB של הפיתוח
      המקומי, אין DB נפרד לדב) והן מול `postgres-test` (`.env.test`). שדה תוסף גרידא עם
      `@default(false)` — בלי סיכון סמנטי (בניגוד למקרה שתועד ב-
      [[feedback-prisma-schema-defaults]] — שם ברירת המחדל טענה עובדה עסקית שגויה על שורות
      קיימות; כאן "לא הודגש" הוא באמת נכון לכל תגובה ישנה).
- [x] `guard` משותף נוצר בפועל (לא רק המלצה): `backend/src/teams/team-permissions.util.ts`
      → `assertCanManageTeamContent(prisma, teamId, requesterId)` — `isAdmin===true ||
      role==='TEAM_LEADER'`. ישמש גם את פיצ'ר 3.
- [x] `PATCH /comments/:commentId/highlight` (לא `/sprints/:sprintId/comments/:commentId` —
      פשוט יותר, ה-`commentId` כבר מספיק כדי לשלוף את ה-`teamId` שלו).
      `backend/src/comments/comments.controller.ts` + `comments.service.ts::setHighlighted`.
- [x] `getCommentsForSprint` כבר מחזיר `isHighlighted` בלי שינוי (אין `select` מצומצם על
      Comment, כל השדות הסקלריים חוזרים ממילא).

### 2.2 Frontend — done (web+native)

- [x] `canHighlight` מחושב ב-`SprintRetroBoardWeb`/`Native` (`team.members?.find(m =>
      m.userId === user.id)`, בדיוק אותו דפוס כמו `team-card.tsx`), מועבר ל-`CommentCardWeb`
      / ל-`renderCommentCard` הפנימי ב-native.
- [x] כפתור/אייקון "כוכב" (`Icon name="star"`, כבר קיים ברשימת האייקונים) — לחיץ ופעיל רק
      כש-`canHighlight` (עם `PATCH` + עדכון אופטימי + rollback בשגיאה); כשה-תגובה
      `isHighlighted` וללא `canHighlight` — כוכב סטטי (לא כפתור) כדי שכולם יראו שהיא מודגשת.
      עיצוב הכרטיס המודגש: `backgroundColor: t.color.accent.subtle` +
      `border: 1px solid t.color.accent.border` — מטוקנים בלבד, בלי hex ידני.
- [x] אותו מימוש ב-`renderCommentCard` הפנימי של `sprint-retro-board-native.tsx`.
- [x] `highlightedOnly` toggle נוסף ל-`comment-filter-bar-web.tsx`/`-native.tsx` ("מודגשות
      בלבד").
- [x] מחרוזות: `Strings.retroBoard.highlightButton`/`unhighlightButton`/
      `highlightedOnlyFilterLabel`.

### 2.3 בדיקות — done

- [x] Playwright e2e — `frontend/e2e/comment-highlighting.spec.ts` (Desktop+Mobile Chrome,
      שניהם עוברים): ראש-צוות מדגיש/מבטל הדגשה ומסנן "מודגשות בלבד" בהצלחה; חבר-צוות רגיל
      (DEVELOPER, לא admin ולא TEAM_LEADER) נכנס לאותו ספרינט ורואה שאין בכלל כפתור הדגשה
      (לא רק מוסתר-אבל-קיים — `getByRole('button', ...)` מחזיר 0 תוצאות). **עודכן
      (2026-09-01):** התגובה המודגשת מקבלת קטגוריה (`TESTING`) — מוודא שה-badge והכפתור
      מתקיימים יחד באותה שורה בלי להתנגש. נוסף אימות RTL: `boundingBox()` מוודא שה-badge
      (ראשון ב-JSX) נמצא ממש מימין לכפתור ההדגשה (שני ב-JSX) — לא רק "נראה טוב" בצילום מסך.
- [x] Jest (2026-09-02): `backend/src/comments/comments.service.spec.ts` (חדש) — `setHighlighted`
      עם guard `isAdmin===true || role==='TEAM_LEADER'` (כולל: אין הרשאה כלל, admin מותר,
      team-leader-לא-admin מותר, ביטול הדגשה). לא נכתב Jest לרכיבי ה-UI עצמם (כרטיס
      התגובה/סרגל הפילטרים) — הכיסוי שם נשאר דרך e2e+`tsc`.
- [x] אומת ידנית בדפדפן אמיתי (לא רק Playwright): לחיצה על הכוכב שולחת `PATCH
      /comments/:id/highlight` (200, נבדק ב-Network tab), הכרטיס מקבל את הרקע/מסגרת
      המודגשים, הכוכב עובר לצבע accent, והפילטר "מודגשות בלבד" בפועל מסנן נכון.
