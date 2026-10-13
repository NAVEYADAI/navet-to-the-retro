import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import UPNG from 'upng-js';
import { extractHueCandidates } from '@/lib/team-logo-colors';

// Feature 19 (product-backlog/19-team-logo.md §19.0 technical default #5): the client crops the
// chosen image to a centred square, shrinks it to 256x256 and re-encodes it as PNG BEFORE uploading
// — the server only validates, it never resizes (no `sharp` in the Fly image). The same decoded
// pixels feed the team-colour suggestion, so web and native share one code path.
export const LOGO_SIZE_PX = 256;

export interface PreparedLogo {
  /** uri של ה-PNG המוקטן — מה שמועלה, וגם התצוגה המקדימה. */
  uri: string;
  /** גווני צבע בולטים בלוגו, הדומיננטי ראשון. ריק = אין גוון (שחור/לבן/אפור). */
  hues: number[];
}

/** פעולת החיתוך לריבוע ממורכז — פונקציה טהורה כדי שאפשר לבדוק אותה. */
export function centredSquareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side };
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** מפענח PNG ומחזיר את גווני הצבע הבולטים. נכשל בשקט (קובץ שאינו PNG) → אין גוונים. */
export function huesFromPngBytes(bytes: Uint8Array): number[] {
  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const image = UPNG.decode(buffer);
    const rgba = new Uint8Array(UPNG.toRGBA8(image)[0]);
    return extractHueCandidates(rgba);
  } catch {
    return [];
  }
}

/** פותח את בורר התמונות. null = המשתמש ביטל. */
export async function pickLogoAsset(): Promise<{ uri: string; width: number; height: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // בנייטיב העורך המובנה חותך לריבוע; ב-web ההגדרה מתעלמת ואנחנו חותכים לבד לפי המרכז.
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

export async function prepareLogo(asset: { uri: string; width: number; height: number }): Promise<PreparedLogo> {
  let { width, height } = asset;
  if (!width || !height) {
    // חלק מהפלטפורמות לא מחזירות מידות מהבורר — קוראים אותן בפעולה ריקה.
    const probe = await manipulateAsync(asset.uri, [], { format: SaveFormat.PNG });
    width = probe.width;
    height = probe.height;
  }
  const result = await manipulateAsync(
    asset.uri,
    [{ crop: centredSquareCrop(width, height) }, { resize: { width: LOGO_SIZE_PX, height: LOGO_SIZE_PX } }],
    { format: SaveFormat.PNG, base64: true }
  );
  return { uri: result.uri, hues: result.base64 ? huesFromPngBytes(base64ToBytes(result.base64)) : [] };
}

/** גווני הצבע של לוגו שכבר שמור (בלי בחירה מחדש של קובץ) — לפעולת "שינוי צבע". */
export async function loadStoredLogoHues(url: string, headers: Record<string, string>): Promise<number[]> {
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  return huesFromPngBytes(new Uint8Array(await res.arrayBuffer()));
}
