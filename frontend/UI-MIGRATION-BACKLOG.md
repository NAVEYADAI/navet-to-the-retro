# UI migration backlog

Ordered, dependency-first checklist for converting the rest of the frontend to the design system in
`src/design/` + `src/components/ui/` (see `UI-GUIDELINES.md` — read it before touching any item here).

**Foundation status: done.** `src/design/tokens.ts`, `theme-context.tsx`, `mui-theme.ts`,
`app-providers.{web,}.tsx`, and all of `src/components/ui/*` exist and are wired into
`src/app/_layout.tsx` via `<AppProviders>`. No existing screen has been converted yet — every item
below still uses the old pattern (`theme`/`isDark`/`colorScheme`/`accent`/`themeColors` props,
`Colors` from `constants/theme.ts`, direct MUI usage).

**Ordering rule — do not reorder.** Items are listed bottom-up by dependency: a component only stops
requiring its `theme`-shaped prop once every child it renders has already been converted (or never took
one). Converting a parent before its children breaks the children, which still expect that prop.
Reference conversions the design tool already produced (for items marked "has reference") live under
`.design-migration-reference/` — read the live file first (it may have diverged since), then adapt the
reference rather than starting from scratch.

Effort ratings are from a direct line-count / theme-prop / raw-color-usage survey of each file.

## 1. Settings — first task, proves the pipeline end-to-end

- [x] `src/features/settings/components/profile-form-card.tsx` — self-contained, no unconverted
      children. **Has reference.** Small.
- [x] `src/features/settings/components/appearance-card.tsx` — new file, self-contained. **Has
      reference.** Small. Add it under `ProfileFormCard` in `src/app/settings.tsx` (remove
      `isDark`/`accent`/`themeColors` from the `ProfileFormCard` call only — `AdminTeamsCard` on the
      same page is untouched, still gets the old props, until its own turn below).

## 2. Teams — leaves (convert all of these before touching `team-card.tsx`)

- [x] `src/features/teams/components/team-list-web/pending-approval-card.tsx` — Small
- [x] `src/features/teams/components/team-list-native/pending-approval-card.tsx` — Small
- [x] `src/features/teams/components/team-list-web/pending-membership-card.tsx` — Small
- [x] `src/features/teams/components/team-list-native/pending-membership-card.tsx` — Small
- [x] `src/features/teams/components/team-list-web/add-member-form.tsx` — Small-Medium
- [x] `src/features/teams/components/team-list-native/add-member-form.tsx` — Small-Medium
- [x] `src/features/teams/components/team-list-web/team-member-row.tsx` — Medium
- [x] `src/features/teams/components/team-list-native/team-member-row.tsx` — Medium

## 3. Teams — composites (only after all of section 2 is checked off)

- [x] `src/features/teams/components/team-list-web/team-card.tsx` — Medium
- [x] `src/features/teams/components/team-list-native/team-card.tsx` — Medium
- [x] `src/features/teams/components/team-list-web/invite-links-panel.tsx` — **Large**
- [x] `src/features/teams/components/team-list-native/invite-links-panel.tsx` — **Large**
- [x] `src/features/teams/components/team-list-web/index.tsx` — Small (just re-exports; convert last)
- [x] `src/features/teams/components/team-list-native/index.tsx` — Small
- [x] `src/features/teams/components/team-list-native/styles.ts` — Small (roll into the components that use it as inline `useTheme()` values; delete the file once nothing imports it)

## 4. Retro — leaves

- [x] `src/features/retro/components/comment-card-web.tsx` — Small
- [x] `src/features/retro/components/comment-filter-bar-web.tsx` — Small
- [x] `src/features/retro/components/comment-filter-bar-native.tsx` — Medium
- [x] `src/features/retro/components/retro-wheel-toggle.tsx` — Small-Medium (high raw-color density despite small size — take care)

## 5. Retro — composite (only after section 4 is done)

- [x] `src/features/retro/components/sprint-retro-board-web.tsx` — **Large**
- [x] `src/features/retro/components/sprint-retro-board-native.tsx` — **Large**

## 6. Auth

- [x] `src/features/auth/components/role-selector-chips.tsx` — Small-Medium (high raw-color density)
- [x] `src/features/auth/components/auth-form-web.tsx` — **Large**
- [x] `src/features/auth/components/auth-form-native.tsx` — Medium-Large
- [x] Update the one call site in `src/app/_layout.tsx` (and `src/app/invite/[token].tsx`) to stop
      passing `isDark`/`theme`/`colorScheme` to `<AuthForm>` once both platforms above are converted.

## 7. Settings (remaining) + navigation

- [x] `src/features/settings/components/admin-teams-card.tsx` — Medium
- [x] `src/components/navigation/app-tabs.web.tsx` — Medium
- [x] `src/components/navigation/app-tabs.tsx` (native) — Trivial, already near-compliant (uses `useColorScheme()` internally)
- [x] `src/components/navigation/app-tabs.styles.ts` — Small

## 8. Dashboard + sprint list — last (blocked on sections 2–6)

- [x] `src/features/dashboard/components/dashboard-web.tsx` — **Has reference**, but the reference
      drops the `theme` prop to `<TeamList>`/`<SprintRetroBoard>` — only apply it once sections 2–5 are
      fully done, otherwise it breaks both.
- [x] `src/features/dashboard/components/dashboard-native.tsx` — Medium
- [x] `src/features/sprints/components/sprint-list-web.tsx` — **Has reference**, same caveat as
      dashboard-web (renders team/sprint children — verify no unconverted child remains before applying).
- [x] `src/features/sprints/components/sprint-list-native.tsx` — Medium-Large

## Not covered by this backlog

`src/components/ui/*` is web-only today (built on MUI). Native equivalents (`*.native.tsx` per
`UI-GUIDELINES.md` §9) don't exist yet — none of the native items above can actually consume the shared
primitives until those are built. Add "build native `ui/` primitives" as its own task before starting
section 2's native rows in earnest, or have each native conversion keep using `StyleSheet`/`nativeStyles`
+ `useTheme()` tokens directly (no shared native widgets yet) — check with the user which they'd prefer
before the first native conversion.
