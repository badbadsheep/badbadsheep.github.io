/**
 * 门面网格 · 运行层
 * ─────────────────────────────────────────────────────────────────────
 * 首页四屏（Blog. / Note. / Story. / Gallery.）各有一张自己的网格画布。
 * 这个文件只做四件事：
 *
 *   1. 铺设 —— 把 lattice.ts 算出来的折线画到 <canvas data-grid> 上
 *   2. 扭曲 —— 指针所在的圈内，白线被向外顶开；离开后弹回
 *   3. 涟漪 —— 按下时从按键点向外荡开一圈，约 720ms 收回
 *   4. 呼吸 —— 无指针 2.2s 后，整张网进入 ≤18px / 7s 的极慢漂移
 *
 * ── 三个不肯让步的点 ──────────────────────────────────────────────────
 *   · 网格在最底层：canvas 的 z-index 是 --z-art，文字与气泡都比它高；
 *     气泡另有一块不透明底（见 facade.css），所以网格不会从卡片内部透出来。
 *   · 只画看得见的那屏：IntersectionObserver 管着，滚出视口立即停帧。
 *   · 省电优先：指针扭曲只补光标那个圆（用离屏静帧打底），
 *     涟漪和呼吸才整屏重绘，且呼吸压到 30fps。
 *
 * ── 降级 ──────────────────────────────────────────────────────────────
 *   prefers-reduced-motion / save-data → 只画一帧静态网格，永不请求下一帧。
 *
 * ── 两版对照 ──────────────────────────────────────────────────────────
 *   A「底纹」     只有线，白 20%
 *   B「工程图纸」 每 4 条线提亮一档 + 格点小十字
 *   用 ?grid=b 切到 B，默认 A。定稿后删掉另一套即可（差异只在 scheme 分支里）。
 *
 * ── 截图用的小开关（不是功能） ────────────────────────────────────────
 *   ?probe=0.62,0.52 把虚拟指针钉在屏幕相对位置，方便无鼠标时截扭曲效果。
 */
import { build, type Lattice, type Line, type Pattern } from './lattice';

type Scheme = 'a' | 'b';

/** 所有可调手感都在这里，改完刷新即可 */
const TUNE = {
  /** 扭曲影响半径 */
  radius: 240,
  /** 圆心的最大外推距离 */
  push: 34,
  /** 涟漪最大扩散半径 */
  rippleRadius: 300,
  /** 涟漪峰值外推：比指针膨胀轻，否则相邻白线会被挤成一团 */
  ripplePush: 28,
  /** 涟漪波前厚度 */
  rippleBand: 130,
  /** 涟漪寿命 */
  rippleMs: 720,
  /** 呼吸位移上限 */
  idleAmp: 18,
  /** 呼吸周期 */
  idlePeriod: 7000,
  /** 多久没有指针活动才开始呼吸 */
  idleDelay: 2200,
  /** 指针跟随的软硬（k 越大追得越快） */
  followK: 0.34,
  followDamp: 0.62,
  /** 扭曲幅度包络的弹簧（damp < 2√k 会有一点回弹） */
  ampK: 0.22,
  ampDamp: 0.52,
  /** 呼吸帧率：极慢的位移用不着 60fps */
  idleFps: 30,
} as const;

/** 重绘区域要比影响半径大一圈：圆内的点会被推到圆外 */
const PAD = TUNE.push + 8;

interface Circle {
  x: number;
  y: number;
  r: number;
}

interface Ripple {
  x: number;
  y: number;
  born: number;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Palette {
  r: number;
  g: number;
  b: number;
  alpha: number;
  alphaMajor: number;
  alphaNode: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (k: number): number => 1 - (1 - k) ** 3;

/** 从 CSS 变量读墨色与三档透明度（主题切换不用写第二套） */
function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const num = (name: string, fallback: number): number => {
    const v = Number.parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const ink = cs
    .getPropertyValue('--grid-ink')
    .split(',')
    .map((n) => Number.parseFloat(n));
  return {
    r: Number.isFinite(ink[0]) ? ink[0] : 255,
    g: Number.isFinite(ink[1]) ? ink[1] : 255,
    b: Number.isFinite(ink[2]) ? ink[2] : 255,
    alpha: num('--grid-alpha', 0.2),
    alphaMajor: num('--grid-alpha-strong', 0.32),
    alphaNode: num('--grid-alpha-node', 0.3),
  };
}

function readScheme(): Scheme {
  try {
    return new URLSearchParams(window.location.search).get('grid') === 'b' ? 'b' : 'a';
  } catch {
    return 'a';
  }
}

/** ?probe=x,y（0–1 的相对位置）；没有就是 null */
function readProbe(): { fx: number; fy: number } | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('probe');
    if (!raw) return null;
    const [fx, fy] = raw.split(',').map((n) => Number.parseFloat(n));
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
    return { fx: clamp01(fx), fy: clamp01(fy) };
  } catch {
    return null;
  }
}

class Grid {
  readonly canvas: HTMLCanvasElement;
  readonly pattern: Pattern;
  visible = false;
  probe: { fx: number; fy: number } | null = null;

  private readonly scheme: Scheme;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bitmap = document.createElement('canvas');
  private lattice: Lattice | null = null;
  private palette: Palette | null = null;
  private readonly seed = Math.floor(Math.random() * 0x7fffffff);

  private dpr = 1;
  private w = 0;
  private h = 0;

  /* 指针：tx/ty 是目标，px/py 是弹簧跟随后真正用的位置 */
  private tx = -9999;
  private ty = -9999;
  private px = -9999;
  private py = -9999;
  private vx = 0;
  private vy = 0;
  private holding = false;
  private everInside = false;

  /* 扭曲幅度包络：0 = 完全平，1 = 满幅 */
  private amp = 0;
  private ampV = 0;

  private ripples: Ripple[] = [];
  /** 每帧预算好的涟漪：半径与强度都算好了，绘制时不再开方 */
  private rip: { x: number; y: number; rad: number; str: number }[] = [];
  private idle = 0;
  private lastMove = 0;
  private lastIdlePaint = 0;
  private needsClean = false;
  private time = 0;
  private started = false;

  /* 每帧预算的位移场参数 */
  private bx = 0;
  private by = 0;
  private ba = 0;
  private da = 0;
  private dPhase = 0;
  private ox = 0;
  private oy = 0;

  /** 静态档（reduced-motion / 省流量）：只画一帧，永不进循环 */
  private readonly still: boolean;

  constructor(canvas: HTMLCanvasElement, pattern: Pattern, scheme: Scheme, still = false) {
    this.canvas = canvas;
    this.pattern = pattern;
    this.scheme = scheme;
    this.still = still;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 不可用');
    this.ctx = ctx;
  }

  /** 画布是否已在视口里（挂载时用来决定要不要立刻建几何） */
  inViewport(): boolean {
    const r = this.canvas.getBoundingClientRect();
    return r.bottom > -200 && r.top < window.innerHeight + 200;
  }

  /**
   * 量尺寸 / 重建几何 / 重画静帧。返回 true 表示确实变了。
   * 尺寸没变就什么都不做 —— 滚动时调用是安全的。
   */
  measure(): boolean {
    if (!this.palette) this.palette = readPalette(this.canvas);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.w && h === this.h && dpr === this.dpr && this.lattice) return false;

    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.lattice = build(this.pattern, w, h, this.seed);
    this.paintStatic();
    // 静态档没有循环来收尾，静帧得当场贴上去
    if (this.still) this.blit();
    else this.needsClean = true;
    return true;
  }

  /* ── 指针 / 涟漪 ──────────────────────────────────────────────────── */

  pointer(x: number, y: number, inside: boolean): void {
    if (inside) {
      this.tx = x;
      this.ty = y;
      if (!this.everInside) {
        // 第一次进来：直接落位，别从上一次的坐标弹过来
        this.px = x;
        this.py = y;
        this.vx = 0;
        this.vy = 0;
        this.everInside = true;
      }
      this.holding = true;
      this.lastMove = this.now();
    } else {
      this.holding = false;
      this.everInside = false;
    }
  }

  press(x: number, y: number): void {
    this.ripples.push({ x, y, born: this.now() });
    if (this.ripples.length > 4) this.ripples.shift();
  }

  /** ?probe= 用：把指针钉死并让扭曲满幅，方便无鼠标截图 */
  pin(x: number, y: number): void {
    this.px = x;
    this.py = y;
    this.tx = x;
    this.ty = y;
    this.vx = 0;
    this.vy = 0;
    this.amp = 1;
    this.ampV = 0;
    this.holding = true;
    this.everInside = true;
    this.lastMove = this.now();
    this.needsClean = true;
  }

  private now(): number {
    return this.time || performance.now();
  }

  /* ── 每帧 ─────────────────────────────────────────────────────────── */

  tick(t: number): void {
    if (!this.lattice && !this.measure()) return;
    const dt = this.started ? Math.min(64, Math.max(1, t - this.time)) : 16.7;
    this.time = t;
    this.started = true;

    if (this.probe) this.pin(this.probe.fx * this.w, this.probe.fy * this.h);
    else this.stepSprings(dt);
    this.stepRipples(t);

    // 指针离开 2.2s 之后才开始呼吸；指针一动就收
    const idleTarget = !this.holding && t - this.lastMove > TUNE.idleDelay ? 1 : 0;
    this.idle += (idleTarget - this.idle) * Math.min(1, dt / 900);

    const idleOn = this.idle > 0.004 && !this.probe;
    const warpOn = this.amp > 0.003 || this.rip.length > 0;

    if (!idleOn && !warpOn) {
      if (this.needsClean) {
        this.blit();
        this.needsClean = false;
      }
      return;
    }

    this.needsClean = true;

    if (idleOn || this.rip.length > 0) {
      // 整屏在动的两种情形：呼吸、涟漪
      if (idleOn && t - this.lastIdlePaint < 1000 / TUNE.idleFps - 4) return;
      this.lastIdlePaint = t;
      this.clearAll();
      this.draw(null, true);
    } else {
      // 只有指针在顶：补光标那个圆就够，其余用静帧
      this.blit();
      this.draw({ x: this.px, y: this.py, r: TUNE.radius + PAD }, true);
    }
  }

  private stepSprings(dt: number): void {
    // 按 16.7ms 归一化；帧长就分批积分，别让弹簧炸掉
    const n = dt / 16.7;
    const steps = Math.min(4, Math.max(1, Math.round(n)));
    const h = n / steps;
    for (let i = 0; i < steps; i++) {
      this.vx += ((this.tx - this.px) * TUNE.followK - this.vx * TUNE.followDamp) * h;
      this.vy += ((this.ty - this.py) * TUNE.followK - this.vy * TUNE.followDamp) * h;
      this.px += this.vx * h;
      this.py += this.vy * h;

      const target = this.holding ? 1 : 0;
      this.ampV += ((target - this.amp) * TUNE.ampK - this.ampV * TUNE.ampDamp) * h;
      this.amp += this.ampV * h;
    }
    // 弹簧允许一点过冲，但位移口径不能超过 push（过冲只体现在回弹的手感上）
    this.amp = Math.min(1.12, Math.max(0, this.amp));
  }

  private stepRipples(t: number): void {
    if (!this.ripples.length) {
      if (this.rip.length) this.rip = [];
      return;
    }
    this.ripples = this.ripples.filter((r) => t - r.born < TUNE.rippleMs);
    this.rip = this.ripples.map((r) => {
      const k = clamp01((t - r.born) / TUNE.rippleMs);
      return {
        x: r.x,
        y: r.y,
        rad: TUNE.rippleRadius * easeOut(k),
        str: TUNE.ripplePush * (1 - k) ** 1.6,
      };
    });
  }

  /* ── 位移场 ───────────────────────────────────────────────────────── */

  /** 把 (x,y) 位移后写进 ox/oy */
  private at(x: number, y: number): void {
    let ox = x;
    let oy = y;

    if (this.ba > 0.002) {
      const dx = x - this.bx;
      const dy = y - this.by;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < TUNE.radius && d > 0.5) {
        // smoothstep：圆边上位移与斜率都归零，看不出接缝
        const u = 1 - d / TUNE.radius;
        const m = TUNE.push * Math.min(1, this.ba) * ((u * u * (3 - 2 * u)) / d);
        ox += dx * m;
        oy += dy * m;
      }
    }

    if (this.da > 0.004) {
      const a = TUNE.idleAmp * this.da * 0.66;
      ox += a * Math.sin(y * 0.0034 + this.dPhase);
      oy += a * Math.cos(x * 0.0028 - this.dPhase * 0.72);
    }

    if (this.rip.length) {
      for (const r of this.rip) {
        const dx = x - r.x;
        const dy = y - r.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const u = (d - r.rad) / TUNE.rippleBand;
        const g = Math.exp(-u * u) * r.str;
        ox += (dx / d) * g;
        oy += (dy / d) * g;
      }
    }

    this.ox = ox;
    this.oy = oy;
  }

  /* ── 绘制 ─────────────────────────────────────────────────────────── */

  private paintStatic(): void {
    const { bitmap, w, h, dpr, palette, lattice } = this;
    if (!palette || !lattice) return;
    bitmap.width = Math.round(w * dpr);
    bitmap.height = Math.round(h * dpr);
    const c = bitmap.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    // 半像素对齐：1px 发丝线压在像素中心才不会糊成两像素
    c.translate(0.5, 0.5);
    this.stroke(c, palette, null, false);
  }

  private clearAll(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private blit(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.bitmap, 0, 0);
  }

  /**
   * 画整张网。clip 非空时只补这个圆（先裁再清再画）：
   * 圆外的点位移为 0，所以补完这一块与静帧严丝合缝。
   */
  private draw(clip: Circle | null, displace: boolean): void {
    const { ctx, palette } = this;
    if (!palette || !this.lattice) return;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0.5, 0.5);

    if (clip) {
      ctx.beginPath();
      ctx.arc(clip.x, clip.y, clip.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.clearRect(clip.x - clip.r - 2, clip.y - clip.r - 2, clip.r * 2 + 4, clip.r * 2 + 4);
    }

    this.stroke(ctx, palette, clip, displace);
    ctx.restore();
  }

  /** 真正的描边：线分成「次线 / 主线 / 格点」三组，各组只描一次 */
  private stroke(
    c: CanvasRenderingContext2D,
    p: Palette,
    clip: Circle | null,
    displace: boolean
  ): void {
    const lattice = this.lattice;
    if (!lattice) return;

    if (displace) {
      // 先把这一帧的位移场参数拍平，at() 里就只剩加减乘
      this.bx = this.px;
      this.by = this.py;
      this.ba = this.amp;
      this.da = this.idle;
      this.dPhase = this.time * ((Math.PI * 2) / TUNE.idlePeriod);
    } else {
      this.ba = 0;
      this.da = 0;
    }

    const box: Box | null = clip
      ? { x0: clip.x - clip.r, x1: clip.x + clip.r, y0: clip.y - clip.r, y1: clip.y + clip.r }
      : null;

    const normal = new Path2D();
    const major = new Path2D();
    const splitMajor = this.scheme === 'b';
    let anyNormal = false;
    let anyMajor = false;

    for (const line of lattice.lines) {
      if (box && !this.near(line, box)) continue;
      if (splitMajor && line.major) {
        this.trace(major, line, displace);
        anyMajor = true;
      } else {
        this.trace(normal, line, displace);
        anyNormal = true;
      }
    }

    c.lineWidth = 1;
    c.lineCap = 'butt';
    c.lineJoin = 'round';

    if (anyNormal) {
      c.strokeStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
      c.stroke(normal);
    }
    if (anyMajor) {
      c.strokeStyle = `rgba(${p.r},${p.g},${p.b},${p.alphaMajor})`;
      c.stroke(major);
    }

    if (this.scheme === 'b' && lattice.nodes.length) {
      const nodes = new Path2D();
      let any = false;
      for (let i = 0; i < lattice.nodes.length; i += 2) {
        const x = lattice.nodes[i];
        const y = lattice.nodes[i + 1];
        if (box && (x < box.x0 - PAD || x > box.x1 + PAD || y < box.y0 - PAD || y > box.y1 + PAD)) {
          continue;
        }
        any = true;
        if (displace) this.at(x, y);
        else {
          this.ox = x;
          this.oy = y;
        }
        // 6px 小十字：两条短线，压在格点上
        nodes.moveTo(this.ox - 3, this.oy);
        nodes.lineTo(this.ox + 3, this.oy);
        nodes.moveTo(this.ox, this.oy - 3);
        nodes.lineTo(this.ox, this.oy + 3);
      }
      if (any) {
        c.strokeStyle = `rgba(${p.r},${p.g},${p.b},${p.alphaNode})`;
        c.stroke(nodes);
      }
    }
  }

  private trace(path: Path2D, line: Line, displace: boolean): void {
    const pts = line.pts;
    if (!displace) {
      path.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
      return;
    }
    this.at(pts[0], pts[1]);
    path.moveTo(this.ox, this.oy);
    for (let i = 2; i < pts.length; i += 2) {
      this.at(pts[i], pts[i + 1]);
      path.lineTo(this.ox, this.oy);
    }
  }

  private near(line: Line, box: Box): boolean {
    return (
      line.maxX >= box.x0 - PAD &&
      line.minX <= box.x1 + PAD &&
      line.maxY >= box.y0 - PAD &&
      line.minY <= box.y1 + PAD
    );
  }
}

/* ── 挂载 ─────────────────────────────────────────────────────────────── */

export function mountScreens(): void {
  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-grid]'));
  if (!canvases.length) return;

  const scheme = readScheme();
  const root = document.documentElement;
  root.dataset.gridScheme = scheme;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const still = reduce || conn?.saveData === true;
  root.dataset.gridMotion = still ? 'still' : 'live';

  const grids: Grid[] = [];
  for (const canvas of canvases) {
    const pattern = (canvas.dataset.pattern as Pattern | undefined) ?? 'square';
    try {
      grids.push(new Grid(canvas, pattern, scheme, still));
    } catch {
      /* 拿不到 2d 上下文：这一屏当没有网格，页面照旧 */
    }
  }
  if (!grids.length) return;

  const probe = readProbe();
  if (probe) for (const g of grids) g.probe = probe;

  // 只给视口里的那屏建几何：另外三屏等滚到再算
  for (const g of grids) if (g.inViewport()) g.measure();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => grids.forEach((g) => g.measure()), 160);
  });

  let raf = 0;
  let running = false;

  const frame = (t: number): void => {
    for (const g of grids) if (g.visible || g.probe) g.tick(t);
    raf = window.requestAnimationFrame(frame);
  };
  const start = (): void => {
    if (still || running) return;
    running = true;
    raf = window.requestAnimationFrame(frame);
  };
  const stop = (): void => {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  };

  /* 观察器两档都要：静态档也要「滚到才建几何」，否则下面三屏永远是空的 */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const g = grids.find((x) => x.canvas === e.target);
          if (!g) continue;
          g.visible = e.isIntersecting;
          // 滚到才量：竖屏切横屏这种尺寸变化不会经过 resize
          if (g.visible) g.measure();
        }
        if (still) return;
        if (grids.some((g) => g.visible || g.probe)) start();
        else stop();
      },
      { rootMargin: '15% 0px' }
    );
    for (const g of grids) io.observe(g.canvas);
  } else {
    for (const g of grids) {
      g.visible = true;
      g.measure();
    }
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  const inside = (x: number, y: number, r: DOMRect): boolean =>
    x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  window.addEventListener(
    'pointermove',
    (e) => {
      for (const g of grids) {
        const r = g.canvas.getBoundingClientRect();
        g.pointer(e.clientX - r.left, e.clientY - r.top, inside(e.clientX, e.clientY, r));
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'pointerdown',
    (e) => {
      for (const g of grids) {
        const r = g.canvas.getBoundingClientRect();
        if (inside(e.clientX, e.clientY, r)) g.press(e.clientX - r.left, e.clientY - r.top);
      }
    },
    { passive: true }
  );

  const release = (): void => {
    for (const g of grids) g.pointer(0, 0, false);
  };
  document.addEventListener('pointerleave', release, true);
  window.addEventListener('pointercancel', release, { passive: true });
  window.addEventListener('blur', release);

  start();
}
