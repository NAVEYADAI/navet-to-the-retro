# Frontend — AGENTS.md

> Sprint Retrospective Board — Expo (React Native + Web) frontend.
> Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## UI — חובה

כל עבודת UI עוברת דרך @UI-GUIDELINES.md. קרא אותו **לפני** כתיבת מסך, קומפוננטה או תיקון עיצובי.

בקצרה, ובלי חריגות:

- צבע, גופן, ריווח, רדיוס וצל — **רק** מ-`useTheme()` / `src/design/tokens.ts`. אין hex, `rgba(`, `linear-gradient` או `fontFamily` בשום קובץ מחוץ ל-`src/design/`.
- כל קלט עובר דרך `<Field>` מ-`@/components/ui`. אין `TextField` ישיר תחת `features/`.
- כל מסך עטוף ב-`<Page>` + `<PageHeader>`, תוכן ב-`<Grid columns={n}>` עם מספר טורים קבוע.
- כפתור `primary` אחד לכל מסך.
- RTL: `dir` בשורש בלבד, מאפיינים לוגיים בלבד, אין `row-reverse`.
- אין `Grow` / `Fade` / `pulse` על טעינת מסך.

לפני סיום כל משימת UI — עבור על ה-checklist בסעיף 7 של UI-GUIDELINES.md והצהר שכל סעיף עומד.

**מצב נוכחי (בתהליך אימוץ הדרגתי):** `src/design/*` ו-`src/components/ui/*` כבר קיימים וזמינים.
מסכים שעדיין לא הומרו ל-`useTheme()` ומשתמשים בדפוס הישן (`theme`/`isDark`/`colorScheme` כ-prop,
`Colors` מ-`constants/theme.ts`, MUI ישיר) — ראה את רשימת המשימות המדורגת ב-`UI-MIGRATION-BACKLOG.md`.
אל תמיר מסך קיים לפי הכללים האלה כחלק אגבי של משימה אחרת; זו עבודה ממוקדת בפני עצמה שעוברת דרך
הבאקלוג הזה (או דרך סוכן ה-`ui-migration`), כדי לא לשבור מסכים שהילדים שלהם עדיין לא הומרו.

## Tech Stack

- **Framework:** Expo SDK 57 + React Native 0.86 + React 19.2
- **Routing:** expo-router (file-based, `src/app/` directory)
- **Web UI:** MUI Material v9 (`@mui/material`) + Emotion
- **Animations (web):** Framer Motion v13, CSS keyframes (injected in `_layout.tsx`)
- **Animations (native):** React Native Reanimated 4.5, LayoutAnimation
- **HTTP:** axios
- **Language:** TypeScript 6.x (strict mode — no implicit `any`)
- **Font:** Rubik (Google Fonts, loaded via CSS `@import` in `_layout.tsx`)

## Architecture Patterns

### Platform Branching

Every major component uses **platform branching** — DO NOT mix RN and MUI in the same render path:

```tsx
export function MyComponent(props: Props) {
  if (Platform.OS === 'web') return <MyComponentWeb {...props} />;
  return <MyComponentNative {...props} />;
}
```

- **Web variant:** Uses MUI components (`Box`, `Typography`, `Card`, `TextField`, `Button`, etc.)
- **Native variant:** Uses React Native components (`View`, `Text`, `TextInput`, `TouchableOpacity`, etc.)

Platform-specific files use the `.web.tsx` / `.tsx` suffix convention (e.g., `app-tabs.web.tsx` vs `app-tabs.tsx`).

### Component Theme Prop

Most components receive a `theme` prop with these 5 color tokens:

```tsx
theme: {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
}
```

These come from `Colors.light` / `Colors.dark` in `src/constants/theme.ts`.

### Accent Colors (Hardcoded)

The accent colors are NOT in the theme object — they are hardcoded in components:

- Light accent: `#6366f1` (indigo-500)
- Dark accent: `#818cf8` (indigo-400)
- Hover: `#4f46e5` (light) / `#a5b4fc` (dark)

Pattern used:
```tsx
const isDark = colorScheme === 'dark';
const accent = isDark ? '#818cf8' : '#6366f1';
```

## RTL / Hebrew

- **All UI strings are in Hebrew.** Use `src/constants/strings.ts` (the `Strings` object).
- **Always add new strings to `Strings`** — never hardcode Hebrew text in components.
- **RTL layout:** Use `direction: 'rtl'` on web containers, `flexDirection: 'row-reverse'` for horizontal layouts, `textAlign: 'right'` for text.
- Some strings are functions: `Strings.dashboard.welcomeTitle(name)`.

## Backend API Communication

### Backend URL Pattern

Every component that calls the API uses this exact pattern:

```tsx
const getBackendUrl = () => {
  return Platform.OS === 'web'
    && typeof window !== 'undefined'
    && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
};
```

### Auth Header

All authenticated requests pass:
```tsx
headers: { 'Authorization': `Bearer ${token}` }
```

The `token` comes from `useAuth()` context (`src/context/auth-context.tsx`).

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login (accepts username or email) |
| `GET` | `/auth/me` | Validate token, get user |
| `PATCH` | `/auth/profile` | Update user profile |
| `POST` | `/teams` | Create team (creator = TEAM_LEADER + admin) |
| `GET` | `/teams/user/me` | Get teams for current user |
| `POST` | `/teams/:id/members` | Add member (TEAM_LEADER only) |
| `GET` | `/teams/:id/members` | Get team members |
| `PATCH` | `/teams/:teamId/members/:memberId` | Update member role/admin |
| `PATCH` | `/teams/:id` | Update team details (admin only) |
| `POST` | `/teams/:teamId/sprints` | Create sprint (admin only) |
| `GET` | `/teams/:teamId/sprints` | Get sprints for team |
| `POST` | `/sprints/:sprintId/comments` | Post retro comment (KEEP/IMPROVE) |
| `GET` | `/sprints/:sprintId/comments` | Get comments (anonymous masking for non-admins) |

## Styling

### Web (MUI)

- Use MUI `sx` prop for styling — NOT inline `style`
- Glassmorphism: `backdropFilter: 'blur(Xpx)'`, semi-transparent backgrounds
- Gradients: `background: 'linear-gradient(135deg, ...)'`
- Font: Always set `fontFamily: 'Rubik, sans-serif'` on MUI Typography/components
- Animations: Use CSS keyframe names defined in `_layout.tsx` (e.g., `animation: 'fadeInUp 0.5s ease both'`)
- Shadows on web: Use `boxShadow` (NOT RN shadow props which trigger deprecation warnings)

### Native (React Native)

- Use `StyleSheet.create()` for styles
- Use `ThemedText` and `ThemedView` for themed components
- Spacing: Use tokens from `Spacing` (`half=2, one=4, two=8, three=16, four=24, five=32, six=64`)
- Shadows: Use `getShadow(opacity, radius, offsetHeight)` utility (defined in team-list, sprint-retro-board)

## Project Structure

```
src/
├── app/                          # Expo Router pages
│   ├── _layout.tsx               # Root layout: AuthProvider + ThemeProvider + auth gate + global CSS
│   ├── index.tsx                 # Home/Dashboard page (teams + retro board)
│   └── settings.tsx              # Settings page (profile, create/edit team)
├── components/
│   ├── auth-form.tsx             # Login/Register form (615 lines)
│   ├── app-tabs.tsx              # Native tab navigation
│   ├── app-tabs.web.tsx          # Web floating glassmorphism navbar
│   ├── team-list.tsx             # Team cards with members + add member (890 lines)
│   ├── team-sprints-manager.tsx  # Sprint list + create sprint (883 lines)
│   ├── sprint-retro-board.tsx    # Retro board: KEEP/IMPROVE columns (1326 lines)
│   ├── create-team-form.tsx      # Create team form (RN only, 179 lines)
│   ├── account-details.tsx       # User profile card
│   ├── themed-text.tsx           # Theme-aware Text wrapper
│   ├── themed-view.tsx           # Theme-aware View wrapper
│   ├── animated-icon.tsx         # Native animated icon
│   ├── animated-icon.web.tsx     # Web animated icon
│   └── __tests__/                # Component tests (Jest + React Testing Library)
├── constants/
│   ├── theme.ts                  # Colors, Fonts, Spacing, layout constants
│   └── strings.ts                # All Hebrew UI strings
├── context/
│   └── auth-context.tsx          # AuthProvider: token, user, login(), logout()
└── hooks/
    ├── use-theme.ts              # Returns Colors[scheme]
    ├── use-color-scheme.ts       # Native: re-exports RN useColorScheme
    └── use-color-scheme.web.ts   # Web: hydration-safe color scheme
```

## Testing

- **Runner:** Jest + jest-expo
- **Test library:** @testing-library/react-native
- **Mocks:** CSS modules mocked in `jest/css-mock.js`, Framer Motion mocked in `jest/framer-motion-mock.js`
- **Run:** `npm test` from frontend directory
- Tests are in `src/components/__tests__/`

## Auth Flow

1. `_layout.tsx` wraps in `AuthProvider`
2. On mount: AuthContext reads `userToken` from localStorage (web) / memory (native)
3. If token found → calls `GET /auth/me` to validate → sets `token` + `user` state
4. If invalid → removes token, shows `AuthForm`
5. If no token → shows `AuthForm`
6. Login/Register → receives `{ accessToken, user }` → saves to storage → sets context
7. Logout → removes from storage → clears context → shows `AuthForm`

## Deployment

- **Platform:** Fly.io (CDG region)
- **Frontend prod URL:** `https://navet-to-retro-frontend.fly.dev`
- **Backend prod URL:** `https://navet-to-retro-backend.fly.dev`
- **Build:** `expo export --platform web` → served via nginx on port 8080
- **Deploy:** `fly deploy` from frontend directory (or `npm run deploy` from root which runs tests first)
