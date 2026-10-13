/**
 * Feature 19 (product-backlog/19-team-logo.md §19.0 design decision #3): מציאת גווני הצבע
 * הבולטים בלוגו, כדי להציע למנהל "צבע צוות". קלט: RGBA גולמי של הלוגו (אחרי הקטנה ל-256x256).
 * פונקציה טהורה — אותו קוד עובד ב-web ובנייטיב, בלי canvas.
 */

export const MAX_HUE_CANDIDATES = 3;

// פיקסל "בלי גוון" — אפור/שחור/לבן/שקוף — לא תורם לצבע הצוות (§19.0 עיצוב #2).
const MIN_ALPHA = 128;
const MIN_SATURATION = 0.25;
const MIN_LIGHTNESS = 0.1;
const MAX_LIGHTNESS = 0.92;
// מקטע של 10° — מספיק עדין להבדיל בין כחול לטורקיז, מספיק גס כדי לאסוף פיקסלים של אותו צבע.
const BUCKET_SIZE = 10;
const BUCKET_COUNT = 360 / BUCKET_SIZE;
// שני מועמדים חייבים להיות רחוקים לפחות כך זה מזה, אחרת הם "אותו צבע".
const MIN_CANDIDATE_DISTANCE = 40;
// מקטע צריך לפחות כך מכלל המשקל כדי להיחשב צבע בולט ולא רעש (למשל קצה מוחלק).
const MIN_WEIGHT_SHARE = 0.04;

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * מחזיר עד 3 גוונים (0-359) לפי בולטות (משקל = רוויה × "כמה הפיקסל רחוק מלבן/שחור"), הראשון
 * הוא הדומיננטי. מערך ריק = ללוגו אין גוון דומיננטי (שחור/לבן/אפור) → אין צבע צוות.
 */
export function extractHueCandidates(rgba: ArrayLike<number>): number[] {
  const weight = new Array<number>(BUCKET_COUNT).fill(0);
  // סכומי וקטורים (sin/cos) לכל מקטע — ממוצע מעגלי נכון גם סביב 0°/360°.
  const sinSum = new Array<number>(BUCKET_COUNT).fill(0);
  const cosSum = new Array<number>(BUCKET_COUNT).fill(0);
  let total = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < MIN_ALPHA) continue;
    const { h, s, l } = rgbToHsl(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;
    const w = s * (1 - Math.abs(2 * l - 1));
    const bucket = Math.min(BUCKET_COUNT - 1, Math.floor(h / BUCKET_SIZE));
    const rad = (h * Math.PI) / 180;
    weight[bucket] += w;
    sinSum[bucket] += Math.sin(rad) * w;
    cosSum[bucket] += Math.cos(rad) * w;
    total += w;
  }
  if (total === 0) return [];

  const ranked = weight
    .map((w, bucket) => ({ w, bucket }))
    .filter((x) => x.w / total >= MIN_WEIGHT_SHARE)
    .sort((a, b) => b.w - a.w);

  const hues: number[] = [];
  for (const { bucket } of ranked) {
    const hue = (Math.round((Math.atan2(sinSum[bucket], cosSum[bucket]) * 180) / Math.PI) + 360) % 360;
    if (hues.every((existing) => circularDistance(existing, hue) >= MIN_CANDIDATE_DISTANCE)) {
      hues.push(hue);
      if (hues.length === MAX_HUE_CANDIDATES) break;
    }
  }
  return hues;
}
