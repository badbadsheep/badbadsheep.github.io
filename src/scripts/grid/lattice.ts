/**
 * 门面网格 · 几何层
 * ─────────────────────────────────────────────────────────────────────
 * 四种格子最后都被翻译成同一份中间表示，绘制层因此只有一条代码路径：
 *
 *   lines —— 一串折线（每 ≤26px 一个点，指针扭曲要逐点位移，点太稀会看出折角）
 *   nodes —— 一串格点（B 版「工程图纸」在这些点上打小十字）
 *
 * 尺寸换算：以「一屏约 400 格」为锚（1440×900 视口）
 *   正方形    边长 56px      → 25×16 ≈ 413 格
 *   三角形    边长 86px      → 约 405 个三角（面积 A/400 反推的边长）
 *   六边形    对边 61px      → 约 402 个六边形
 *   多边形    格心距 57px    → 约 400 个不规则多边形
 * 刻意不做「按屏缩放」：格子永远是这么大的，屏大就多几列，手机就少几列。
 *
 * 三种规则格子的统一实现：网格 = 2 或 3 族等距平行线。
 *   正方形 = 0°/90° 两族，间距 s
 *   三角形 = 0°/±60° 三族，间距 s·√3/2（三线共点处就是三角顶点）
 *   六边形 = 0°/±60° 三族，间距 √3·s，整体错开半个间距（六边形顶点 = 三线共点）
 * 所以「三角形」和「六边形」在代码里只差间距与相位 —— 这是正多面体铺砌的实事，
 * 不是偷懒。多边形那屏没有这种结构，走 Voronoi。
 */

export type Pattern = 'square' | 'triangle' | 'hex' | 'poly';

/** 正方形边长（CSS px） */
export const SQUARE_SIDE = 56;
/** 三角形边长（等边三角形，面积与 56px 方格相当） */
export const TRIANGLE_SIDE = 86;
/** 六边形对边距 */
export const HEX_FLAT = 61;
/** 多边形屏的平均格心距 */
export const POLY_CELL = 57;

/** 折线点距。26px 时扭曲的内圈能看出折角，10px 才平滑；
 *  代价只是顶点数（指针扭曲只补光标那一圈，呼吸走 30fps，扛得住）。 */
const SEG = 10;
/** B 版主线：每 4 条提亮一档 */
const MAJOR_EVERY = 4;
/** 多边形屏随机吞掉多少内部边（让几个小格长成一个大块） */
const POLY_DROP = 0.16;
/** 短于这个长度的边直接画（多边形裁切会切出针尖） */
const POLY_MIN_EDGE = 3;

export interface Line {
  /** 扁平坐标 [x0,y0,x1,y1,…] */
  readonly pts: number[];
  /** B 版用：主线 */
  readonly major: boolean;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Lattice {
  readonly lines: Line[];
  /** 扁平坐标 [x0,y0,x1,y1,…]，已去重 */
  readonly nodes: number[];
}

interface Family {
  /** 法线角（度）。它那一族线 = { p | n·p = offset + k·spacing, k ∈ Z } */
  angle: number;
  spacing: number;
  offset: number;
}

const normals = (angle: number): [number, number] => {
  const r = (angle * Math.PI) / 180;
  return [-Math.sin(r), Math.cos(r)];
};

/** 把一段无限长直线裁到 [−pad, w+pad] × [−pad, h+pad]，返回参数区间 */
function clipSeg(
  px: number,
  py: number,
  ux: number,
  uy: number,
  w: number,
  h: number,
  pad: number
): [number, number] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const eps = 1e-9;

  if (Math.abs(ux) < eps) {
    if (px < -pad || px > w + pad) return null;
  } else {
    const a = (-pad - px) / ux;
    const b = (w + pad - px) / ux;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }

  if (Math.abs(uy) < eps) {
    if (py < -pad || py > h + pad) return null;
  } else {
    const a = (-pad - py) / uy;
    const b = (h + pad - py) / uy;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }

  return t1 > t0 ? [t0, t1] : null;
}

/** 直线段 → 折线（按 SEG 等分，供逐点位移） */
function straight(x0: number, y0: number, x1: number, y1: number, major: boolean): Line {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SEG));
  const pts = new Array<number>((n + 1) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts[i * 2] = x0 + dx * t;
    pts[i * 2 + 1] = y0 + dy * t;
  }
  return {
    pts,
    major,
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}

/** 一族平行线 → 折线 */
function familyLines(w: number, h: number, fam: Family): Line[] {
  const [nx, ny] = normals(fam.angle);
  const ux = -ny;
  const uy = nx;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    const v = nx * x + ny * y;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }

  const out: Line[] = [];
  const k0 = Math.floor((lo - fam.offset) / fam.spacing);
  const k1 = Math.ceil((hi - fam.offset) / fam.spacing);
  for (let k = k0; k <= k1; k++) {
    const c = fam.offset + k * fam.spacing;
    const px = nx * c;
    const py = ny * c;
    const seg = clipSeg(px, py, ux, uy, w, h, SEG);
    if (!seg) continue;
    out.push(
      straight(
        px + ux * seg[0],
        py + uy * seg[0],
        px + ux * seg[1],
        py + uy * seg[1],
        k % MAJOR_EVERY === 0
      )
    );
  }
  return out;
}

/** 两两求族的交点 = 格点（三角/六边铺砌里每个顶点都是三线共点，去重即得） */
function familyNodes(w: number, h: number, fams: Family[]): number[] {
  const sets = fams.map((fam) => {
    const [nx, ny] = normals(fam.angle);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, y] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ] as const) {
      const v = nx * x + ny * y;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const cs: number[] = [];
    const k0 = Math.floor(lo / fam.spacing);
    const k1 = Math.ceil(hi / fam.spacing);
    for (let k = k0; k <= k1; k++) cs.push(fam.offset + k * fam.spacing);
    return { nx, ny, cs };
  });

  const out: number[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      const det = a.nx * b.ny - a.ny * b.nx;
      if (Math.abs(det) < 1e-6) continue;
      for (const ca of a.cs) {
        for (const cb of b.cs) {
          const x = (ca * b.ny - cb * a.ny) / det;
          const y = (a.nx * cb - b.nx * ca) / det;
          if (x < -1 || x > w + 1 || y < -1 || y > h + 1) continue;
          const key = `${Math.round(x * 2)}:${Math.round(y * 2)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(x, y);
        }
      }
    }
  }
  return out;
}

/* ── 多边形屏：抖动点阵 + Voronoi ─────────────────────────────────────── */

interface P {
  x: number;
  y: number;
}

/** 固定种子的 PRNG，resize 时同一个种子重排，形状不会每次都不一样 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 半平面裁剪：保留 n·p ≤ c 的一侧 */
function clipHalf(poly: P[], nx: number, ny: number, c: number): P[] {
  const out: P[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const va = nx * a.x + ny * a.y - c;
    const vb = nx * b.x + ny * b.y - c;
    if (va <= 0) out.push(a);
    if ((va < 0 && vb > 0) || (va > 0 && vb < 0)) {
      const t = va / (va - vb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function buildPoly(w: number, h: number, seed: number): Lattice {
  const rand = mulberry32(seed);
  const cell = POLY_CELL;
  const cols = Math.ceil(w / cell) + 2;
  const rows = Math.ceil(h / cell) + 2;

  // 站点：抖动点阵，外扩一圈 —— 边界上的格子才不会被切成巨块
  const sites: P[] = [];
  for (let gy = -1; gy <= rows; gy++) {
    for (let gx = -1; gx <= cols; gx++) {
      sites.push({
        x: (gx + 0.5) * cell + (rand() - 0.5) * cell * 0.84,
        y: (gy + 0.5) * cell + (rand() - 0.5) * cell * 0.84,
      });
    }
  }

  // 分桶：只跟附近 5×5 桶里的站点做半平面裁剪
  const bucket = new Map<string, number[]>();
  sites.forEach((s, i) => {
    const key = `${Math.floor(s.x / cell)}:${Math.floor(s.y / cell)}`;
    const arr = bucket.get(key);
    if (arr) arr.push(i);
    else bucket.set(key, [i]);
  });

  const half = cell * 1.7;
  const reach = (cell * 2.8) ** 2;
  const edges = new Map<string, { x0: number; y0: number; x1: number; y1: number; shared: number }>();

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    // 屏幕外的站点只当邻居用，自己不产格子
    if (s.x < -cell || s.x > w + cell || s.y < -cell || s.y > h + cell) continue;

    let poly: P[] = [
      { x: s.x - half, y: s.y - half },
      { x: s.x + half, y: s.y - half },
      { x: s.x + half, y: s.y + half },
      { x: s.x - half, y: s.y + half },
    ];

    const bx = Math.floor(s.x / cell);
    const by = Math.floor(s.y / cell);
    for (let oy = -2; oy <= 2 && poly.length >= 3; oy++) {
      for (let ox = -2; ox <= 2 && poly.length >= 3; ox++) {
        const arr = bucket.get(`${bx + ox}:${by + oy}`);
        if (!arr) continue;
        for (const j of arr) {
          if (j === i) continue;
          const t = sites[j];
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          if (dx * dx + dy * dy > reach) continue;
          // 保留离 s 更近的一侧：2(t−s)·p ≤ |t|²−|s|²
          poly = clipHalf(poly, 2 * dx, 2 * dy, t.x * t.x + t.y * t.y - s.x * s.x - s.y * s.y);
        }
      }
    }
    if (poly.length < 3) continue;

    poly = clipHalf(clipHalf(poly, -1, 0, 0), 1, 0, w);
    poly = clipHalf(clipHalf(poly, 0, -1, 0), 0, 1, h);
    if (poly.length < 3) continue;

    for (let k = 0; k < poly.length; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      if (Math.hypot(b.x - a.x, b.y - a.y) < POLY_MIN_EDGE) continue;
      const ka = `${Math.round(a.x * 2)}:${Math.round(a.y * 2)}`;
      const kb = `${Math.round(b.x * 2)}:${Math.round(b.y * 2)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(key);
      if (e) e.shared++;
      else edges.set(key, { x0: a.x, y0: a.y, x1: b.x, y1: b.y, shared: 1 });
    }
  }

  const lines: Line[] = [];
  const nodes: number[] = [];
  const nodeSeen = new Set<string>();
  const pushNode = (x: number, y: number): void => {
    const key = `${Math.round(x * 2)}:${Math.round(y * 2)}`;
    if (nodeSeen.has(key)) return;
    nodeSeen.add(key);
    nodes.push(x, y);
  };

  for (const e of edges.values()) {
    // 「乱接」的来由：随机吞掉一部分内部边，几个小格就并成一个大块
    if (e.shared > 1 && rand() < POLY_DROP) continue;
    lines.push(straight(e.x0, e.y0, e.x1, e.y1, false));
    pushNode(e.x0, e.y0);
    pushNode(e.x1, e.y1);
  }

  return { lines, nodes };
}

/* ── 出口 ─────────────────────────────────────────────────────────────── */

const threeFamilies = (spacing: number, offset: number): Family[] => [
  { angle: 0, spacing, offset },
  { angle: 60, spacing, offset },
  { angle: -60, spacing, offset },
];

export function build(pattern: Pattern, w: number, h: number, seed = 1): Lattice {
  if (pattern === 'poly') return buildPoly(w, h, seed);

  const fams: Family[] =
    pattern === 'square'
      ? [
          { angle: 0, spacing: SQUARE_SIDE, offset: 0 },
          { angle: 90, spacing: SQUARE_SIDE, offset: 0 },
        ]
      : pattern === 'triangle'
        ? threeFamilies((TRIANGLE_SIDE * Math.sqrt(3)) / 2, 0)
        : threeFamilies(HEX_FLAT, HEX_FLAT / 2);

  const lines: Line[] = [];
  for (const fam of fams) lines.push(...familyLines(w, h, fam));
  return { lines, nodes: familyNodes(w, h, fams) };
}
