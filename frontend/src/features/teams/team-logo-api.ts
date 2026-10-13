import { Platform } from 'react-native';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

// Feature 19 (product-backlog/19-team-logo.md) — axios calls. URL helpers live in team-logo-urls.ts.

export interface LogoUpload {
  /** uri של ה-PNG המוקטן (file:// בנייטיב, blob:/data: ב-web). */
  uri: string;
  /** צבע הצוות שנבחר (0-359), או null = בלי צבע צוות. */
  accentHue: number | null;
}

async function buildLogoForm({ uri, accentHue }: LogoUpload): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // ב-web FormData מקבל Blob אמיתי; ב-React Native — אובייקט {uri, name, type} שהרשת ממירה לקובץ.
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, 'logo.png');
  } else {
    form.append('file', { uri, name: 'logo.png', type: 'image/png' } as unknown as Blob);
  }
  if (accentHue !== null) form.append('accentHue', String(accentHue));
  return form;
}

export interface TeamLogoState {
  logoUpdatedAt: string | null;
  accentHue: number | null;
}

export async function uploadTeamLogo(teamId: number, token: string, upload: LogoUpload): Promise<TeamLogoState> {
  const form = await buildLogoForm(upload);
  const res = await axios.put<TeamLogoState>(`${getBackendUrl()}/teams/${teamId}/logo`, form, {
    // axios ב-web ממלא את ה-boundary לבד; ב-RN חייבים להצהיר multipart.
    headers: { ...authHeaders(token), 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function removeTeamLogo(teamId: number, token: string): Promise<TeamLogoState> {
  const res = await axios.delete<TeamLogoState>(`${getBackendUrl()}/teams/${teamId}/logo`, { headers: authHeaders(token) });
  return res.data;
}

export async function updateTeamAccent(teamId: number, token: string, accentHue: number | null): Promise<TeamLogoState> {
  const res = await axios.patch<TeamLogoState>(`${getBackendUrl()}/teams/${teamId}/accent`, { accentHue }, { headers: authHeaders(token) });
  return res.data;
}
