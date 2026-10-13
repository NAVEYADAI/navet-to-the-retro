export type TeamLogoSize = 'sm' | 'md' | 'lg' | 'xl';

export interface TeamLogoProps {
  teamId: number;
  name: string;
  /** `Team.logoUpdatedAt`. null/undefined = אין לוגו → מוצג ה-fallback (אות ראשונה). */
  logoUpdatedAt?: string | null;
  size?: TeamLogoSize;
  /**
   * לוגו של צוות שהמשתמש עוד לא חבר בו (דף ההזמנה): נטען מ-`/invites/:token/logo` הציבורי,
   * בלי Authorization.
   */
  inviteToken?: string;
  /** סימן אנונימיות קטן בכרטיס הערה (פיצ'ר 19, החלטה #10) — בלי fallback של אות, רק הלוגו. */
  marker?: boolean;
  /**
   * סימן מים: הלוגו עצמו, גדול, שקוף וחתוך — רקע לכותרת הצוות (פיצ'ר 19, עיצוב #5). בלי מסגרת, בלי
   * fallback (אין לוגו = אין סימן מים). ההצבה (position) באחריות הקורא, דרך ה-style.
   */
  watermark?: boolean;
}

/** שקיפות סימן המים — כמו במוקאפ. */
export const TEAM_LOGO_WATERMARK_OPACITY = 0.08;

/** גדלי תצוגה בפיקסלים. ה-fallback והתמונה חולקים את אותו מסגרת, כך שהפריסה לא קופצת. */
export const TEAM_LOGO_PX: Record<TeamLogoSize, number> = { sm: 24, md: 36, lg: 56, xl: 72 };
/** סימן האנונימיות בכרטיס הערה. */
export const TEAM_LOGO_MARKER_PX = 20;
