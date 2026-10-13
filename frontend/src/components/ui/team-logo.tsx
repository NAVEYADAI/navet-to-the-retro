import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { avatarColors } from '@/design/tokens';
import { useSessionToken } from '@/context/session-token-context';
import { getBackendUrl } from '@/api/config';
import { fetchTeamLogoBlob, inviteLogoUrl } from '@/features/teams/team-logo-urls';
import { Strings } from '@/constants/strings';
import { avatarInitial } from './avatar-shared';
import { TEAM_LOGO_MARKER_PX, TEAM_LOGO_PX, TEAM_LOGO_WATERMARK_OPACITY, type TeamLogoProps } from './team-logo-shared';

export type { TeamLogoProps } from './team-logo-shared';

// `<img>` can't send an Authorization header, so the logo is fetched with axios and shown as an
// object URL. Keyed by team + version: the server's bytes are immutable per `?v=` (see
// team-logo-api.ts), so every screen showing the same logo shares one fetch.
const blobUrlCache = new Map<string, Promise<string>>();

function loadLogoObjectUrl(teamId: number, token: string, version: string): Promise<string> {
  const key = `${teamId}:${version}`;
  let pending = blobUrlCache.get(key);
  if (!pending) {
    pending = fetchTeamLogoBlob(getBackendUrl(), teamId, token, version).then((blob) => URL.createObjectURL(blob));
    // A failed fetch must not poison the cache — the next mount retries.
    pending.catch(() => blobUrlCache.delete(key));
    blobUrlCache.set(key, pending);
  }
  return pending;
}

/**
 * לוגו הצוות (פיצ'ר 19): ריבוע מעוגל עם התמונה, ואם אין לוגו / הטעינה נכשלה — ריבוע עם האות
 * הראשונה של שם הצוות בגוון יציב לפי `teamId` (אותו דפוס כמו `Avatar`). לעולם לא "חור".
 */
export function TeamLogo({ teamId, name, logoUpdatedAt, size = 'md', inviteToken, marker, watermark }: TeamLogoProps) {
  const t = useTheme();
  const token = useSessionToken();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const hasLogo = !!logoUpdatedAt && !failed;

  useEffect(() => {
    setFailed(false);
    if (!logoUpdatedAt) {
      setSrc(null);
      return;
    }
    if (inviteToken) {
      setSrc(inviteLogoUrl(getBackendUrl(), inviteToken, logoUpdatedAt));
      return;
    }
    if (!token) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    loadLogoObjectUrl(teamId, token, logoUpdatedAt).then(
      (url) => { if (!cancelled) setSrc(url); },
      () => { if (!cancelled) setFailed(true); }
    );
    return () => { cancelled = true; };
  }, [teamId, logoUpdatedAt, inviteToken, token]);

  const px = marker ? TEAM_LOGO_MARKER_PX : TEAM_LOGO_PX[size];
  const radius = px <= 28 ? t.radius.badge : px <= 40 ? t.radius.field : t.radius.card;
  const frame = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: px,
    height: px,
    boxSizing: 'border-box',
    borderRadius: `${radius}px`,
    overflow: 'hidden',
  } as const;

  if (watermark) {
    if (!hasLogo || !src) return null;
    return (
      <Box
        component="img"
        src={src}
        alt=""
        aria-hidden="true"
        data-testid="team-logo-watermark"
        sx={{ position: 'absolute', insetInlineEnd: -px * 0.6, top: '50%', transform: 'translateY(-50%)', width: px * 4, height: px * 4, objectFit: 'contain', opacity: TEAM_LOGO_WATERMARK_OPACITY, pointerEvents: 'none' }}
      />
    );
  }

  // סימן אנונימיות: רק הלוגו האמיתי. בלי לוגו אין מה לסמן (המילה "אנונימי" כבר מופיעה בכרטיס).
  if (marker && !hasLogo) return null;

  if (hasLogo) {
    return (
      <Box
        component="span"
        data-testid="team-logo"
        sx={{ ...frame, backgroundColor: t.color.logoSurface, border: `1px solid ${t.color.accent.border}`, padding: `${Math.round(px * 0.12)}px` }}
      >
        {src && (
          <Box
            component="img"
            src={src}
            alt={name ? Strings.teamLogo.logoAlt(name) : ''}
            onError={() => setFailed(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        )}
      </Box>
    );
  }

  const c = avatarColors(t.mode, teamId);
  return (
    <Box
      component="span"
      aria-hidden="true"
      data-testid="team-logo-fallback"
      sx={{
        ...frame,
        backgroundColor: c.bg,
        color: c.fg,
        ...(px >= 56 ? t.type.sectionTitle : t.type.bodyStrong),
        fontFamily: t.type.rowTitle.fontFamily,
      }}
    >
      {avatarInitial(name)}
    </Box>
  );
}
