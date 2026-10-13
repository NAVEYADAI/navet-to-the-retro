// Feature 19 (product-backlog/19-team-logo.md §19.0 design decision #1): the team colour is the
// dominant HUE of the team logo; saturation/lightness are fixed so every team looks like part of
// the same system and white text on `base` always clears 4.5:1.
//
// This is the BACKEND COPY of frontend/src/design/team-accent.ts::teamAccentFromHue — the PPTX
// export is built server-side, so the formula has to exist here too (§19.0 decision #12). Both
// sides are pinned by the same golden hex values in their specs; change them together.
export interface TeamAccent {
  subtle: string;
  border: string;
  base: string;
  hover: string;
  onBase: string;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// Light-mode palette (the PPTX export is always light).
export function teamAccentFromHue(hue: number): TeamAccent {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  return {
    subtle: hslToHex(h, 75, 95),
    border: hslToHex(h, 55, 85),
    base: hslToHex(h, 62, 28),
    hover: hslToHex(h, 62, 21),
    onBase: '#FFFFFF',
  };
}
