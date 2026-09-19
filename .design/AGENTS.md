# System Design Language & Localization Guidelines

This document outlines the strict design and localization rules enforced for UI creation and modifications in this workspace to ensure desktop and mobile responsiveness, high visual aesthetics, and central translation management.

## 1. Localization & Strings Management

*   **Central Strings Repository**:
    *   Do NOT hardcode user-facing texts (headers, placeholders, buttons, labels) directly in component JSX code.
    *   Always import and reference localizable texts from the centralized [strings.ts](file:///Users/nave/Documents/GitHub/navet-to-the-retro/frontend/src/constants/strings.ts) file.
    *   Ensure any new text strings added during updates are appended to `Strings` object under the appropriate namespace.
*   **Synchronized Testing**:
    *   Unit and E2E tests must import [strings.ts](file:///Users/nave/Documents/GitHub/navet-to-the-retro/frontend/src/constants/strings.ts) and use the exact same constants for text searches, placeholder queries, and assertions. This prevents tests from breaking during translation updates.

## 2. Visual & Style Identity

*   **Colors**:
    *   Curated pastel palettes for light/dark mode integrations.
    *   **Keep (שימור)**: Soft light green backgrounds (`#e8f5e9` light, `#1b5e20` dark) with a matching left-border indicator (`#2e7d32`).
    *   **Improve (שיפור)**: Soft light red/pink backgrounds (`#ffebee` light, `#b71c1c` dark) with a matching left-border indicator (`#c62828`).
*   **Unified Color Schemes (Theme.ts)**:
    *   **Light Theme**:
        *   `background`: `#ffffff` (Main content canvas)
        *   `backgroundElement`: `#F0F0F3` (Default cards and panel backgrounds)
        *   `backgroundSelected`: `#E0E1E6` (Focused inputs, badges, select states)
        *   `text`: `#000000` (Primary font color)
        *   `textSecondary`: `#60646C` (Label fonts, placeholders)
    *   **Dark Theme**:
        *   `background`: `#000000` (Main content canvas)
        *   `backgroundElement`: `#212225` (Default cards and panel backgrounds)
        *   `backgroundSelected`: `#2E3135` (Focused inputs, badges, select states)
        *   `text`: `#ffffff` (Primary font color)
        *   `textSecondary`: `#B0B4BA` (Label fonts, placeholders)
*   **Card Containers**:
    *   Cards must have rounded borders (`border-radius: 8` or `10`) and a thin border width (`1`).
    *   Subtle elevations (`shadowOpacity: 0.05`, `shadowRadius: 3`).
*   **Interactive Inputs & Fields**:
    *   MUI components used on `web` must align with the theme colors using the `sx` prop.
    *   Form elements must specify helper tooltips or clear validation banners.

## 3. Multi-Section Panels (Settings / Management)

Lessons from a real redesign (`team-settings-panel.tsx`, 2026-09-18) after the first pass was
functionally correct but visually flat — identical bordered boxes stacked with no hierarchy:

*   **Editable content defaults to a display state, not an always-open form.** A field that rarely
    changes (a name, an address) renders as plain text plus a small "edit" affordance; only clicking
    it reveals the form. An always-open form for rarely-edited data is both visual noise and an
    accidental-edit risk.
*   **Repeated items (list rows) get one container with thin row dividers, not one bordered/shadowed
    box per item.** Four or more identical boxes in a row read as a monotonous wall with no scan
    rhythm — a single list container with `border-bottom` between rows reads as an intentional list.
*   **Inactive/disabled items dim the whole row (~55% opacity), not just their toggle control** — so
    "what's active" scans at a glance.
*   **Section labels inside a multi-section panel are a distinct, quieter type style** (small,
    muted, letter-spaced/uppercase eyebrow) — not the same weight as body text. Pair with generous
    spacing *between* sections and tight spacing *within* one; that contrast IS the hierarchy, not
    just font-size.
*   **A filter control looks different from an action button** — e.g. a fully-rounded pill with a
    lighter border, distinct from the app's standard button shape — so "this changes what's shown"
    reads differently from "this does something."

These are UX patterns, not new colors/tokens — always still pull actual color/spacing/type values
from `frontend/src/design/tokens.ts` and `frontend/UI-GUIDELINES.md` (the real source of truth for
the shipped app); this file's own palette above can drift from it over time.

## 4. Responsiveness & Overflow Protection

*   **Breakpoint Control**:
    *   Do NOT use platform checks (`Platform.OS === 'web'`) for column layouts or sizes.
    *   Always use `useWindowDimensions()` from `react-native` to retrieve width dynamically.
    *   Lay out items horizontally as `row` on desktop screens (`width >= 768`) and stack as `column` on tablet/mobile views.
*   **Safe Layout Padding**:
    *   Ensure all main page components wrap content scroll views in appropriate top offset spacing (e.g. `paddingTop: 80` to `100`) to prevent overlap under the absolute-positioned top navigation bar.
*   **Text Constraint Wrapping**:
    *   Add `flex: 1` and `flexShrink: 1` on text containers inside row layouts to prevent words or badges from overflowing bounds.
