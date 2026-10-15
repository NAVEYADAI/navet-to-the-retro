## פיצ'ר 20: נקודות לשיפור — מעקב בין ספרינטים — שלב א' מומש (2026-10-15)

> מחליף את פיצ'ר 16 (משימות המשך), שהוקפא. המימוש הראשון שלו נשמר בענף `shelved/action-items-v1` (ר' "מה אפשר לשחזר מ-16").
> החלטות 1–38 למטה התקבלו מנוה בשיחת האיפיון (2026-10-14/15). סעיף "ברירות מחדל שנקבעו בלי לשאול" מפרט מה הוכרע בלי שאלה נפרדת, ואפשר לתקן אותו בכל עת.

### נקודות מרכזיות (touchpoints)

- **מודלים (Prisma):** חדשים — `FocusPoint`, `FocusPointTextVersion`, `FocusPointSource`, `FocusPointProposal`, `FocusPointSprint`, `FocusPointRating`, `SprintRatingClose`, `FocusPointTask`; שדה חדש `Team.focusPointQuota Int @default(3)`. כולם בדפוס "ישות בבעלות צוות" (`backend/AGENTS.md`). פירוט ב-§20.1.
- **Backend:** מודול חדש `backend/src/focus-points/`; `backend/src/teams/team-permissions.util.ts::assertCanManageTeamContent` (הרשאת ניהול: `isAdmin` או `TEAM_LEADER`); `backend/src/teams/teams.service.ts` (עדכון המכסה, ניקוי זהות בעזיבה/מחיקת חשבון); `backend/src/comments/comments.service.ts` (הצעה מהערה).
- **Endpoints:** חדשים, ר' §20.1.
- **Frontend:** מרחב ניהול חדש לראש צוות/מנהל (route `team/[teamId]/focus-points`, web+native); קטע "נקודות לשיפור" בלוח הרטרו (חברי צוות מדרגים); כפתור "הצע כנקודה" על כרטיס הערה (`comment-card-web.tsx`, `renderCommentCard` ב-native); `src/constants/strings.ts`.
- **נוגע ב:** 3 (קטגוריות — לא בשלב א'), 13 (הערת מקור שנמחקה/נערכה), 14 (מחיקת ספרינט/צוות), 11 ו-15 (עזיבה/מחיקת חשבון — ניקוי זהות המדרג), 18 ("ממתין לי"), 17 (מוד רטרו חי — חיבור עתידי), 1 (שקף מגמות — עתידי), 16 (הוקפא).
- **רעיונות ב-`IDEAS.md` שנבלעים כאן:** "סימון חזרתיות על הערות" ו"גם אני" (ר' החלטות 6 ו-24).

### מטרת הפיצ'ר

היום הרטרו נגמר ברשימת הערות, ושום דבר לא עובר לספרינט הבא ולא נמדד. המטרה: מנגנון שבו הצוות **מחליט על נקודות לשיפור, זוכר אותן בין ספרינטים, מדרג אנונימית אם השתפרנו, ורואה מגמות**.
ראש הצוות ומנהל הצוות מנהלים את המנגנון יחד. חברי הצוות מציעים ומדרגים. ציונים ומגמות נחשפים רק להנהלה, ואף אחד לא יודע מי דירג מה.

### 20.0 החלטות (נוה, 2026-10-14/15)

**מהות**
1. **נקודה היא נושא חי שחוזר בין ספרינטים** (למשל "הבדיקות איטיות"), לא משימה חד-פעמית.
2. **שני סוגי נקודות.** "שיפור": יש לה מחזור חיים, מכסה, דירוג ומגמה. "שימור" (דבר טוב): **תג עם מונה בלבד** (כמה פעמים עלה), **בלי דירוג, בלי מחזור חיים ובלי מכסה**. *(פירוש שלי: שימור הוא נקודה מסוג `KEEP`. אם התכוונת לתג על נקודת שיפור קיימת, ר' ההערה בסוף.)*
3. **מתחת לנקודת שיפור יש משימות נפרדות** עם אחראי וסטטוס. ראש הצוות משייך אותן לאנשים ספציפיים. הדירוג נשאר על הנקודה, לא על המשימות.
4. **שם בממשק:** "נקודות לשיפור".

**מי מחליט ומי רואה**
5. **ראש צוות ומנהל צוות** (`TEAM_LEADER` או `isAdmin`) מנהלים ביחד במרחב ניהול ייעודי. **אחד מהם מספיק** לכל פעולה (בחירה לספרינט, מיזוג, סגירה, פתיחה מחדש). השני רואה ויכול להחזיר.
6. **כל חבר צוות מציע נקודה** מהערה ("הצע כנקודה"). **המציע לא רואה כלום אחרי כן.** כמה אנשים יכולים להציע אותה הערה, אבל אותו חבר לא מציע אותה פעמיים. ההנהלה רואה **כמה הציעו, לא מי.**
7. **מיזוג בחלון הניהול:** ראש הצוות/מנהל ממזגים הצעות ונקודות דומות גם בין ספרינטים. לנקודה הממוזגת יש **טקסט משלה** ו**רשימת ההערות שהיא נועדה לפתור**. **נשמרת היסטוריית טקסט** (מה השתנה בין ספרינטים).
8. **נקודות מוגדרות בכל עת במרחב הניהול**, לא רק בזמן הרטרו.
9. **חשיפה:** חברי הצוות רואים את **הנקודות הפעילות בספרינט ומדרגים אותן, בלי לראות ציונים קודמים.** **ציונים מצטברים ומגמות: רק ראש צוות ומנהל.**

**מחזור חיים ודירוג**
10. **מאגר נקודות** עם היסטוריית דירוגים. בכל ספרינט ההנהלה **בוחרת לקדם עד המכסה** (הגדרת צוות, **ברירת מחדל 3**, נקודות שיפור בלבד).
11. **ציון פתיחה:** ההנהלה קובעת ציון 1–5 בהכנסת נקודה למאגר. הוא לא נחשב בדירוג אנונימי.
12. **מדרגים רק את מה שנבחר לקידום באותו ספרינט.** סולם **"כמה השתפרנו" 1–5** + שדה **"למה" לא חובה**. נקודות אחרות במאגר לא מדורגות.
13. **חלון דירוג:** נפתח בסוף הספרינט (אחרי `endDate`) ונסגר כשראש הצוות/מנהל סוגרים אותו. חברים מדרגים בזמן שנוח ומכל מקום, ויכולים לשנות עד הסגירה.
14. **מי מדרג:** כל חבר צוות פעיל, **בלי פנטומים**; ראש הצוות והמנהל מדרגים גם הם.
15. **אנונימיות:** מציגים תוצאה **רק מ-3 מדרגים לפחות**. **שדה "למה" נשמר עם הזהות במסד הנתונים, אבל איש לא רואה אותו** ואין לו API. בטקסט למשתמש אסור לכתוב "אנונימי לחלוטין" אלא "אנונימי לצוות".
16. **סגירה:** נקודה נסגרת כשהממוצע **4.5 ומעלה**. אפשר גם להחליט "לשים לב עוד N ספרינטים" ואז, אם עדיין לא הגיעה ליעד, היא **מתארכבת עם ציון סופי וחוזרת למאגר** (אפשר להפעיל שוב בכל עת).
17. **"השתפרות משמעותית":** אחוז קבוע מהסולם שמוגדר במערכת (לא ע"י ראש הצוות), ושינוי בממוצע שנובע ממדרג אחד שזז נקודה אחת **לא נספר**.
18. **ספרינט בלי דירוג תקף** (אף אחד לא דירג או פחות מ-3) **לא נספר**: הנקודה ממשיכה, וספירת N והמגמה נעצרות.
19. **צוות עם פחות מ-3 חברים:** המעקב עובד, **בלי הצגת ציון** (אין דרך לשמור על אנונימיות).
20. **מחיקה/עזיבה:** **הציונים נשמרים והזהות של המדרג נמחקת** (גם במחיקת חשבון, עזיבת צוות ומחיקת ספרינט).

**ייצוא (שלב מאוחר, ההחלטות כבר קיימות)**
21. **ייצוא לאקסל: רק ראש צוות ומנהל.** הצבע **לפי הסכימה של המייצא**, בעוצמות אחידות, ועמודת טקסט לסטטוס.

### ברירות מחדל שנקבעו בלי לשאול (אפשר לתקן)

| נושא | ברירת מחדל |
|---|---|
| ערך סף "השתפרות" | **10% מהסולם (0.5)**, קבוע בקוד (`FOCUS_POINT_IMPROVEMENT_RATIO`), ניתן להעביר להגדרות מערכת בהמשך |
| חלון דירוג שלא נסגר | אין סגירה אוטומטית ואין תזכורות בשלב א' |
| עריכת טקסט נקודה | רק הנהלה, עם היסטוריה; לא משנה דירוגים קודמים |
| נקודה בלי הערת מקור | מותרת. פיצול אחרי מיזוג: לא בשלב א' |
| הערת מקור שנמחקה/נערכה (13) | הנקודה נשארת; הקישור להערה נעלם (`Cascade` על שורת הקישור) |
| "ממתין לי" (18) | דירוג שטרם בוצע בחלון פתוח נספר שם |
| שדה "למה" | נשמר ולא נחשף. השימוש בו מוחלט בעתיד |
| ממוצע מוצג | ממוצע הדירוגים התקפים האחרונים של הנקודה; אם אין, ציון הפתיחה |
| מחיקת ספרינט | דירוגים נשארים, `sprintId` הופך ל-`null` (נשמר גם `sprintEndedAt`) |

### מה אפשר לשחזר מ-16 (בענף `shelved/action-items-v1`)

טופס יצירה/עריכה ב-`Modal`, שורת משימה (web+native), כרטיס "המשימות שלי" בדשבורד (מתאים למשימות מתחת לנקודה), כפתור "הפוך למשימה" על הערה (יהפוך ל"הצע כנקודה"), ושקף במצגת. מודל `ActionItem` יהפוך ל-`FocusPointTask`. עיצוב מוקאפ: https://claude.ai/artifact/Th16BD7qCu2cLBZKKVvc9i (ישן, יעודכן).

### ממצאי מחקר (מצב הקוד היום, 2026-10-14)

- אנונימיות הערות מוסכת בצד השרת בלבד (`maskIfAnonymous` ב-`comments.service.ts`), ואיש לא יכול לחשוף כותב. אצלנו גם נדרשת **אכיפת "דירוג אחד לחבר"**, לכן נשמר `userId` ולא מוחזר לעולם.
- `assertCanManageTeamContent` (`team-permissions.util.ts`) מתאים בדיוק להרשאת ההנהלה.
- אין קישור בין הערות בין ספרינטים, אין מודל דירוג, ואין סטטיסטיקה בין ספרינטים (`frontend/src/features/sprint-summary/stats.ts` פועל על ספרינט אחד).
- ב-`backend/package.json` אין ספריית אקסל (יש רק `pptxgenjs`) — רלוונטי לשלב מאוחר.

### 20.1 Backend (שלב א')

**סכימה (`db push`, מול `postgres-test` בלבד בלי אישור מפורש):**
- `FocusPoint`: `id`, `teamId` (cascade), `kind` (`IMPROVE`|`KEEP`), `text`, `status` (`ACTIVE`|`CLOSED`|`ARCHIVED`; ל-`KEEP` רק `ACTIVE`), `initialScore Int?` (שיפור בלבד), `watchSprintsLeft Int?`, `createdById` (`SetNull`), `createdAt`, `closedAt`.
- `FocusPointTextVersion`: `focusPointId`, `text`, `changedById` (`SetNull`), `createdAt`.
- `FocusPointSource`: `focusPointId`, `commentId` (cascade), `@@unique([focusPointId, commentId])`.
- `FocusPointProposal`: `commentId` (cascade), `userId` (`SetNull`), `focusPointId?`, `status` (`PENDING`|`MERGED`|`DISMISSED`), `@@unique([commentId, userId])`.
- `FocusPointSprint`: `focusPointId`, `sprintId` (cascade), `selectedById` (`SetNull`), `@@unique([focusPointId, sprintId])`.
- `FocusPointRating`: `focusPointId`, `sprintId Int?` (`SetNull`), `sprintEndedAt DateTime`, `userId Int?` (`SetNull`), `score 1–5`, `reason String?`, `updatedAt`, אכיפת "אחד לחבר" בשירות (בדיקה לפני יצירה בתוך transaction).
- `SprintRatingClose`: `sprintId` (unique, cascade), `closedById` (`SetNull`), `closedAt`.
- `FocusPointTask`: `focusPointId` (cascade), `title`, `assigneeId?` (`SetNull`), `status` (`OPEN`|`DONE`|`DROPPED`), `dueDate?`, `createdById` (`SetNull`), `createdAt`, `closedAt?`.
- `Team.focusPointQuota Int @default(3)`.

**Endpoints** (כל אחד קורא `AuthService.validateToken` ידנית; "ניהול" = `assertCanManageTeamContent`):
- חבר: `POST /comments/:commentId/propose` (409 בהצעה כפולה; שומר מי הציע, לא מחזיר זהות); `GET /sprints/:sprintId/focus-points` (הנקודות הפעילות בספרינט + הדירוג שלי + מצב החלון, **בלי ציונים**); `PUT /focus-points/:id/rating` (`{ sprintId, score, reason? }`, רק בחלון פתוח).
- ניהול: `GET /teams/:teamId/focus-points` (מאגר + ציונים מצטברים + מגמה בסיסית לפי ספרינט, רק כשיש ≥3 מדרגים); `GET /teams/:teamId/focus-point-proposals` (מקובצות לפי הערה, **רק מספר מציעים**); `POST /teams/:teamId/focus-points`; `PATCH /focus-points/:id` (טקסט+היסטוריה, ארכוב/הפעלה מחדש, `watchSprintsLeft`); `POST /focus-points/:id/merge`; `PUT`/`DELETE /sprints/:sprintId/focus-points/:id/select` (אכיפת מכסה, `IMPROVE` בלבד); `POST /sprints/:sprintId/rating-close` (רק אחרי `endDate`); `PATCH /teams/:teamId/focus-point-settings` (מכסה); משימות: `POST /focus-points/:id/tasks`, `PATCH`/`DELETE /focus-point-tasks/:id`.

**לוגיקה:**
- [x] חישוב ממוצע, סף השתפרות (החלטה 17), סגירה ב-4.5, ארכוב בסיום N, ספרינט לא תקף (החלטות 16, 18, 19) — **כפונקציות טהורות עם בדיקות**.
- [x] ניקוי זהות: עזיבת צוות/הסרה (11) מאפסת `userId` בדירוגים ובהצעות (`clearFocusPointIdentity`, נקרא מ-`leaveTeam` ו-`removeMember`); מחיקת חשבון (15) וספרינט שנמחק סופית (14) מטופלים ע"י `onDelete: SetNull` בסכימה. *(משימות לא מאופסות: נשארות משויכות, כמו ב-16.)*
- [x] סכימה + מודול `backend/src/focus-points/` (3 services + controller), Jest (`focus-point-score.spec.ts`, חלק ב-`teams.service.spec.ts`) ו-backend e2e (`test/focus-points.e2e-spec.ts`, 17 בדיקות). `db push` רץ רק מול `postgres-test`.

### 20.2 Frontend (שלב א')

- [x] מרחב ניהול (web+native): מאגר, הצעות (עם מספר מציעים), מיזוג, בחירה לספרינט עם מונה מכסה, סגירת חלון דירוג, ציונים ומגמה בסיסית (טבלה לפי ספרינט + חץ שיפור/הידרדרות), משימות מתחת לנקודה, הגדרת מכסה.
- [x] לוח הרטרו: קטע "נקודות לשיפור" לחבר: הנקודות הפעילות + דירוג 1–5 + "למה" אופציונלי, כשהחלון פתוח.
- [x] "הצע כנקודה" על כרטיס הערה (מצב "הצעת כבר").
- [x] "המשימות שלי" בדשבורד (משימות מתחת לנקודות).
- [x] ללא הצגת ציון בצוות קטן וכשפחות מ-3 דירגו (הודעת "אין מספיק דירוגים").
- [x] `trackEvent`: `focus_point_proposed`, `focus_point_created`, `focus_point_selected`, `focus_point_deselected`, `focus_point_merged`, `focus_point_rated`, `rating_window_closed`, `focus_point_task_created`, (ר' טבלת האירועים בסעיף "ניטור ומעקב תהליכים" למטה).
- [x] בדיקת מובייל ב-375px; Jest web+native.
- [ ] עדכון הקנבס להתאמה למודל הזה (מוקאפ ישן עדיין מראה תפקידים) — **לא נעשה**, המסכים נבנו לפי הקוד הקיים והעיצוב של האפליקציה.

### 20.3 בדיקות

- [x] Jest backend: אנונימיות (אף תשובה לא מחזירה `userId` של מדרג/מציע), 3 מדרגים מינימום, מכסה, חלון, ספרינט לא תקף, ניקוי זהות, מיזוג והיסטוריית טקסט.
- [x] backend e2e מול `postgres-test`: הצעה → מיזוג → בחירה → דירוג של 3 חברים → סגירת חלון → ציון מוצג רק להנהלה.
- [x] Playwright (Desktop+Mobile): חבר מציע; ראש צוות ממזג ובוחר; 3 חברים מדרגים; ההנהלה רואה ציון וחבר רגיל לא.

### ניטור ומעקב תהליכים (נוסף 2026-10-15, לפי בקשת נוה: "הכל חוץ מהזניח")

**עיקרון:** PostHog מזהה את המשתמש (`identifyUser` עם אימייל ושם משתמש). לכן **אירוע דירוג לא נושא ציון או מזהה נקודה** — רק השתתפות. אותו כלל בלוגים בשרת: אף שורה לא מקשרת אדם לדירוג או להצעה (רק ראש צוות/מנהל מופיעים כ-`byManager`).

**צד לקוח (`trackEvent`):**

| אירוע | מתי | מאפיינים |
|---|---|---|
| `focus_points_opened` | כניסה למרחב הניהול מהלוח | `screen` |
| `focus_points_screen_viewed` | טעינה ראשונה מוצלחת של המרחב | `teamId, quota, resultsHidden, activePoints, keepPoints, pendingProposals` |
| `focus_points_load_failed` | טעינת המרחב נכשלה | `teamId, status` |
| `focus_point_action_failed` | פעולת ניהול נכשלה (למשל מכסה מלאה = 409) | `teamId, action, status` |
| `focus_points_sprint_changed` | החלפת ספרינט במרחב | |
| `focus_points_back_clicked`, `refresh_clicked` | חזרה / רענון | |
| `focus_point_form_opened`, `focus_point_edit_opened` | פתיחת טופס נקודה | |
| `focus_point_form_abandoned` / `_validation_failed` / `_submit_failed` | נטישת טופס / טקסט ריק / שמירה נכשלה | `mode` (+ `status`) |
| `focus_point_created` | נקודה נוצרה | `teamId, kind, fromProposal` |
| `focus_point_edited`, `focus_point_merged`, `focus_point_archived`, `focus_point_reopened` | עריכה / מיזוג / ארכוב / החזרה | `teamId` (במיזוג) |
| `focus_point_watch_changed` | מעקב N ספרינטים | `cleared` |
| `focus_point_selected` / `focus_point_deselected` | בחירה / הסרה מספרינט | `teamId, sprintId, selectedCount, quota` |
| `focus_point_proposal_dismissed` | דחיית הצעה | `teamId` |
| `rating_window_close_clicked` / `_cancelled` | פתיחת/ביטול אישור סגירה | |
| `rating_window_closed` | החלון נסגר בפועל | `teamId, sprintId, points, closed, archived, continues, notCounted` |
| `focus_point_quota_changed` | שינוי מכסה | `teamId, quota` |
| `focus_point_task_form_*`, `focus_point_task_created` / `_status_changed` / `_deleted` | משימות | `assigned`, `status` |
| `sprint_focus_points_viewed` | חבר ראה את קטע הדירוג בלוח (פעם אחת) | `sprintId, points, window, alreadyRated` |
| `sprint_focus_points_load_failed` | טעינת הקטע נכשלה | `sprintId, status` |
| `focus_point_proposed` / `_propose_failed` / `_propose_duplicate` | הצעה / נכשלה / כבר הוצעה (409) | `sprintId` (+ `status`) |
| `focus_point_rated` / `_rate_failed` | דירוג נשמר / נכשל | `sprintId, isUpdate, hasReason` (+ `status`) — **בלי ציון** |
| `my_focus_tasks_viewed` / `_load_failed` | כרטיס "המשימות שלי" | `count, overdue` |

**צד שרת (לוג מובנה, `Logger`):** שורה אחת לכל אירוע דומיין בפורמט `focus_point.<event> key=value ...` — `created`, `updated`, `merged`, `quota_changed`, `proposals_dismissed`, `proposed`, `rated` (בלי ציון ובלי מדרג), `selected`, `deselected`, `window_closed` (עם ספירות תוצאה), `task_created`, `task_updated`, `task_deleted`. לצד יומן הבקשות הקיים (`LoggingMiddleware`). נבדק ב-e2e שהשורות של דירוג לא מכילות מזהה משתמש, ציון או סיבה.

### לא בטיפול (פיצ'ר 20, שלב א')

- **ייצוא לאקסל** (החלטה 21 נשמרת): טווח, מטריצה מול טבלה שטוחה, האם כולל ציונים, צילום מצב — עוד לא מאופיין. חסרה ספריית אקסל.
- **תצוגת מגמה גרפית** (ציר זמן, ספארקליין, "בריאות צוות").
- **חיבור למוד הרטרו החי (17)** וכל התראות/תזכורות (10).
- **שימוש בשדה "למה"**, מפת חום לפי קטגוריות, יעדים לנקודה, יומן שינויים מלא, קישורים חיצוניים.
- **פיצול נקודה אחרי מיזוג.**

### הערה לאישור

החלטה 2: הבנתי "שימור כתג עם מונה" כנקודה מסוג `KEEP` שמוצגת ומונה כמה פעמים עלתה, בלי דירוג. אם התכוונת שהשימור הוא **תג על נקודת שיפור קיימת** (נקודה אחת שיכולה להיות גם "שיפור" וגם "דבר טוב"), זה משנה את `FocusPoint.kind` לשדה `isKeep`.

### הערות מימוש (2026-10-15)

- **ענף:** `feature/20-focus-points` (מקומי, לא נדחף). הענף `shelved/action-items-v1` נשאר כמות שהוא.
- **Backend:** `backend/src/focus-points/` — `focus-points.service.ts` (מאגר, מיזוג, הצעות, רשימת ניהול), `focus-point-rating.service.ts` (הצעה, בחירה לספרינט, דירוג, סגירת חלון), `focus-point-tasks.service.ts`, `focus-point-score.ts` (חוקי הציון כפונקציות טהורות). תוצאות מופיעות רק אחרי סגירת החלון, ורק מ-3 מדרגים בצוות של 3 ומעלה; שאילתות הניהול לעולם לא בוחרות `userId` או `reason` של דירוג.
- **מיזוג:** הנקודה שמוזגה נשארת כשורה מוסתרת `MERGED` (עם `mergedIntoId`) שומרת את הדירוגים שלה אם לא הועברו; הערות, הצעות ומשימות עוברות ליעד.
- **Frontend:** `frontend/src/features/focus-points/` — מרחב ניהול בנתיב `/team/:teamId/focus-points` (web+native), קטע דירוג בלוח לחבר, "הצע כנקודה" בכרטיס הערה, "המשימות שלי" בדשבורד. כניסה למרחב הניהול: כפתור "נקודות לשיפור" בכותרת לוח הרטרו (לראש צוות/מנהל בלבד). Jest web+native ו-Playwright (`frontend/e2e/focus-points.spec.ts`, Desktop+Mobile) ירוקים.
- **ישן ב-`sprint-retro-board.test.tsx`:** נוספו 2 קריאות GET בעליית הלוח (נקודות הספרינט וההצעות שלי), ומספר הקריאות המצופה עודכן.

**לא נעשה / ידוע:**
- `db push` מול Neon האמיתי **רץ ב-2026-10-15 באישור נוה** (דרך קונטיינר הפיתוח; בדיקת `migrate diff` קודם הראתה תוספות בלבד: עמודה אחת עם ברירת מחדל `Team.focusPointQuota` ו-8 טבלאות חדשות). הרקע: סביבת ה-Docker של הפיתוח רצה על קוד הענף מול Neon, וללא העמודה `GET /teams/user/me` נפל ב-500.
- הפרשנות של "שימור" כנקודה מסוג `KEEP` (ר' "הערה לאישור" למטה) לא אושרה סופית.
- בנתיב הניהול, עריכת נקודה קיימת מאפשרת לשנות רק את הטקסט (לא ציון פתיחה).
- בדיקה ידנית ב-native בפועל (סימולטור) לא בוצעה; רק Jest.
- הכפתור "נקודות לשיפור" בלוח לא מוצג למי שאינו ראש צוות/מנהל (הנתיב עצמו מחזיר 403 מהשרת).
