# העברה לספרייה החדשה — סדר פעולות

## 1. קבצים חדשים (רק להוסיף)

```
src/design/tokens.ts
src/design/theme-context.tsx
src/design/mui-theme.ts
src/design/app-providers.tsx
src/components/ui/*            (button, field, card, badge, segmented, page, index)
src/features/settings/components/appearance-card.tsx
UI-GUIDELINES.md
```

תלות אחת חדשה, אם עוד לא מותקנת:

```
npx expo install @react-native-async-storage/async-storage
```

## 2. קבצים שמוחלפים

| קובץ | מה השתנה |
|---|---|
| `src/app/_layout.tsx` | עטוף ב-`<AppProviders>`; אין `Colors` ואין hex בקוד |
| `src/global.css` | נוסף Heebo, נוספו `--font-body` ו-body reset |
| `src/features/dashboard/components/dashboard-web.tsx` | `Page`/`PageHeader`/`Card`/`Button`; ירדו הגרדיאנטים, `Fade`/`Grow`, ואימוג׳י |
| `src/features/sprints/components/sprint-list-web.tsx` | שורות בגובה אחיד + `Badge`/`StatusDot`; ירדו `borderRight` צבעוני, `pulse`, ומיפוי צבעי מצב מקומי; נוסף פילטר `Segmented` |
| `src/features/settings/components/profile-form-card.tsx` | כל השדות דרך `<Field>`; ירדו הנקודות הדקורטיביות והגרדיאנט על הכפתור |

## 3. שינויי API לשים לב אליהם

הקומפוננטות המומרות **לא מקבלות יותר** `theme`, `isDark`, `accent`, `themeColors`, `colorScheme`.
הן קוראות `useTheme()` בעצמן. צריך למחוק את ה-props האלה בכל מקום שקורא להן:

- `<SprintRetroBoard theme={...}>` → `<SprintRetroBoard>`
- `<TeamList theme={...}>` → `<TeamList>`
- `<AuthForm isDark theme colorScheme>` → `<AuthForm>`
- `<TeamSprintsManagerWeb theme={...}>` → `<TeamSprintsManagerWeb>`
- `<ProfileFormCard isDark accent themeColors ...>` → בלי שלושתם

## 4. להוסיף למסך ההגדרות

```tsx
import { AppearanceCard } from '@/features/settings/components/appearance-card';
// ...
<ProfileFormCard ... />
<AppearanceCard />
```

## 5. מה נשאר לא-מומר

`sprint-retro-board.tsx`, `team-list.tsx`, `auth-form.tsx`, `admin-teams-card.tsx`,
`app-tabs.web.tsx` והמקבילות ה-native. אחרי שהמסכים למעלה עולים ועובדים, להעביר אותם באותה שיטה:
למחוק props של theme, להחליף `TextField`/`Button`/`Card` בספרייה, לעבור על ה-checklist בסעיף 7 של
UI-GUIDELINES.md.

## 6. בדיקה שהכל תפור

```bash
grep -rEn "#[0-9a-fA-F]{6}|rgba\(|linear-gradient|fontFamily" src --include=*.tsx | grep -v "src/design/"
```

הפלט אמור להיות ריק.
