export interface TeamListTheme {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
}

// Shared between team-list-web and team-list-native's team-settings-panel pieces (Feature 3,
// product-backlog/03-team-comment-categories.md §3.2) — one definition, no per-platform duplicate.
export interface TeamCategory {
  id: number;
  teamId: number;
  label: string;
  isDefault: boolean;
  isEnabled: boolean;
  createdById: number | null;
  createdAt: string;
  commentCount: number;
}

export interface TeamSprintOption {
  id: number;
  name: string;
}
