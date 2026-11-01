// STRATOKS storybook environment painter — the single art pipeline for every
// non-character world object (see ART-DIRECTION.md). One palette, one 2:1
// isometric projection, one light from the upper left, one dark-umber outline
// and one soft cast shadow falling to the lower right. Every cell is painted
// once into a 320×320 canvas with the atlas registration (foot anchor 160,280)
// so it obeys the same drawSprite width contract as the Stratok characters.
// Selection uses real simulation data only: biome, node kind/units, stable ids,
// construction stage, integrity, stored items and fire fuel. Nothing is moved.
type Ctx = CanvasRenderingContext2D;
export type Region = "forest" | "desert" | "cold" | "coast";
export const CELL = 320, ANCHOR = [160, 280] as const;

/** The one palette. Names are materials, not objects, so packs never mix. */
export const PALETTE = {
  outline: "#3a2a1e",
  shadow: "rgba(42,52,34,.30)",
  timber: ["#5c3d26", "#8a6040", "#b0845a"],
  plaster: ["#c9b48a", "#e8d8b4", "#f6ecd2"],
  thatch: ["#94733a", "#c9a55a", "#e2c47a"],
  clay: ["#8c4632", "#b55a3c", "#d27c58"],
  slate: ["#46586a", "#5f7487", "#8296a6"],
  stone: ["#6d6c62", "#9c9a8c", "#c3c0ae"],
  adobe: ["#a8754a", "#d6a46c", "#ecc490"],
  turf: ["#476b2e", "#668f3d", "#8fb35a"],
  leaf: ["#355a26", "#5f8f3a", "#9cc25a"],
  needle: ["#1d3d2d", "#2f5d43", "#4f8a5d"],
  olive: ["#5c6a2e", "#8a9a4a", "#b7c46e"],
  frost: ["#4c6b5f", "#7b998c", "#b6cbc2"],
  snow: ["#c9d6dc", "#eef3f4", "#ffffff"],
  berry: ["#7d2430", "#b23a3e", "#e8716a"],
  flame: ["#c8522a", "#ef9a3c", "#ffe39b"],
  window: "#f2b552",
  door: "#4a2f1d",
} as const;
type Ramp = readonly [string, string, string];

const rng = (seed: number) => () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
export function stableHash(id: string | number) {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 1274126177); return (h ^ (h >>> 16)) >>> 0;
}
export const regionOf = (biome: string | undefined): Region =>
  biome === "arid" || biome === "desert" ? "desert" : biome === "cold" ? "cold" : biome === "coast" ? "coast" : "forest"; // fallback: forest palette

// World (x east, y south, z up) → cell pixels. 2:1 isometric, 1 unit = 1 px.
const P = (cx: number, cy: number) => (x: number, y: number, z = 0): [number, number] => [cx + x - y, cy + (x + y) / 2 - z];
function path(g: Ctx, pts: readonly (readonly number[])[]) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath();
}
function fill(g: Ctx, pts: readonly (readonly number[])[], color: string | CanvasGradient, lw = 2.4) {
  path(g, pts); g.fillStyle = color; g.fill();
  if (lw) { g.strokeStyle = PALETTE.outline; g.lineWidth = lw; g.lineJoin = "round"; g.stroke(); }
}
function clipTo(g: Ctx, pts: readonly (readonly number[])[], paint: () => void) { g.save(); path(g, pts); g.clip(); paint(); g.restore(); }
/** The one shadow: a soft ellipse cast to the lower right of the foot point. */
export function castShadow(g: Ctx, x: number, y: number, rx: number, ry = rx * 0.42) {
  g.fillStyle = PALETTE.shadow; g.beginPath(); g.ellipse(x + rx * 0.16, y + ry * 0.12, rx, ry, 0, 0, 7); g.fill();
}

// ---------- vegetation ----------
// Foliage follows the references studied in ART-DIRECTION.md: masses of many
// small overlapping leaves (the same 6–9 px detail frequency as thatch strokes
// and stone courses), one continuous light field from the upper left across
// the whole crown, ambient occlusion underneath, and a soft dark-umber edge
// instead of a hard cut-out outline. Nothing here is a flat circle.
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Colour on a 3-stop ramp: t 0 = shade, 0.5 = body, 1 = light; beyond 1 warms toward sunlit. */
function tone(ramp: Ramp, t: number, alpha = 1) {
  const u = Math.max(0, Math.min(1.25, t)), [a, b] = u < 0.5 ? [ramp[0], ramp[1]] : [ramp[1], ramp[2]];
  const f = u < 0.5 ? u / 0.5 : Math.min(1, (u - 0.5) / 0.5), A = hex(a), B = hex(b);
  let rgb = A.map((v, i) => v + (B[i] - v) * f);
  if (u > 1) rgb = rgb.map((v, i) => v + ([255, 236, 170][i] - v) * (u - 1) * 0.9); // warm sun tips
  return `rgba(${rgb.map(Math.round).join(",")},${alpha})`;
}
const LIGHT = [-0.62, -0.78] as const; // one light, upper left
type Clump = { x: number; y: number; r: number };
/** Irregular leafy outline of one clump: lobed, with leaf-tip scallops. */
function clumpPath(p: Path2D, c: Clump, rand: () => number, grow = 0) {
  const n = 22, wob = Array.from({ length: 5 }, () => rand() * 0.16);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, lobe = 1 + wob[i % 5] - 0.08 + (i % 2 ? 0.04 : -0.02);
    const x = c.x + Math.cos(a) * (c.r * lobe + grow), y = c.y + Math.sin(a) * (c.r * 0.9 * lobe + grow);
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
}
function leaf(g: Ctx, x: number, y: number, len: number, ang: number, color: string) {
  const w = len * 0.42, cs = Math.cos(ang), sn = Math.sin(ang), ex = x + cs * len, ey = y + sn * len;
  g.fillStyle = color; g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(x + cs * len * 0.5 - sn * w, y + sn * len * 0.5 + cs * w, ex, ey);
  g.quadraticCurveTo(x + cs * len * 0.5 + sn * w, y + sn * len * 0.5 - cs * w, x, y); g.fill();
}
/**
 * One foliage mass (broadleaf crown, shrub, acacia canopy). Clumps overlap
 * back to front; each takes its brightness from the single light field of the
 * whole mass, then is textured by leaves lit by the same direction.
 */
function leafMass(g: Ctx, clumps: Clump[], ramp: Ramp, rand: () => number, snow = false, leafLen = 8) {
  clumps.sort((a, b) => a.y - b.y);
  const x0 = Math.min(...clumps.map((c) => c.x - c.r)), x1 = Math.max(...clumps.map((c) => c.x + c.r));
  const y0 = Math.min(...clumps.map((c) => c.y - c.r)), y1 = Math.max(...clumps.map((c) => c.y + c.r));
  const lx = x0 + (x1 - x0) * 0.26, ly = y0 + (y1 - y0) * 0.18, span = Math.hypot(x1 - x0, y1 - y0) * 0.85;
  const field = (x: number, y: number) => 0.92 - Math.hypot(x - lx, y - ly) / span; // ~0.9 lit … 0 shaded
  const paths = clumps.map((c) => { const p = new Path2D(); clumpPath(p, c, rng(Math.round(c.x * 31 + c.y * 17))); return p; });
  const sil = new Path2D(); paths.forEach((p) => sil.addPath(p));
  // Soft integrated edge: a blurred umber rim, not a hard 3 px cut-out stroke.
  g.save(); g.shadowColor = "rgba(58,42,30,.55)"; g.shadowBlur = 5; g.shadowOffsetX = 1.5; g.shadowOffsetY = 2;
  const rim = new Path2D(); clumps.forEach((c) => clumpPath(rim, c, rng(Math.round(c.x * 31 + c.y * 17)), 1.6));
  g.fillStyle = "rgba(46,40,26,.82)"; g.fill(rim); g.restore();
  clumps.forEach((c, i) => {
    const t = field(c.x, c.y);
    // Clump volume: lit cap toward the light, occluded crescent away from it.
    const gr = g.createRadialGradient(c.x + LIGHT[0] * c.r * 0.45, c.y + LIGHT[1] * c.r * 0.45, c.r * 0.08, c.x, c.y, c.r * 1.12);
    gr.addColorStop(0, tone(ramp, t + 0.3)); gr.addColorStop(0.5, tone(ramp, t - 0.02)); gr.addColorStop(1, tone(ramp, t - 0.48));
    g.fillStyle = gr; g.fill(paths[i]);
    g.save(); g.clip(paths[i]);
    // Leaves at the same detail frequency as thatch and stone courses.
    const n = Math.round((c.r * c.r) / (leafLen * leafLen * 0.34));
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * c.r, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.9;
      const lit = (Math.cos(a) * LIGHT[0] + Math.sin(a) * LIGHT[1]) * (d / c.r) * 0.3; // facing the light
      leaf(g, x, y, leafLen * (0.75 + rand() * 0.5), Math.PI * 0.5 + (rand() - 0.5) * 2.2, tone(ramp, field(x, y) + lit + (rand() - 0.5) * 0.3, 0.9));
    }
    g.restore();
    // Leaf tips breaking the silhouette on the lit side keep the edge irregular.
    for (let k = 0; k < Math.round(c.r / 3); k++) {
      const a = Math.PI * (0.85 + rand() * 1.1), x = c.x + Math.cos(a) * c.r * 0.96, y = c.y + Math.sin(a) * c.r * 0.88;
      leaf(g, x, y, leafLen * 0.9, a + (rand() - 0.5) * 0.8, tone(ramp, field(x, y) + 0.35, 0.95));
    }
    if (snow) {
      g.save(); g.clip(paths[i]); const sg = g.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r, c.y);
      sg.addColorStop(0, PALETTE.snow[2]); sg.addColorStop(1, PALETTE.snow[0]); g.fillStyle = sg;
      g.beginPath(); g.moveTo(c.x - c.r * 1.1, c.y - c.r * 0.25);
      for (let k = 0; k <= 6; k++) g.lineTo(c.x - c.r + (k / 6) * c.r * 2, c.y - c.r * 0.38 + (k % 2 ? 5 : -2) + rand() * 4);
      g.lineTo(c.x + c.r, c.y - c.r * 1.2); g.lineTo(c.x - c.r, c.y - c.r * 1.2); g.closePath(); g.fill(); g.restore();
    }
  });
  // Ambient occlusion under the mass, continuous across clumps.
  g.save(); g.clip(sil); const ao = g.createLinearGradient(0, y0 + (y1 - y0) * 0.45, 0, y1);
  ao.addColorStop(0, "rgba(24,38,22,0)"); ao.addColorStop(1, "rgba(24,38,22,.42)"); g.fillStyle = ao; g.fillRect(x0 - 10, y0, x1 - x0 + 20, y1 - y0 + 10); g.restore();
  return clumps;
}
/** Broadleaf / shrub crown: overlapping clumps arranged in a rounded mass. */
function crown(g: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, rand: () => number, n = 9, snow = false, leafLen = 8) {
  const clumps: Clump[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6, d = i === 0 ? 0 : 0.42 + rand() * 0.38;
    return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: Math.min(rx, ry) * (0.4 + rand() * 0.2) };
  });
  return leafMass(g, clumps, ramp, rand, snow, leafLen);
}
function trunk(g: Ctx, x: number, y: number, top: number, w: number, lean = 0, ramp: Ramp = PALETTE.timber) {
  const pts = [[x - w * 1.5, y], [x - w, y - 8], [x + lean - w * 0.55, top], [x + lean + w * 0.55, top], [x + w, y - 8], [x + w * 1.5, y]];
  fill(g, pts, ramp[1]);
  clipTo(g, pts, () => { g.fillStyle = ramp[0]; g.fillRect(x + lean * 0.5, top, w * 2, y - top); g.fillStyle = ramp[2]; g.fillRect(x - w, top, w * 0.45, y - top); });
}
/**
 * Conifer as drooping boughs (the reference firs): each tier is a skirt of
 * irregular hanging needle sprays, lit from the upper left by the same field
 * for the whole tree, shaded underneath by the tier above, soft-edged.
 */
function conifer(g: Ctx, x: number, base: number, w: number, h: number, tiers: number, ramp: Ramp, rand: () => number, snow: boolean) {
  const top = base - h * 0.95, field = (px: number, py: number) => 0.95 - ((px - x) / (w * 2.2)) * 1.1 - ((py - top) / (base - top)) * 0.35;
  const skirts: { p: Path2D; y: number; ww: number; hh: number }[] = [];
  for (let t = 0; t < tiers; t++) {
    const y = base - ((t * h) / tiers) * 0.8, ww = w * (1 - (t / tiers) * 0.72) * (0.92 + rand() * 0.16), hh = (h / tiers) * 1.45;
    const p = new Path2D(), tips = 9 + Math.round(ww / 10);
    p.moveTo(x + (rand() - 0.5) * 4, y - hh);
    p.quadraticCurveTo(x + ww * 0.55, y - hh * 0.55, x + ww, y - 2 + rand() * 4);
    for (let k = 1; k <= tips; k++) { // hanging spray tips along the drooping lower edge
      const u = 1 - (2 * k) / tips, px = x + ww * u, droop = (1 - u * u) * hh * 0.16;
      p.lineTo(px + ww / tips, y + droop + 3 + rand() * 4);
      p.lineTo(px + (rand() - 0.5) * 3, y + droop + 9 + rand() * 9 * (1 - Math.abs(u) * 0.5));
    }
    p.quadraticCurveTo(x - ww * 0.55, y - hh * 0.55, x + (rand() - 0.5) * 4, y - hh); p.closePath();
    skirts.push({ p, y, ww, hh });
  }
  for (const s of skirts) {
    g.save(); g.shadowColor = "rgba(46,40,26,.6)"; g.shadowBlur = 5; g.shadowOffsetX = 1.5; g.shadowOffsetY = 2;
    g.lineWidth = 3.2; g.strokeStyle = "rgba(40,36,24,.78)"; g.lineJoin = "round"; g.stroke(s.p); g.restore();
    const gr = g.createLinearGradient(x - s.ww, s.y - s.hh, x + s.ww, s.y + 10);
    gr.addColorStop(0, tone(ramp, field(x - s.ww, s.y) + 0.15)); gr.addColorStop(0.45, tone(ramp, field(x, s.y))); gr.addColorStop(1, tone(ramp, field(x + s.ww, s.y) - 0.25));
    g.fillStyle = gr; g.fill(s.p);
    g.save(); g.clip(s.p);
    // Needle sprays: short downward strokes fanned from the trunk line.
    for (let k = 0; k < s.ww * 2.6; k++) {
      const u = rand() * 2 - 1, v = Math.pow(rand(), 0.7), px = x + u * s.ww * v, py = s.y - s.hh * (1 - v) * 0.85 + rand() * 8;
      g.strokeStyle = tone(ramp, field(px, py) + (rand() - 0.5) * 0.3 + (v > 0.8 ? 0.12 : 0), 0.9); g.lineWidth = 1.6 + rand();
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + u * 5 + (rand() - 0.5) * 3, py + 6 + rand() * 4); g.stroke();
    }
    // Occlusion at the bough's root and the dark underside of the skirt.
    const ao = g.createLinearGradient(0, s.y - s.hh, 0, s.y + 16); ao.addColorStop(0, "rgba(16,30,22,.42)"); ao.addColorStop(0.3, "rgba(16,30,22,0)"); ao.addColorStop(0.78, "rgba(16,30,22,0)"); ao.addColorStop(1, "rgba(16,30,22,.4)");
    g.fillStyle = ao; g.fillRect(x - s.ww - 4, s.y - s.hh, s.ww * 2 + 8, s.hh + 30);
    if (snow) { g.fillStyle = PALETTE.snow[1]; g.beginPath(); g.moveTo(x - s.ww * 0.9, s.y - 2); g.quadraticCurveTo(x - s.ww * 0.35, s.y - s.hh * 0.55, x + 2, s.y - s.hh * 0.95); g.quadraticCurveTo(x + s.ww * 0.2, s.y - s.hh * 0.5, x + s.ww * 0.45, s.y - s.hh * 0.28); g.quadraticCurveTo(x - s.ww * 0.1, s.y - s.hh * 0.32, x - s.ww * 0.9, s.y - 2); g.fill(); g.fillStyle = PALETTE.snow[0]; g.fillRect(x + s.ww * 0.1, s.y - s.hh * 0.45, s.ww, 3); }
    g.restore();
  }
}
function palm(g: Ctx, rand: () => number, lean: number) {
  const top = [160 + lean, 128];
  g.strokeStyle = PALETTE.outline; g.lineWidth = 15; g.lineCap = "round"; g.beginPath(); g.moveTo(160, 278); g.quadraticCurveTo(160 + lean * 0.2, 200, top[0], top[1]); g.stroke();
  g.strokeStyle = PALETTE.adobe[0]; g.lineWidth = 10; g.stroke();
  g.strokeStyle = PALETTE.adobe[2]; g.lineWidth = 3; for (let k = 0; k < 9; k++) { const t = k / 9, px = 160 + (top[0] - 160) * t * t * 0.9, py = 274 - (274 - top[1]) * t; g.beginPath(); g.moveTo(px - 5, py); g.lineTo(px + 1, py - 3); g.stroke(); }
  for (let n = 0; n < 8; n++) {
    const a = -Math.PI + (n / 7) * Math.PI + (rand() - 0.5) * 0.2, len = 62 + rand() * 18, ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.5 + 34;
    const mx = top[0] + Math.cos(a) * len * 0.5, my = top[1] + Math.sin(a) * len * 0.35 - 14;
    const fr = new Path2D(); fr.moveTo(top[0], top[1]); fr.quadraticCurveTo(mx, my - 10, ex, ey); fr.quadraticCurveTo(mx, my + 8, top[0], top[1] + 5);
    g.save(); g.shadowColor = "rgba(46,40,26,.55)"; g.shadowBlur = 4; g.shadowOffsetX = 1.5; g.shadowOffsetY = 2; g.strokeStyle = "rgba(40,36,24,.75)"; g.lineWidth = 2.6; g.stroke(fr); g.restore();
    const lit = 0.75 - (n / 7) * 0.55, gr = g.createLinearGradient(top[0], top[1], ex, ey); gr.addColorStop(0, tone(PALETTE.olive, lit - 0.25)); gr.addColorStop(0.5, tone(PALETTE.olive, lit + 0.2)); gr.addColorStop(1, tone(PALETTE.olive, lit - 0.05));
    g.fillStyle = gr; g.fill(fr); g.save(); g.clip(fr); g.strokeStyle = tone(PALETTE.olive, lit - 0.35, 0.8); g.lineWidth = 1.3;
    for (let t = 0.15; t < 1; t += 0.08) { const qx = top[0] + (ex - top[0]) * t, qy = top[1] + (ey - top[1]) * t - Math.sin(t * Math.PI) * 14; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + 4, qy + 9); g.stroke(); }
    g.restore();
  }
  g.lineCap = "butt";
}
export type TreeForm = "broadleaf" | "conifer" | "palm" | "acacia" | "bare";
/** Real tree node → form. Mix ratios come from biome; the pick from the stable node id. */
export function treeForm(region: Region, id: string | number): TreeForm {
  const h = stableHash(id) % 10;
  return region === "forest" ? (h < 6 ? "broadleaf" : "conifer") : region === "cold" ? (h < 8 ? "conifer" : "bare") : region === "desert" ? (h < 6 ? "palm" : "acacia") : h < 6 ? "conifer" : "broadleaf";
}
function paintTree(g: Ctx, region: Region, form: TreeForm, k: number) {
  const rand = rng(k * 7919 + form.length * 131 + region.charCodeAt(0)), snow = region === "cold";
  castShadow(g, 160, 278, form === "palm" ? 46 : 52);
  if (form === "broadleaf") {
    const ramp = region === "coast" ? PALETTE.leaf : PALETTE.leaf;
    trunk(g, 160, 278, 196, 11, k % 2 ? -5 : 4);
    crown(g, 158 + (k - 1) * 6, 168 - k * 8, 80 - k * 4, 70 + k * 4, ramp, rand, 10 + k, snow);
  } else if (form === "conifer") {
    trunk(g, 160, 278, 236, 8);
    conifer(g, 160, 246, 48 - k * 4, 196 + k * 14, 4 + (k % 2), region === "coast" ? PALETTE.needle : PALETTE.needle, rand, snow);
  } else if (form === "palm") palm(g, rand, k === 1 ? -22 : 18);
  else if (form === "acacia") {
    trunk(g, 160, 278, 186, 8, 10);
    g.strokeStyle = PALETTE.timber[0]; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.moveTo(168, 196); g.lineTo(122, 160); g.moveTo(170, 192); g.lineTo(212, 158); g.stroke(); g.lineCap = "butt";
    crown(g, 166, 146, 96, 26, PALETTE.olive, rand, 11);
  } else {
    trunk(g, 160, 278, 130, 8, 3);
    g.strokeStyle = PALETTE.timber[0]; g.lineWidth = 4; g.lineCap = "round";
    for (let n = 0; n < 8; n++) { const y = 240 - n * 14, d = 46 - n * 4, side = n % 2 ? 1 : -1; g.beginPath(); g.moveTo(162, y); g.quadraticCurveTo(162 + side * d * 0.6, y - 4, 162 + side * d, y - 20); g.stroke(); g.fillStyle = PALETTE.snow[1]; g.beginPath(); g.ellipse(162 + side * d * 0.7, y - 14, 9, 3.4, 0, 0, 7); g.fill(); }
    g.lineCap = "butt";
  }
}
export type ShrubForm = "berries" | "picked" | "frost" | "cactus" | "reeds" | "scrub";
function paintShrub(g: Ctx, form: ShrubForm, k: number) {
  const rand = rng(k * 313 + form.length * 17);
  castShadow(g, 160, 276, 44);
  if (form === "cactus") {
    // Ribbed, round-topped stems: continuous left-to-right light, rib texture, soft umber edge.
    const arm = (x: number, y0: number, y1: number, w: number) => {
      const pa = new Path2D(); pa.moveTo(x - w, y0); pa.lineTo(x - w, y1 + w); pa.arc(x, y1 + w, w, Math.PI, 0); pa.lineTo(x + w, y0); pa.closePath();
      g.save(); g.shadowColor = "rgba(46,40,26,.55)"; g.shadowBlur = 4; g.shadowOffsetX = 1.5; g.shadowOffsetY = 2; g.strokeStyle = "rgba(40,36,24,.78)"; g.lineWidth = 2.6; g.stroke(pa); g.restore();
      const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, tone(PALETTE.olive, 0.85)); gr.addColorStop(0.45, tone(PALETTE.olive, 0.5)); gr.addColorStop(1, tone(PALETTE.olive, 0.05));
      g.fillStyle = gr; g.fill(pa); g.save(); g.clip(pa);
      for (const u of [-0.55, 0, 0.55]) { g.strokeStyle = tone(PALETTE.olive, 0.3 - u * 0.3, 0.8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + u * w, y0); g.lineTo(x + u * w * 0.8, y1 + 2); g.stroke(); }
      g.fillStyle = tone(PALETTE.plaster, 1, 0.8); for (let yy = y1 + 6; yy < y0; yy += 9) for (const u of [-0.3, 0.3]) g.fillRect(x + u * w, yy + (u > 0 ? 4 : 0), 1.4, 1.4);
      g.restore();
    };
    arm(124, 226, 176, 10); arm(198, 246, 186, 10);
    for (const [x0, y0, x1] of [[124, 220, 150], [198, 240, 170]]) { g.strokeStyle = "rgba(40,36,24,.7)"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0 + 6); g.stroke(); g.strokeStyle = tone(PALETTE.olive, 0.45); g.lineWidth = 8; g.stroke(); g.lineCap = "butt"; }
    arm(160, 278, 150, 18);
    if (k) for (let n = 0; n < 3; n++) { const bx = 152 + n * 9, by = 150 - (n % 2) * 4, gr = g.createRadialGradient(bx - 2, by - 2, 0.5, bx, by, 5); gr.addColorStop(0, PALETTE.berry[2]); gr.addColorStop(1, PALETTE.berry[0]); g.fillStyle = gr; g.beginPath(); g.arc(bx, by, 5, 0, 7); g.fill(); }
    return;
  }
  if (form === "reeds") {
    for (let n = 0; n < 16; n++) { const x = 130 + rand() * 60, h = 70 + rand() * 60, bend = (rand() - 0.5) * 24; g.strokeStyle = PALETTE.outline; g.lineWidth = 5; g.beginPath(); g.moveTo(x, 278); g.quadraticCurveTo(x, 278 - h * 0.6, x + bend, 278 - h); g.stroke(); g.strokeStyle = n % 3 ? PALETTE.olive[1] : PALETTE.olive[2]; g.lineWidth = 2.6; g.stroke(); if (n % 4 === 0) { g.fillStyle = PALETTE.timber[0]; g.beginPath(); g.ellipse(x + bend, 278 - h, 3.5, 9, bend / 60, 0, 7); g.fill(); } }
    return;
  }
  const ramp = form === "frost" ? PALETTE.frost : form === "scrub" ? PALETTE.olive : PALETTE.leaf;
  const blobs = crown(g, 160, 236, form === "scrub" ? 58 : 66, 40, ramp, rand, 8, form === "frost", 7);
  const berry = (x: number, y: number, r: number) => { const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r); gr.addColorStop(0, PALETTE.berry[2]); gr.addColorStop(0.6, PALETTE.berry[1]); gr.addColorStop(1, PALETTE.berry[0]); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  if (form === "berries") for (const b of blobs) for (let n = 0; n < 3; n++) { const x = b.x + (rand() - 0.5) * b.r * 1.2, y = b.y + (rand() - 0.2) * b.r * 0.7; berry(x, y, 3.6); berry(x + 4, y + 2, 3); }
  if (form === "frost") for (const b of blobs.filter((_, i) => i % 3 === 0)) berry(b.x, b.y, 3.2);
}
function paintRocks(g: Ctx, region: Region, flint: boolean, k: number) {
  const rand = rng(k * 97 + (flint ? 5 : 1));
  const ramp: Ramp = region === "desert" ? PALETTE.adobe : region === "coast" ? ["#62655f", "#8d918a", "#babdb3"] : PALETTE.stone;
  castShadow(g, 164, 276, 64);
  const rocks = [[132, 268, 30], [184, 270, 38], [158, 250, 26]].slice(0, 2 + (k % 2));
  for (const [x, y, r] of rocks.sort((a, b) => a[1] - b[1])) {
    const pts = Array.from({ length: 8 }, (_, i) => { const a = Math.PI + (i / 7) * Math.PI; return [x + Math.cos(a) * r * (0.85 + rand() * 0.25), y + Math.sin(a) * r * (0.75 + rand() * 0.2)]; });
    pts.push([x + r, y + 6], [x - r, y + 6]);
    fill(g, pts, ramp[1]);
    clipTo(g, pts, () => { g.fillStyle = ramp[0]; g.beginPath(); g.ellipse(x + r * 0.6, y, r * 0.7, r, 0, 0, 7); g.fill(); g.fillStyle = ramp[2]; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.55, r * 0.5, r * 0.28, -0.3, 0, 7); g.fill(); });
    if (region === "cold") { g.fillStyle = PALETTE.snow[1]; g.beginPath(); g.ellipse(x - r * 0.1, y - r * 0.72, r * 0.62, r * 0.2, -0.1, 0, 7); g.fill(); }
  }
  if (flint) for (let n = 0; n < 4; n++) fill(g, [[118 + n * 22, 286], [124 + n * 22, 274], [132 + n * 22, 284]], n % 2 ? "#4c5664" : "#6f7d8e", 1.6);
}
function paintLog(g: Ctx, region: Region, k: number) {
  castShadow(g, 162, 276, 70, 22);
  const ramp: Ramp = region === "coast" ? ["#8b8372", "#b7ad97", "#ddd3bb"] : PALETTE.timber; // driftwood bleaches
  const p = P(160, 270), a = p(-58, 6, 0), b = p(54, -4, 0);
  const body = [[a[0], a[1] - 22], [b[0], b[1] - 22], [b[0], b[1]], [a[0], a[1]]];
  fill(g, body, ramp[1]);
  clipTo(g, body, () => { g.fillStyle = ramp[2]; g.fillRect(a[0], Math.min(a[1], b[1]) - 26, b[0] - a[0], 8); g.fillStyle = ramp[0]; g.fillRect(a[0], Math.max(a[1], b[1]) - 7, b[0] - a[0], 8); });
  g.fillStyle = PALETTE.plaster[1]; g.strokeStyle = PALETTE.outline; g.lineWidth = 2.4; g.beginPath(); g.ellipse(a[0], a[1] - 11, 9, 12, 0, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = PALETTE.timber[2]; g.lineWidth = 1.4; g.beginPath(); g.ellipse(a[0], a[1] - 11, 4, 6, 0, 0, 7); g.stroke();
  if (k) { g.fillStyle = PALETTE.turf[1]; g.beginPath(); g.ellipse(b[0] - 18, b[1] - 22, 12, 4, 0, 0, 7); g.fill(); }
}

// ---------- structures ----------
type Box = { p: ReturnType<typeof P>; a: number; b: number; h: number };
function walls(g: Ctx, box: Box, mat: "timber" | "plaster" | "stone" | "adobe" | "plank", rand: () => number) {
  const { p, a, b, h } = box;
  const left = [p(-a, b), p(a, b), p(a, b, h), p(-a, b, h)], right = [p(a, b), p(a, -b), p(a, -b, h), p(a, b, h)];
  const ramp: Ramp = mat === "stone" ? PALETTE.stone : mat === "adobe" ? PALETTE.adobe : mat === "plaster" ? PALETTE.plaster : PALETTE.timber;
  for (const [face, tone] of [[left, ramp[2]], [right, ramp[0]]] as const) {
    fill(g, face, mat === "plaster" && face === right ? ramp[0] : tone);
    clipTo(g, face, () => {
      const [q0, q1, , q3] = face, lerp = (u: number, v: number) => [q0[0] + (q1[0] - q0[0]) * u + (q3[0] - q0[0]) * v, q0[1] + (q1[1] - q0[1]) * u + (q3[1] - q0[1]) * v];
      if (mat === "plank" || mat === "timber") { g.strokeStyle = PALETTE.timber[0]; g.lineWidth = 1.6; for (let v = 0.16; v < 1; v += 0.17) { const s = lerp(0, v), e = lerp(1, v); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); } }
      if (mat === "plaster") { // half-timbering: corner posts, sill, mid rail, one brace
        g.strokeStyle = PALETTE.timber[0]; g.lineWidth = 6; g.lineCap = "square";
        for (const [u0, v0, u1, v1] of [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.04, 1, 0.04], [0, 0.55, 1, 0.55], [0, 0.96, 1, 0.96], [0.04, 0.1, 0.4, 0.5]]) { const s = lerp(u0, v0), e = lerp(u1, v1); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); }
        g.lineCap = "butt";
      }
      if (mat === "stone") for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) { const c = lerp((col + (row % 2) * 0.5 + rand() * 0.15) / 5, (row + 0.5) / 5); g.fillStyle = rand() > 0.5 ? ramp[1] : ramp[2]; g.beginPath(); g.ellipse(c[0], c[1], 9, 5.5, 0, 0, 7); g.fill(); g.strokeStyle = PALETTE.outline; g.lineWidth = 1.2; g.stroke(); }
      if (mat === "adobe") for (let n = 0; n < 10; n++) { const c = lerp(rand(), rand()); g.fillStyle = ramp[0] + "55"; g.beginPath(); g.ellipse(c[0], c[1], 5 + rand() * 6, 2 + rand() * 2, 0, 0, 7); g.fill(); }
    });
  }
  return { left, right };
}
function opening(g: Ctx, box: Box, face: "left" | "right", u: number, w: number, z0: number, z1: number, color: string, shutters = false) {
  const { p, a, b } = box, at = (t: number, z: number) => face === "left" ? p(-a + 2 * a * t, b, z) : p(a, b - 2 * b * t, z);
  const pts = [at(u - w, z0), at(u + w, z0), at(u + w, z1), at(u - w, z1)];
  fill(g, pts, color, 2);
  if (shutters) { fill(g, [at(u - w - 0.06, z0), at(u - w, z0), at(u - w, z1), at(u - w - 0.06, z1)], PALETTE.slate[1], 1.6); fill(g, [at(u + w, z0), at(u + w + 0.06, z0), at(u + w + 0.06, z1), at(u + w, z1)], PALETTE.slate[1], 1.6); }
}
type RoofMat = "thatch" | "clay" | "slate" | "turf" | "reed";
function roofRamp(m: RoofMat): Ramp { return m === "thatch" || m === "reed" ? PALETTE.thatch : m === "clay" ? PALETTE.clay : m === "slate" ? PALETTE.slate : PALETTE.turf; }
function roofCourses(g: Ctx, pts: number[][], m: RoofMat, rand: () => number, rows = 6) {
  const ramp = roofRamp(m);
  clipTo(g, pts, () => {
    const [e0, e1, r1, r0] = pts, lerp = (q: number[], r: number[], t: number) => [q[0] + (r[0] - q[0]) * t, q[1] + (r[1] - q[1]) * t];
    for (let i = 0; i < rows; i++) {
      const t = i / rows, s = lerp(e0, r0, t), e = lerp(e1, r1, t);
      g.strokeStyle = ramp[0]; g.lineWidth = m === "turf" ? 1 : 2;
      if (m === "clay" || m === "slate") { const n = 9; for (let k = 0; k < n; k++) { const x = s[0] + (e[0] - s[0]) * (k + 0.5) / n, y = s[1] + (e[1] - s[1]) * (k + 0.5) / n; g.beginPath(); g.arc(x, y - 3, 6, 0.1, Math.PI - 0.1); g.stroke(); } }
      else { g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); }
      if (m === "thatch" || m === "reed") for (let k = 0; k < 18; k++) { const x = s[0] + (e[0] - s[0]) * rand(), y = s[1] + (e[1] - s[1]) * ((x - s[0]) / (e[0] - s[0] || 1)); g.strokeStyle = rand() > 0.5 ? ramp[2] : ramp[0]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 9); g.stroke(); }
      if (m === "turf") for (let k = 0; k < 6; k++) { const x = s[0] + (e[0] - s[0]) * rand(), y = s[1] + (e[1] - s[1]) * ((x - s[0]) / (e[0] - s[0] || 1)); g.strokeStyle = ramp[2]; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y - 6); g.moveTo(x + 2, y); g.lineTo(x + 4, y - 5); g.stroke(); }
    }
  });
}
/** Gable roof, ridge along world x. Front slope and right gable are visible. */
function gable(g: Ctx, box: Box, rise: number, over: number, m: RoofMat, gableMat: Ramp, snow: boolean, rand: () => number, holes = 0) {
  const { p, a, b, h } = box, ramp = roofRamp(m);
  const ridge0 = p(-a - over, 0, h + rise), ridge1 = p(a + over, 0, h + rise);
  const back = [ridge0, ridge1, p(a + over, -b - over, h - over * 0.6), p(-a - over, -b - over, h - over * 0.6)];
  fill(g, back, ramp[0]);
  const tri = [p(a, b, h), p(a, -b, h), p(a, 0, h + rise)];
  fill(g, tri, gableMat[0]);
  clipTo(g, tri, () => { g.strokeStyle = gableMat[1]; g.lineWidth = 1.4; for (let z = h + 8; z < h + rise; z += 9) { const s = p(a, b, z), e = p(a, -b, z); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); } });
  const front = [p(-a - over, b + over, h - over * 0.6), p(a + over, b + over, h - over * 0.6), ridge1, ridge0];
  const grad = g.createLinearGradient(front[0][0], front[0][1], ridge0[0], ridge0[1]); grad.addColorStop(0, ramp[1]); grad.addColorStop(1, ramp[2]);
  fill(g, front, grad); roofCourses(g, front, m, rand);
  // Thick rounded eave (storybook thatch reads as a soft lip).
  g.strokeStyle = PALETTE.outline; g.lineWidth = m === "thatch" || m === "turf" ? 7 : 4; g.lineCap = "round"; g.beginPath(); g.moveTo(front[0][0], front[0][1]); g.lineTo(front[1][0], front[1][1]); g.stroke();
  g.strokeStyle = ramp[0]; g.lineWidth = m === "thatch" || m === "turf" ? 4 : 2; g.stroke(); g.lineCap = "butt";
  if (snow) { const s = [p(-a - over, b * 0.55, h + rise * 0.45), p(a + over, b * 0.55, h + rise * 0.45), ridge1, ridge0]; fill(g, s, PALETTE.snow[1], 0); clipTo(g, s, () => { g.fillStyle = PALETTE.snow[2]; g.fillRect(s[3][0], s[3][1] - 6, 400, 8); }); }
  for (let n = 0; n < holes; n++) { const c = p(-a * 0.5 + n * a * 0.7, b * 0.45, h + rise * 0.45); fill(g, [[c[0] - 12, c[1] - 6], [c[0] + 10, c[1] - 9], [c[0] + 14, c[1] + 6], [c[0] - 6, c[1] + 9]], PALETTE.timber[0], 2); g.strokeStyle = PALETTE.timber[2]; g.lineWidth = 2; g.beginPath(); g.moveTo(c[0] - 10, c[1] + 2); g.lineTo(c[0] + 12, c[1] - 4); g.stroke(); }
  return { ridge0, ridge1 };
}
function chimney(g: Ctx, x: number, y: number, smoke: boolean) {
  fill(g, [[x - 8, y + 6], [x + 8, y + 6], [x + 8, y - 26], [x - 8, y - 26]], PALETTE.stone[1]);
  fill(g, [[x - 8, y - 26], [x - 3, y - 26], [x - 3, y + 6], [x - 8, y + 6]], PALETTE.stone[2], 0);
  if (smoke) { g.fillStyle = "rgba(240,236,224,.55)"; for (let n = 0; n < 3; n++) { g.beginPath(); g.ellipse(x + 4 + n * 6, y - 38 - n * 14, 7 + n * 2, 5 + n * 2, 0, 0, 7); g.fill(); } }
}
function roundWall(g: Ctx, cx: number, cy: number, r: number, h: number, ramp: Ramp, kind: "wattle" | "adobe" | "stone") {
  const rx = r * 1.414, ry = rx / 2;
  const pts: number[][] = []; for (let i = 0; i <= 20; i++) { const t = Math.PI * i / 20; pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); } for (let i = 20; i >= 0; i--) { const t = Math.PI * i / 20; pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry - h]); }
  const grad = g.createLinearGradient(cx - rx, 0, cx + rx, 0); grad.addColorStop(0, ramp[2]); grad.addColorStop(0.5, ramp[1]); grad.addColorStop(1, ramp[0]);
  fill(g, pts, grad);
  clipTo(g, pts, () => { g.strokeStyle = ramp[0]; g.lineWidth = 1.6; if (kind === "wattle") for (let y = cy - h + 6; y < cy + ry; y += 7) { g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0.05, Math.PI - 0.05); g.stroke(); } if (kind === "stone") for (let y = cy - h + 8; y < cy + ry; y += 11) for (let t = 0.1; t < Math.PI; t += 0.32) { g.beginPath(); g.ellipse(cx + Math.cos(t + (y % 2) * 0.1) * rx, y + Math.sin(t) * ry, 7, 4, 0, 0, 7); g.stroke(); } });
  return { rx, ry };
}
function cone(g: Ctx, cx: number, cy: number, rx: number, apex: number, m: RoofMat, snow: boolean, rand: () => number) {
  const ramp = roofRamp(m), ry = rx / 2;
  g.beginPath(); g.moveTo(cx - rx, cy); g.bezierCurveTo(cx - rx * 0.7, cy - apex * 0.5, cx - rx * 0.25, cy - apex * 0.95, cx, cy - apex); g.bezierCurveTo(cx + rx * 0.25, cy - apex * 0.95, cx + rx * 0.7, cy - apex * 0.5, cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.closePath();
  const grad = g.createLinearGradient(cx - rx, 0, cx + rx, 0); grad.addColorStop(0, ramp[2]); grad.addColorStop(0.45, ramp[1]); grad.addColorStop(1, ramp[0]);
  g.fillStyle = grad; g.fill(); g.strokeStyle = PALETTE.outline; g.lineWidth = 2.4; g.stroke();
  g.save(); g.clip();
  for (let row = 1; row < 6; row++) { const y = cy - apex + (apex * row) / 6, w = rx * (row / 6) ** 0.7; g.strokeStyle = ramp[0]; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, y, w, w / 2, 0, 0.05, Math.PI - 0.05); g.stroke(); }
  for (let n = 0; n < 40; n++) { const t = rand() * Math.PI, w = rx * (0.3 + rand() * 0.7), y = cy - apex * (1 - (w / rx) ** 1.4) + Math.sin(t) * w / 2; g.strokeStyle = rand() > 0.5 ? ramp[2] : ramp[0]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + Math.cos(t) * w, y); g.lineTo(cx + Math.cos(t) * w, y + 8); g.stroke(); }
  if (snow) { g.fillStyle = PALETTE.snow[1]; g.beginPath(); g.moveTo(cx, cy - apex - 2); g.bezierCurveTo(cx - rx * 0.4, cy - apex * 0.7, cx - rx * 0.6, cy - apex * 0.35, cx - rx * 0.3, cy - apex * 0.38); g.quadraticCurveTo(cx + rx * 0.1, cy - apex * 0.45, cx + rx * 0.45, cy - apex * 0.4); g.closePath(); g.fill(); }
  g.restore();
  g.strokeStyle = PALETTE.outline; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0.05, Math.PI - 0.05); g.stroke(); g.strokeStyle = ramp[0]; g.lineWidth = 4; g.stroke(); g.lineCap = "butt";
}
function dome(g: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, snow: boolean) {
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); g.ellipse(cx, cy, rx, rx / 2, 0, 0, Math.PI); g.closePath();
  const grad = g.createRadialGradient(cx - rx * 0.4, cy - ry * 0.75, rx * 0.1, cx, cy - ry * 0.3, rx * 1.15); grad.addColorStop(0, ramp[2]); grad.addColorStop(0.6, ramp[1]); grad.addColorStop(1, ramp[0]);
  g.fillStyle = grad; g.fill(); g.strokeStyle = PALETTE.outline; g.lineWidth = 2.4; g.stroke();
  if (snow) { g.save(); g.clip(); g.fillStyle = PALETTE.snow[1]; g.beginPath(); g.ellipse(cx - rx * 0.1, cy - ry * 0.95, rx * 0.85, ry * 0.45, -0.1, 0, 7); g.fill(); g.restore(); }
}
export type Stage = "foundation" | "frame" | "complete" | "damaged" | "ruin";
/** Shelter variant: 0 or 1, from the stable shelter id. Shape AND material differ. */
export const shelterVariant = (id: string | number | undefined) => id === undefined ? 0 : stableHash(id) % 2;
function footing(g: Ctx, p: ReturnType<typeof P>, a: number, b: number, mat: Ramp, rand: () => number) {
  const ring = [p(-a, -b), p(a, -b), p(a, b), p(-a, b)];
  fill(g, ring, PALETTE.timber[0] + "55", 0);
  for (let i = 0; i < 4; i++) { const s = ring[i], e = ring[(i + 1) % 4]; for (let t = 0; t < 1; t += 0.2) { const x = s[0] + (e[0] - s[0]) * t, y = s[1] + (e[1] - s[1]) * t; g.fillStyle = rand() > 0.5 ? mat[1] : mat[2]; g.strokeStyle = PALETTE.outline; g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, y, 9, 5.5, 0, 0, 7); g.fill(); g.stroke(); } }
}
function post(g: Ctx, p: ReturnType<typeof P>, x: number, y: number, z0: number, z1: number) { const s = p(x, y, z0), e = p(x, y, z1); g.strokeStyle = PALETTE.outline; g.lineWidth = 8; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); g.strokeStyle = PALETTE.timber[2]; g.lineWidth = 4.5; g.stroke(); }
function beam(g: Ctx, p: ReturnType<typeof P>, a: number[], b: number[]) { const s = p(a[0], a[1], a[2]), e = p(b[0], b[1], b[2]); g.strokeStyle = PALETTE.outline; g.lineWidth = 7; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); g.strokeStyle = PALETTE.timber[1]; g.lineWidth = 3.5; g.stroke(); }
function paintShelter(g: Ctx, region: Region, variant: number, stage: Stage, lit = false) {
  const rand = rng(variant * 977 + region.length * 131 + stage.length), snow = region === "cold";
  const p = P(160, 248), a = 56, b = 40;
  castShadow(g, 168, 262, 112, 46);
  const footMat = region === "desert" ? PALETTE.adobe : PALETTE.stone;
  if (stage === "foundation") { footing(g, p, a, b, footMat, rand); post(g, p, -a, b, 0, 30); post(g, p, a, b, 0, 22); return; }
  if (stage === "frame") {
    footing(g, p, a, b, footMat, rand);
    for (const [x, y] of [[-a, -b], [a, -b], [a, b], [-a, b]]) post(g, p, x, y, 0, 58);
    beam(g, p, [-a, b, 58], [a, b, 58]); beam(g, p, [a, b, 58], [a, -b, 58]); beam(g, p, [-a, -b, 58], [-a, b, 58]);
    beam(g, p, [-a, 0, 100], [a, 0, 100]); beam(g, p, [-a, b, 58], [-a, 0, 100]); beam(g, p, [a, b, 58], [a, 0, 100]); beam(g, p, [0, b, 58], [0, 0, 100]);
    return;
  }
  if (stage === "ruin") {
    footing(g, p, a, b, footMat, rand);
    const box = { p, a, b, h: 26 }; walls(g, box, region === "desert" ? "adobe" : region === "cold" ? "stone" : "plank", rand);
    for (let n = 0; n < 5; n++) { const c = p(-a + rand() * 2 * a, b + 8 + rand() * 16); fill(g, [[c[0] - 14, c[1]], [c[0] + 12, c[1] - 6], [c[0] + 16, c[1] + 2], [c[0] - 8, c[1] + 6]], n % 2 ? PALETTE.timber[0] : footMat[0], 2); }
    beam(g, p, [-a, b, 26], [a * 0.4, b + 26, 0]);
    return;
  }
  const holes = stage === "damaged" ? 2 : 0;
  if (region === "forest") {
    if (variant === 0) { // half-timbered cottage, thatch gable, chimney
      const box = { p, a, b, h: 58 }; walls(g, box, "plaster", rand);
      opening(g, box, "right", 0.5, 0.17, 0, 40, PALETTE.door); opening(g, box, "left", 0.3, 0.09, 24, 42, PALETTE.window, true); opening(g, box, "left", 0.72, 0.09, 24, 42, PALETTE.window, true);
      const r = gable(g, box, 54, 10, "thatch", PALETTE.timber, false, rand, holes); chimney(g, r.ridge0[0] + 40, r.ridge0[1] + 30, lit && stage === "complete");
    } else { // wattle roundhouse with domed thatch cone
      const cx = 160, cy = 254; roundWall(g, cx, cy, 52, 46, PALETTE.plaster, "wattle");
      fill(g, [[cx + 8, cy + 36], [cx + 34, cy + 30], [cx + 34, cy - 6], [cx + 8, cy]], PALETTE.door, 2);
      cone(g, cx, cy - 44, 92, 104, "thatch", false, rand);
      if (holes) fill(g, [[cx - 30, cy - 92], [cx - 6, cy - 98], [cx - 2, cy - 80], [cx - 26, cy - 74]], PALETTE.timber[0], 2);
    }
  } else if (region === "desert") {
    if (variant === 0) { // adobe block, parapet, reed awning
      const box = { p, a, b, h: 62 }; walls(g, box, "adobe", rand);
      opening(g, box, "right", 0.5, 0.16, 0, 42, PALETTE.door); opening(g, box, "left", 0.5, 0.08, 30, 46, PALETTE.window);
      const top = [p(-a, -b, 62), p(a, -b, 62), p(a, b, 62), p(-a, b, 62)]; fill(g, top, PALETTE.adobe[1]);
      fill(g, [p(-a, b, 62), p(a, b, 62), p(a, b, 70), p(-a, b, 70)], PALETTE.adobe[2], 2);
      const aw = [p(-a + 10, b, 44), p(a - 10, b, 44), p(a - 10, b + 30, 30), p(-a + 10, b + 30, 30)]; fill(g, aw, PALETTE.thatch[1]); roofCourses(g, aw, "reed", rand, 3);
      post(g, p, -a + 12, b + 30, 0, 30); post(g, p, a - 12, b + 30, 0, 30);
      if (holes) fill(g, [p(-10, b + 10, 40), p(14, b + 12, 38), p(10, b + 24, 32)], PALETTE.timber[0], 2);
    } else { // mud-brick dome with vent
      dome(g, 160, 256, 88, 92, PALETTE.adobe, false);
      fill(g, [[150, 274], [182, 268], [182, 228], [150, 232]], PALETTE.door, 2);
      fill(g, [[150, 158], [166, 154], [166, 140], [150, 144]], PALETTE.adobe[0], 2);
      if (holes) fill(g, [[118, 200], [140, 192], [146, 210], [124, 214]], PALETTE.adobe[0], 2);
    }
  } else if (region === "cold") {
    if (variant === 0) { // stone cottage, steep slate roof under snow, chimney
      const box = { p, a, b, h: 52 }; walls(g, box, "stone", rand);
      opening(g, box, "right", 0.5, 0.16, 0, 36, PALETTE.door); opening(g, box, "left", 0.5, 0.1, 20, 38, PALETTE.window, true);
      const r = gable(g, box, 74, 10, "slate", PALETTE.timber, snow, rand, holes); chimney(g, r.ridge1[0] - 30, r.ridge1[1] + 18, lit && stage === "complete");
    } else { // low timber longhouse with turf roof
      const box = { p, a: 70, b: 34, h: 36 }; walls(g, box, "timber", rand);
      opening(g, box, "right", 0.5, 0.2, 0, 30, PALETTE.door); opening(g, box, "left", 0.5, 0.07, 14, 28, PALETTE.window);
      gable(g, box, 46, 12, "turf", PALETTE.timber, snow, rand, holes);
    }
  } else {
    if (variant === 0) { // stilted plank hut, reed roof
      for (const [x, y] of [[-a, b], [a, b], [a, -b], [0, b]]) post(g, p, x, y, 0, 26);
      const q = P(160, 222), box = { p: q, a, b, h: 50 }; fill(g, [q(-a - 6, -b - 6), q(a + 6, -b - 6), q(a + 6, b + 6), q(-a - 6, b + 6)], PALETTE.timber[1]);
      walls(g, box, "plank", rand); opening(g, box, "right", 0.5, 0.16, 0, 36, PALETTE.door); opening(g, box, "left", 0.5, 0.08, 20, 36, PALETTE.window, true);
      gable(g, box, 50, 12, "reed", PALETTE.timber, false, rand, holes);
    } else { // whitewashed cottage with clay-tile roof
      const box = { p, a, b, h: 54 }; walls(g, box, "plaster", rand);
      opening(g, box, "right", 0.5, 0.16, 0, 38, PALETTE.door); opening(g, box, "left", 0.5, 0.1, 22, 40, PALETTE.window, true);
      const r = gable(g, box, 46, 10, "clay", PALETTE.plaster, false, rand, holes); chimney(g, r.ridge0[0] + 30, r.ridge0[1] + 24, lit && stage === "complete");
    }
  }
}
/** Storage zone of a real shelter store: rack for timber, baskets/crates otherwise. */
export type StoreForm = "rack" | "baskets";
export const storeForm = (items: Record<string, number>) => (items.wood ?? 0) >= Math.max(1, ...Object.entries(items).filter(([k]) => k !== "wood").map(([, n]) => n)) ? "rack" : "baskets";
function paintStore(g: Ctx, region: Region, form: StoreForm, fillClass: number, ruined: boolean) {
  const rand = rng(fillClass * 31 + form.length), p = P(160, 268);
  castShadow(g, 164, 272, 70, 28);
  if (form === "rack") {
    for (const [x, y] of [[-40, 18], [40, 18], [40, -18], [-40, -18]]) post(g, p, x, y, 0, ruined ? 20 : 54);
    for (let row = 0; row < fillClass; row++) for (let n = 0; n < 4 - (row % 2); n++) { const c = p(-34 + n * 22 + (row % 2) * 11, 18, 8 + row * 11); g.fillStyle = PALETTE.timber[1]; g.strokeStyle = PALETTE.outline; g.lineWidth = 2; g.beginPath(); g.ellipse(c[0], c[1], 9, 7, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = PALETTE.plaster[1]; g.beginPath(); g.ellipse(c[0] - 1, c[1] - 1, 5, 4, 0, 0, 7); g.fill(); }
    if (!ruined) { const roof = [p(-48, 28, 52), p(48, 28, 52), p(48, -24, 66), p(-48, -24, 66)]; fill(g, roof, region === "cold" ? PALETTE.slate[1] : PALETTE.timber[2]); roofCourses(g, roof, region === "cold" ? "slate" : "reed", rand, 3); if (region === "cold") fill(g, [roof[3], roof[2], p(48, 0, 60), p(-48, 0, 60)], PALETTE.snow[1], 0); }
    return;
  }
  const spots = [[-26, 14], [8, 20], [30, -4], [-6, -14]].slice(0, Math.max(1, fillClass));
  for (const [x, y] of spots.sort((u, v) => u[0] + u[1] - v[0] - v[1])) {
    const c = p(x, y), basket = (x + y) % 2 === 0;
    if (basket) { const pts = [[c[0] - 15, c[1] - 26], [c[0] + 15, c[1] - 26], [c[0] + 11, c[1]], [c[0] - 11, c[1]]]; fill(g, pts, ruined ? PALETTE.thatch[0] : PALETTE.thatch[1]); clipTo(g, pts, () => { g.strokeStyle = PALETTE.thatch[0]; g.lineWidth = 1.4; for (let yy = c[1] - 22; yy < c[1]; yy += 5) { g.beginPath(); g.moveTo(c[0] - 16, yy); g.lineTo(c[0] + 16, yy); g.stroke(); } }); g.fillStyle = PALETTE.berry[1]; if (!ruined) { g.beginPath(); g.ellipse(c[0], c[1] - 26, 13, 4.5, 0, 0, 7); g.fill(); } }
    else { const q = P(c[0], c[1]), box = { p: q, a: 14, b: 12, h: 24 }; walls(g, box, "plank", rand); fill(g, [q(-14, -12, 24), q(14, -12, 24), q(14, 12, 24), q(-14, 12, 24)], PALETTE.timber[2]); }
  }
}
/** Work area: a real fire. Variant from the stable fire id; flame from actual fuel. */
function paintHearth(g: Ctx, region: Region, variant: number) {
  const rand = rng(variant * 53 + region.length);
  castShadow(g, 160, 272, 50, 22);
  if (variant === 0) { // ring of stones
    for (let n = 0; n < 9; n++) { const t = (n / 9) * Math.PI * 2, x = 160 + Math.cos(t) * 34, y = 268 + Math.sin(t) * 17; g.fillStyle = n % 2 ? PALETTE.stone[1] : PALETTE.stone[2]; g.strokeStyle = PALETTE.outline; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 9, 6, 0, 0, 7); g.fill(); g.stroke(); }
  } else { // clay-lined pit with two log seats (seats are terrain dressing, not inventory)
    g.fillStyle = region === "desert" ? PALETTE.adobe[0] : PALETTE.clay[0]; g.strokeStyle = PALETTE.outline; g.lineWidth = 2.4; g.beginPath(); g.ellipse(160, 268, 32, 15, 0, 0, 7); g.fill(); g.stroke();
    for (const [x, y] of [[100, 282], [214, 256]]) { fill(g, [[x - 20, y - 6], [x + 20, y - 12], [x + 20, y], [x - 20, y + 6]], PALETTE.timber[1], 2); g.fillStyle = PALETTE.plaster[1]; g.beginPath(); g.ellipse(x - 20, y, 4, 6, 0, 0, 7); g.fill(); }
  }
  g.fillStyle = "#2b2420"; g.beginPath(); g.ellipse(160, 268, 22, 9, 0, 0, 7); g.fill();
  void rand;
}
function paintGarden(g: Ctx, variant: number, dry: boolean) {
  const p = P(160, 262), soil = dry ? ["#7a6248", "#9a7d5c"] : ["#5a4130", "#7a5a40"];
  const bed = [p(-34, -34), p(34, -34), p(34, 34), p(-34, 34)];
  if (variant === 0) { fill(g, bed, soil[1]); clipTo(g, bed, () => { g.strokeStyle = soil[0]; g.lineWidth = 4; for (let y = -26; y <= 26; y += 13) { const s = p(-34, y), e = p(34, y); g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.stroke(); } });
    // low wattle edging on the visible front edges
    for (const [s, e] of [[p(-34, 34), p(34, 34)], [p(34, 34), p(34, -34)]]) { g.strokeStyle = PALETTE.outline; g.lineWidth = 6; g.beginPath(); g.moveTo(s[0], s[1] - 4); g.lineTo(e[0], e[1] - 4); g.stroke(); g.strokeStyle = PALETTE.thatch[0]; g.lineWidth = 3; g.stroke(); }
  } else { fill(g, bed, soil[1]); g.fillStyle = soil[0]; g.beginPath(); g.ellipse(160, 262, 38, 14, 0, 0, 7); g.fill(); for (let i = 0; i < 4; i++) { const s = bed[i], e = bed[(i + 1) % 4]; for (let t = 0; t < 1; t += 0.25) { g.fillStyle = PALETTE.stone[2]; g.strokeStyle = PALETTE.outline; g.lineWidth = 1.4; g.beginPath(); g.ellipse(s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t, 6, 4, 0, 0, 7); g.fill(); g.stroke(); } } }
}

// ---------- cache + public draw API ----------
const cache = new Map<string, HTMLCanvasElement>();
export const paintedKeys = () => [...cache.keys()];
function cell(key: string, paint: (g: Ctx) => void) {
  let c = cache.get(key);
  if (!c) { c = document.createElement("canvas"); c.width = c.height = CELL; paint(c.getContext("2d")!); cache.set(key, c); }
  return c;
}
/** Paint a cell by its stable key. Keys are the source-to-render mapping. */
export function cellFor(key: string) {
  const [family, region, a, b, c2] = key.split(":") as [string, Region, string, string, string];
  return cell(key, (g) => {
    if (family === "tree") paintTree(g, region, a as TreeForm, Number(b));
    else if (family === "shrub") paintShrub(g, a as ShrubForm, Number(b));
    else if (family === "rock") paintRocks(g, region, a === "flint", Number(b));
    else if (family === "log") paintLog(g, region, Number(a));
    else if (family === "shelter") paintShelter(g, region, Number(a), b as Stage, c2 === "lit");
    else if (family === "store") paintStore(g, region, a as StoreForm, Number(b), c2 === "ruined");
    else if (family === "hearth") paintHearth(g, region, Number(a));
    else if (family === "garden") paintGarden(g, Number(a), b === "dry");
  });
}
/**
 * Resident edge treatment matched to the foliage: the same soft, blurred
 * dark-umber rim falling to the lower right. Baked once per sprite rect into
 * a copy of the character sheet (clipped to each rect, so neighbours never
 * bleed). The species art itself is untouched.
 */
export function softEdgeSheet(img: CanvasImageSource & { width: number; height: number }, rects: readonly (readonly number[])[]) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d")!;
  for (const [x, y, w, h] of rects) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.shadowColor = "rgba(58,42,30,.5)"; g.shadowBlur = 6; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    g.drawImage(img, x, y, w, h, x, y, w, h); g.restore();
  }
  return c;
}
export function drawCell(ctx: Ctx, key: string, x: number, y: number, width: number, alpha = 1) {
  const c = cellFor(key), ratio = width / CELL;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(c, x - ANCHOR[0] * ratio, y - ANCHOR[1] * ratio, CELL * ratio, CELL * ratio);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
/** Real resource node → cell key, or null when the node has nothing to show. */
export function nodeKey(region: Region, kind: string, id: string | number, units: number): { key: string; width: number } | null {
  const k = stableHash(id) % 3;
  if (kind === "tree") return units > 0 ? { key: `tree:${region}:${treeForm(region, id)}:${k}`, width: 4.4 * (0.9 + (stableHash(String(id) + "s") % 20) / 100) } : null;
  if (kind === "bush") return { key: `shrub:${region}:${region === "cold" ? "frost" : region === "desert" ? "cactus" : region === "coast" ? "reeds" : units > 0 ? "berries" : "picked"}:${k % 2}`, width: 2.7 };
  if (kind === "cactus") return units > 0 ? { key: `shrub:${region}:cactus:${k % 2}`, width: 2.5 } : null;
  if (kind === "scrub" || kind === "lichen") return units > 0 ? { key: `shrub:${region}:${region === "cold" ? "frost" : "scrub"}:${k % 2}`, width: 1.8 } : null;
  if (kind === "stone" || kind === "flint") return units > 0 ? { key: `rock:${region}:${kind}:${k % 2}`, width: 2.6 } : null;
  if (kind === "deadfall" || kind === "driftwood") return units > 0 ? { key: `log:${region}:${k % 2}`, width: 2.3 } : null;
  return null;
}
/** Variants with a chimney: forest cottage, cold stone cottage, coast whitewashed cottage. */
export const hasChimney = (region: Region, variant: number) => (variant === 0 && (region === "forest" || region === "cold")) || (variant === 1 && region === "coast");
/**
 * `lit` must come from an authoritative burning fire at or beside the shelter
 * (the engine's own warmth radius, Chebyshev ≤ 1). Smoke is painted only for
 * a complete, chimneyed shelter with that fire; a roof is not a hearth.
 */
export function shelterKey(region: Region, id: number | undefined, stage: Stage, lit = false) {
  const v = shelterVariant(id);
  return `shelter:${region}:${v}:${stage}${lit && stage === "complete" && hasChimney(region, v) ? ":lit" : ""}`;
}
/** Whether a real burning fire sits on or beside tile (x, y). */
export function fireBeside(fires: readonly (readonly number[])[], fuel: readonly { id: number; fuel: number }[] | undefined, x: number, y: number) {
  return fires.some(([id, fx, fy]) => Math.max(Math.abs(fx - x), Math.abs(fy - y)) <= 1 && (fuel?.find((q) => q.id === id)?.fuel ?? 1) > 0);
}
export const storeKey = (region: Region, items: Record<string, number>, size: number, ruined?: boolean) => `store:${region}:${storeForm(items)}:${Math.max(1, Math.min(4, size))}:${ruined ? "ruined" : "ok"}`;
export const hearthKey = (region: Region, id: number) => `hearth:${region}:${stableHash(id) % 2}`;
export const gardenKey = (id: number, dry: boolean) => `garden:forest:${stableHash(id) % 2}:${dry ? "dry" : "wet"}`;
/**
 * Every reachable cell key, for the contact sheet. Keys are produced by the
 * same key functions the world renderer calls (nodeKey, shelterKey, storeKey,
 * hearthKey, gardenKey) over their full input domains, so the sheet cannot
 * drift from what the world can draw. Ids sweep enough values to hit every
 * stable-hash class (tree crowns 0–2, shelter/hearth/garden variants 0–1).
 */
export function catalogue(): { group: string; key: string }[] {
  const out = new Map<string, string>(), add = (group: string, key: string | undefined) => { if (key && !out.has(key)) out.set(key, group); };
  const regions: Region[] = ["forest", "desert", "cold", "coast"], ids = Array.from({ length: 240 }, (_, i) => i);
  const stages: Stage[] = ["complete", "foundation", "frame", "damaged", "ruin"];
  for (const r of regions) for (const st of stages) for (const lit of [false, true]) for (const id of ids.slice(0, 32)) add(st === "complete" ? `Shelter ${r}` : `Shelter states ${r}`, shelterKey(r, id, st, lit));
  for (const r of regions) for (const items of [{ wood: 2 }, { berries: 2 }] as Record<string, number>[]) for (const size of [1, 2, 3, 4]) for (const ruined of [false, true]) add(`Storage ${r}`, storeKey(r, items, size, ruined));
  for (const r of regions) for (const id of ids.slice(0, 32)) add("Work: hearth", hearthKey(r, id));
  for (const id of ids.slice(0, 32)) for (const dry of [false, true]) add("Work: garden", gardenKey(id, dry));
  const kinds = ["tree", "bush", "cactus", "scrub", "lichen", "stone", "flint", "deadfall", "driftwood"];
  const family: Record<string, string> = { tree: "Trees", shrub: "Shrubs", rock: "Rocks", log: "Logs" };
  for (const r of regions) for (const kind of kinds) for (const units of [0, 1]) for (const id of ids) {
    const key = nodeKey(r, kind, `n${id}`, units)?.key; if (key) add(`${family[key.split(":")[0]]} ${r}`, key);
  }
  const order = (g: string) => ["Shelter ", "Shelter states", "Storage", "Work", "Trees", "Shrubs", "Rocks", "Logs"].findIndex((p) => g.startsWith(p));
  return [...out].map(([key, group]) => ({ group, key })).sort((x, y) => order(x.group) - order(y.group) || x.group.localeCompare(y.group) || x.key.localeCompare(y.key));
}
/** Paint a cell for review without keeping it in the runtime cache. */
export function renderCell(key: string) {
  const hit = cache.get(key); if (hit) return hit;
  const c = cellFor(key); cache.delete(key); return c;
}

/** Non-interactive ground dressing derived from the real terrain tile and its
 * neighbours. Small, low-contrast, no outline: never confusable with a node. */
export function drawDressing(ctx: Ctx, kind: "shore" | "flowers" | "tuft" | "pebbles" | "snowdrift", x: number, y: number, s: number, seed: number) {
  const r = s * 0.08;
  if (kind === "shore") { ctx.strokeStyle = "rgba(240,248,240,.55)"; ctx.lineWidth = Math.max(0.8, s * 0.04); ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.14, -0.2, 0.2, Math.PI - 0.4); ctx.stroke(); }
  if (kind === "pebbles" || kind === "shore") { ctx.fillStyle = "rgba(196,190,170,.85)"; for (let n = 0; n < 3; n++) { ctx.beginPath(); ctx.ellipse(x + (n - 1) * r * 2.2, y - s * 0.12 + ((seed >> n) & 1) * r, r, r * 0.6, 0, 0, 7); ctx.fill(); } }
  if (kind === "tuft") { ctx.strokeStyle = "rgba(60,92,44,.75)"; ctx.lineWidth = Math.max(0.8, s * 0.03); ctx.beginPath(); for (let n = -2; n <= 2; n++) { ctx.moveTo(x + n * r * 0.6, y); ctx.lineTo(x + n * r * 1.3, y - s * 0.22); } ctx.stroke(); }
  if (kind === "flowers") { const colors = ["#f3e2a0", "#e9a6a0", "#c9d7f0"]; for (let n = 0; n < 3; n++) { ctx.fillStyle = colors[(seed + n) % 3]; ctx.beginPath(); ctx.arc(x + (n - 1) * r * 1.8, y - ((seed >> n) & 1) * r, Math.max(1, r * 0.55), 0, 7); ctx.fill(); } }
  if (kind === "snowdrift") { ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.08, -0.2, 0, 7); ctx.fill(); }
}
