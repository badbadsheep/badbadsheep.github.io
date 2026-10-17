/**
 * 首屏演出原型 —— 只给 /proto/hero 用，验证满意后再搬进 Hero.astro。
 *
 * 时间轴：
 *   t=0        白底，黑色圆角方块居中静止（左下角铰链锁住，重力为 0）
 *   t=300ms    彩色线条原地碎裂成若干彩色圆点（刚体）；开启重力 → 方块顺时针转
 *   t≈300ms~   液滴被旋转方块挤出/甩出，撞墙/地板 → 移出引擎 → 裂成 2 个自由粒子
 *              自由粒子走直线、撞墙再分裂（深度 ≤3）、在独立 trail canvas 上留永久拖尾
 *   t=5000ms   开始逐笔写 badbadsheep（Instrument Serif + 笔刷遮罩）
 *              badbadshee 用 3.5s，最后一个 p 用 1s（枯笔飞白）
 *   t=写完     瞬间反相：背景纯黑、文字纯白；粒子冻结 0.3s → 回复重力自由落体出屏
 *   t=终态     黑底白字 badbadsheep + 缓缓淡入 Welcome to my world ^^
 *
 * 播放策略：sessionStorage['bbs:hero-played']，每会话一次；?play=1 强制重播。
 * 降级：prefers-reduced-motion → 直接给终态。
 */
import Matter from 'matter-js';

const COLORS = ['#e63946', '#f08c1e', '#f7d417', '#1e9e59', '#2fb9cf', '#4c63d2', '#432c7a', '#ec6fae'];

const MAX_SPLIT_DEPTH = 3;
const MAX_PARTICLES = 360;
const DROPLET_COUNT = 30;
const SQUARE = 230; // 黑方块边长（CSS px）

const T = {
  burst: 300,
  writeStart: 5000,
  writeMain: 3500, // badbadshee（不含最后一个 p）
  writeP: 1000, // 最后一个 p
  freeze: 300,
  fallOut: 900,
};

const WORD = 'badbadsheep';
const TAGLINE = 'Welcome to my world ^^';

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  depth: number;
  dead: boolean;
}

export function mount(root: HTMLElement, opts: { forcePlay?: boolean } = {}): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const played = sessionStorage.getItem('bbs:hero-played') === '1';
  const force = opts.forcePlay || /[?&]play=1/.test(window.location.search);

  if (reduce || (played && !force)) {
    showFinal();
    return;
  }
  sessionStorage.setItem('bbs:hero-played', '1');
  document.body.dataset.phase = 'playing';

  // ── 画布层 ────────────────────────────────────────────────────────────
  const trail = root.querySelector<HTMLCanvasElement>('[data-trail]')!;
  const phys = root.querySelector<HTMLCanvasElement>('[data-phys]')!;
  const text = root.querySelector<HTMLCanvasElement>('[data-text]')!;
  const tagline = root.querySelector<HTMLElement>('[data-tagline]')!;
  const below = root.querySelector<HTMLElement>('[data-below]')!;

  let W = 0;
  let H = 0;
  let dpr = 1;

  const tctx = trail.getContext('2d')!;
  const pctx = phys.getContext('2d')!;
  const xctx = text.getContext('2d')!;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [trail, phys, text]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    }
    for (const ctx of [tctx, pctx, xctx]) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();

  // ── 物理世界 ──────────────────────────────────────────────────────────
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  engine.gravity.y = 0;

  const cx = W / 2;
  const cy = H / 2;

  // 四壁：内壁严格贴合屏幕边界（方块厚度放在屏幕外侧）
  const T_wall = 200;
  const walls = [
    Matter.Bodies.rectangle(W / 2, -T_wall / 2, W + T_wall * 2, T_wall, { isStatic: true }), // 顶
    Matter.Bodies.rectangle(W / 2, H + T_wall / 2, W + T_wall * 2, T_wall, { isStatic: true }), // 底
    Matter.Bodies.rectangle(-T_wall / 2, H / 2, T_wall, H + T_wall * 2, { isStatic: true }), // 左
    Matter.Bodies.rectangle(W + T_wall / 2, H / 2, T_wall, H + T_wall * 2, { isStatic: true }), // 右
  ];

  const square = Matter.Bodies.rectangle(cx, cy, SQUARE, SQUARE, {
    chamfer: { radius: SQUARE * 0.14 },
    density: 0.02,
    frictionAir: 0.02,
    restitution: 0.08,
    render: { visible: false },
  });

  // 左下角铰链：pointB 是方块局部坐标里的左下角
  const pivot = { x: cx - SQUARE / 2, y: cy + SQUARE / 2 };
  const hinge = Matter.Constraint.create({
    pointA: pivot,
    bodyB: square,
    pointB: { x: -SQUARE / 2, y: SQUARE / 2 },
    length: 0,
    stiffness: 1,
    damping: 0,
  });

  Matter.Composite.add(engine.world, [...walls, square, hinge]);

  // ── 彩色线条（碎裂前画在方块上，碎裂后变成圆点） ─────────────────────
  interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }

  const circleC = { x: cx + SQUARE * 0.16, y: cy - SQUARE * 0.16 };
  const circleR = SQUARE * 0.33;

  function makeLines(): Line[] {
    const lines: Line[] = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a1 = Math.random() * Math.PI * 2;
      const a2 = a1 + 0.6 + Math.random() * 1.6;
      const r1 = circleR * (0.2 + Math.random() * 0.75);
      const r2 = circleR * (0.2 + Math.random() * 0.75);
      lines.push({
        x1: circleC.x + Math.cos(a1) * r1,
        y1: circleC.y + Math.sin(a1) * r1,
        x2: circleC.x + Math.cos(a2) * r2,
        y2: circleC.y + Math.sin(a2) * r2,
        color: COLORS[i % COLORS.length],
      });
    }
    return lines;
  }

  const lines = makeLines();
  let burstDone = false;

  // 液滴刚体
  const droplets: Matter.Body[] = [];
  const toRemove = new Set<Matter.Body>();

  function spawnDroplets() {
    burstDone = true;
    for (let i = 0; i < DROPLET_COUNT; i++) {
      const line = lines[i % lines.length];
      const t = Math.random();
      const x = line.x1 + (line.x2 - line.x1) * t + (Math.random() - 0.5) * 6;
      const y = line.y1 + (line.y2 - line.y1) * t + (Math.random() - 0.5) * 6;
      const r = 5 + Math.random() * 6; // 做大一点、少一点（低端也扛得住）
      const d = Matter.Bodies.circle(x, y, r, {
        density: 0.0012,
        restitution: 0.55,
        friction: 0.04,
        frictionAir: 0.005,
        label: 'droplet',
        render: { visible: false },
      });
      (d as Matter.Body & { color: string }).color = line.color;
      (d as Matter.Body & { radius: number }).radius = r;
      droplets.push(d);
    }
    Matter.Composite.add(engine.world, droplets);
  }

  // ── 自由粒子（拖尾） ──────────────────────────────────────────────────
  const particles: TrailParticle[] = [];

  function burstAt(x: number, y: number, color: string, depth: number) {
    if (particles.length >= MAX_PARTICLES) return;
    const speed = 2.2 + Math.random() * 2.6;
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color,
        depth,
        dead: false,
      });
    }
  }

  // 液滴撞墙 → 移出引擎 → 裂成粒子
  Matter.Events.on(engine, 'collisionStart', (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const drop = a.label === 'droplet' ? a : b.label === 'droplet' ? b : null;
      const wall = a.isStatic && a.label !== 'droplet' ? a : b.isStatic && b.label !== 'droplet' ? b : null;
      if (drop && wall && !toRemove.has(drop)) {
        toRemove.add(drop);
        const color = (drop as Matter.Body & { color: string }).color;
        burstAt(drop.position.x, drop.position.y, color, 0);
      }
    }
  });

  // ── 绘制 ──────────────────────────────────────────────────────────────
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSquare() {
    pctx.save();
    pctx.translate(square.position.x, square.position.y);
    pctx.rotate(square.angle);
    roundRect(pctx, -SQUARE / 2, -SQUARE / 2, SQUARE, SQUARE, SQUARE * 0.14);
    pctx.fillStyle = '#000';
    pctx.fill();

    if (!burstDone) {
      // 白圆 + 彩色线条
      pctx.beginPath();
      pctx.arc(SQUARE * 0.16, -SQUARE * 0.16, circleR, 0, Math.PI * 2);
      pctx.fillStyle = '#fff';
      pctx.fill();

      pctx.lineWidth = 2;
      pctx.lineCap = 'round';
      for (const ln of lines) {
        pctx.strokeStyle = ln.color;
        pctx.beginPath();
        pctx.moveTo(ln.x1 - cx, ln.y1 - cy);
        pctx.lineTo(ln.x2 - cx, ln.y2 - cy);
        pctx.stroke();
      }
    }
    pctx.restore();
  }

  function drawPhys() {
    pctx.clearRect(0, 0, W, H);
    drawSquare();
    for (const d of droplets) {
      const color = (d as Matter.Body & { color: string }).color;
      pctx.beginPath();
      pctx.arc(d.position.x, d.position.y, (d as Matter.Body & { radius: number }).radius, 0, Math.PI * 2);
      pctx.fillStyle = color;
      pctx.fill();
    }
  }

  let gravityOn = false; // 反相之后粒子才有重力

  function stepParticles(dt: number) {
    tctx.lineWidth = 1.6;
    tctx.lineCap = 'round';
    for (const p of particles) {
      if (p.dead) continue;
      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (gravityOn) p.vy += 0.28 * dt;

      // 撞墙：深度够就反弹+继续画；深度不够就分裂
      const hitX = p.x <= 0 || p.x >= W;
      const hitY = p.y <= 0 || p.y >= H;
      /**
       * 只有"演出中"才和墙碰撞、分裂。
       * 反相之后的自由落体必须**穿过墙掉出屏幕**，否则粒子到最深处只会
       * 一直反弹/分裂，页面永远收不了尾（踩过这个坑：卡在 inverted 不结束）。
       */
      if ((hitX || hitY) && !gravityOn) {
        p.x = Math.max(0, Math.min(W, p.x));
        p.y = Math.max(0, Math.min(H, p.y));
        if (p.depth < MAX_SPLIT_DEPTH) {
          burstAt(p.x, p.y, p.color, p.depth + 1);
          p.dead = true;
          continue;
        }
        if (hitX) p.vx = -p.vx * 0.92;
        if (hitY) p.vy = -p.vy * 0.92;
      }

      if (p.x < -20 || p.x > W + 20 || p.y > H + 40) {
        p.dead = true;
        continue;
      }

      tctx.strokeStyle = p.color;
      tctx.globalAlpha = 0.85;
      tctx.beginPath();
      tctx.moveTo(prevX, prevY);
      tctx.lineTo(p.x, p.y);
      tctx.stroke();
    }
    tctx.globalAlpha = 1;
  }

  // ── 手写（字体 + 笔刷遮罩） ───────────────────────────────────────────
  let fontLoaded = false;
  let ink = '#000'; // 反相前黑字，反相后白字
  let glyphCanvas: HTMLCanvasElement | null = null;
  let maskCanvas: HTMLCanvasElement | null = null;
  let wordX = 0;
  let wordY = 0;
  let wordW = 0;
  let wordH = 0;
  let fontPx = 0;
  let letterOffsets: number[] = [];

  // 每个字母的笔迹骨架（归一化 0..1，x 右 y 下），多段折线
  const STROKES: Record<string, [number, number][][]> = {
    b: [
      [
        [0.18, 0.04],
        [0.18, 0.96],
      ],
      [
        [0.18, 0.52],
        [0.42, 0.5],
        [0.66, 0.58],
        [0.78, 0.72],
        [0.66, 0.88],
        [0.4, 0.92],
        [0.2, 0.86],
      ],
    ],
    a: [
      [
        [0.76, 0.58],
        [0.66, 0.46],
        [0.44, 0.44],
        [0.24, 0.6],
        [0.24, 0.8],
        [0.44, 0.94],
        [0.66, 0.9],
        [0.78, 0.76],
      ],
      [
        [0.8, 0.44],
        [0.8, 0.96],
      ],
    ],
    d: [
      [
        [0.2, 0.44],
        [0.44, 0.44],
        [0.66, 0.52],
        [0.76, 0.68],
        [0.68, 0.9],
        [0.44, 0.94],
        [0.22, 0.86],
      ],
      [
        [0.82, 0.06],
        [0.82, 0.96],
      ],
    ],
    s: [
      [
        [0.74, 0.5],
        [0.58, 0.42],
        [0.36, 0.44],
        [0.22, 0.56],
        [0.3, 0.66],
        [0.56, 0.72],
        [0.74, 0.82],
        [0.66, 0.94],
        [0.4, 0.94],
        [0.22, 0.88],
      ],
    ],
    h: [
      [
        [0.2, 0.06],
        [0.2, 0.96],
      ],
      [
        [0.2, 0.62],
        [0.36, 0.52],
        [0.56, 0.56],
        [0.7, 0.72],
        [0.7, 0.96],
      ],
    ],
    e: [
      [
        [0.7, 0.66],
        [0.56, 0.5],
        [0.36, 0.46],
        [0.22, 0.58],
        [0.22, 0.76],
        [0.36, 0.9],
        [0.6, 0.9],
        [0.72, 0.8],
      ],
      [
        [0.72, 0.66],
        [0.34, 0.66],
      ],
    ],
    p: [
      [
        [0.24, 0.5],
        [0.24, 1.16],
      ],
      [
        [0.24, 0.56],
        [0.46, 0.52],
        [0.7, 0.6],
        [0.76, 0.78],
        [0.6, 0.94],
        [0.38, 0.94],
        [0.26, 0.88],
      ],
    ],
  };

  function buildGlyphs() {
    if (document.fonts && !fontLoaded) {
      document.fonts.load(`${fontPx}px "Instrument Serif"`).then(() => {
        fontLoaded = true;
        buildGlyphs();
      });
      return;
    }
    const mctx = document.createElement('canvas').getContext('2d')!;
    mctx.font = `${fontPx}px "Instrument Serif"`;
    letterOffsets = [];
    for (let i = 0; i <= WORD.length; i++) letterOffsets.push(mctx.measureText(WORD.slice(0, i)).width);
    wordW = mctx.measureText(WORD).width;
    wordH = fontPx * 1.4;
    wordX = (W - wordW) / 2;
    wordY = (H - fontPx * 0.5) / 2;

    glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = Math.ceil(wordW * dpr);
    glyphCanvas.height = Math.ceil(wordH * dpr);
    const gctx = glyphCanvas.getContext('2d')!;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.font = `${fontPx}px "Instrument Serif"`;
    gctx.fillStyle = '#fff'; // 用白字当形状遮罩，展示时再上 ink 色
    gctx.textBaseline = 'alphabetic';
    gctx.fillText(WORD, 0, fontPx);

    maskCanvas = document.createElement('canvas');
    maskCanvas.width = glyphCanvas.width;
    maskCanvas.height = glyphCanvas.height;
  }

  // 把笔迹进度换算成当前要画的笔刷点
  function penPoint(letterIdx: number, t: number): { x: number; y: number; idx: number } {
    const strokes = STROKES[WORD[letterIdx]] ?? [];
    const total = strokes.length;
    // t 在 0..1 里切到某一条折线
    const seg = Math.min(total - 1, Math.floor(t * total));
    const local = t * total - seg;
    const pts = strokes[seg];
    const span = pts.length - 1;
    const f = local * span;
    const i = Math.min(span - 1, Math.floor(f));
    const frac = f - i;
    const p0 = pts[i];
    const p1 = pts[i + 1];
    return {
      x: p0[0] + (p1[0] - p0[0]) * frac,
      y: p0[1] + (p1[1] - p0[1]) * frac,
      idx: letterIdx,
    };
  }

  function glyphBox(letterIdx: number) {
    const lx = letterOffsets[letterIdx];
    const rx = letterOffsets[letterIdx + 1];
    return { lx, rx, w: rx - lx };
  }

  // 把归一化坐标换算到 glyph canvas 上的实际坐标（含 descender，p 会伸到基线下方）
  function toGlyph(letterIdx: number, nx: number, ny: number) {
    const box = glyphBox(letterIdx);
    // 基线在 fontPx 处（canvas 顶部到基线是 fontPx）
    return {
      x: box.lx + nx * box.w,
      y: fontPx * 0.18 + ny * (fontPx * 0.82), // 顶部给 0.18 的上伸空间
    };
  }

  interface BrushState {
    letterIdx: number;
    progress: number;
    brushX: number;
    brushY: number;
  }

  let writing = false;
  let writeElapsed = 0;
  let lastBrush: BrushState | null = null;
  let writeDone = false;
  let inverted = false;

  function brushRadius() {
    return Math.max(10, fontPx * 0.1);
  }

  function stampMask(mctx: CanvasRenderingContext2D, x: number, y: number, dry: boolean) {
    const r = brushRadius();
    mctx.save();
    mctx.translate(x, y);
    if (dry) {
      // 飞白：很多随机小点，边缘粗糙
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * r;
        const dot = 0.8 + Math.random() * 2.4;
        mctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.4})`;
        mctx.beginPath();
        mctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, dot, 0, Math.PI * 2);
        mctx.fill();
      }
    } else {
      const g = mctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = g;
      mctx.beginPath();
      mctx.arc(0, 0, r, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.restore();
  }

  function advanceWriting(dt: number) {
    /**
     * 遮罩画布还没就绪（字体还在加载）时**不要推进时间**。
     * 否则字一加载完，writeElapsed 已经跑到终点，整行字会瞬间蹦出来。
     */
    if (!maskCanvas || !glyphCanvas || !wordW) return;

    writeElapsed += dt;
    const mainEnd = T.writeMain;
    const pEnd = mainEnd + T.writeP;
    const total = pEnd;

    let done = writeElapsed >= total;
    let t = Math.min(writeElapsed, total);

    let letterIdx: number;
    let letterT: number;
    let dry = false;

    if (t < mainEnd) {
      // 前 10 个字母 badbadshee，均匀铺在 3.5s 里
      const per = mainEnd / 10;
      letterIdx = Math.min(9, Math.floor(t / per));
      letterT = (t - letterIdx * per) / per;
    } else {
      // 最后一个 p，用 1s，枯笔
      letterIdx = 10;
      letterT = (t - mainEnd) / T.writeP;
      dry = true;
    }

    const mctx = maskCanvas!.getContext('2d')!;
    const target = penPoint(letterIdx, letterT);
    const g = toGlyph(letterIdx, target.x, target.y);
    stampMask(mctx, g.x, g.y, dry);
    lastBrush = { letterIdx, progress: letterT, brushX: g.x, brushY: g.y };

    if (done && !writeDone) {
      writeDone = true;
      writing = false;
      invert();
    }
  }

  function composeText() {
    if (!glyphCanvas || !maskCanvas) return;
    xctx.clearRect(0, 0, W, H);
    // 白字形 × 遮罩，再上 ink 色
    const tmp = document.createElement('canvas');
    tmp.width = glyphCanvas.width;
    tmp.height = glyphCanvas.height;
    const tc = tmp.getContext('2d')!;
    tc.drawImage(glyphCanvas, 0, 0);
    tc.globalCompositeOperation = 'destination-in';
    tc.drawImage(maskCanvas, 0, 0);
    // 上色
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = ink;
    tc.fillRect(0, 0, tmp.width, tmp.height);
    xctx.drawImage(tmp, wordX * dpr, (wordY - fontPx * 0.4) * dpr, wordW * dpr, wordH * dpr);
  }

  // ── 反相与终态 ────────────────────────────────────────────────────────
  let fallTimer = 0;
  let falling = false;

  function invert() {
    inverted = true;
    ink = '#fff';
    composeText();
    document.body.dataset.phase = 'inverted';
  }

  function finishFall() {
    // 淡出物理与拖尾，露出纯黑底白字
    phys.style.opacity = '0';
    trail.style.opacity = '0';
    tagline.classList.add('on');
    below.classList.add('on');
    document.body.dataset.phase = 'final';
  }

  function showFinal() {
    // 无动画直达终态
    document.body.dataset.phase = 'final';
    size();
    fontPx = Math.min(0.62 * W, H * 0.28);
    // 直接画白字（不遮罩）
    xctx.clearRect(0, 0, W, H);
    xctx.font = `${fontPx}px "Instrument Serif"`;
    xctx.fillStyle = '#fff';
    xctx.textAlign = 'center';
    xctx.textBaseline = 'middle';
    xctx.fillText(WORD, W / 2, H / 2);
    xctx.textAlign = 'left';
    tagline.classList.add('on');
    below.classList.add('on');
    if (!document.body.dataset.phase) document.body.dataset.phase = 'final';
  }

  // ── 主循环 ────────────────────────────────────────────────────────────
  const FIXED = 1000 / 60;
  let last = performance.now();
  let accumulator = 0;
  let elapsed = 0;
  let startedWrite = false;

  function frame(now: number) {
    let dt = now - last;
    last = now;
    if (dt > 100) dt = 100;

    elapsed += dt;

    // 时间轴
    if (!burstDone && elapsed >= T.burst) {
      spawnDroplets();
      engine.gravity.y = 1.1; // 解锁：方块开始转
    }
    if (!startedWrite && elapsed >= T.writeStart) {
      startedWrite = true;
      writing = true;
      fontPx = Math.min(0.62 * W, H * 0.28);
      buildGlyphs();
    }

    // 物理
    if (!inverted) {
      accumulator += dt;
      while (accumulator >= FIXED) {
        Matter.Engine.update(engine, FIXED);
        accumulator -= FIXED;
      }
      // 处理撞墙移除（不能在 update 里改 world）
      for (const b of toRemove) {
        Matter.Composite.remove(engine.world, b);
        const i = droplets.indexOf(b);
        if (i >= 0) droplets.splice(i, 1);
      }
      toRemove.clear();
      stepParticles(dt / 16.666);
    }

    // 反相后：冻结 0.3s 再落
    if (inverted) {
      fallTimer += dt;
      if (fallTimer >= T.freeze) {
        falling = true;
        // 让剩下的液滴也掉出去：把方块约束拆掉，重力已开，全掉
        if (!square.isStatic) {
          Matter.Composite.remove(engine.world, hinge);
          Matter.Body.setStatic(square, true);
        }
        accumulator += dt;
        while (accumulator >= FIXED) {
          Matter.Engine.update(engine, FIXED);
          accumulator -= FIXED;
        }
        gravityOn = true;
        stepParticles(dt / 16.666);
      }
      // 粒子清空后收尾
      if (falling && particles.every((p) => p.dead)) {
        finishFall();
        return; // 停掉循环
      }
    }

    // 书写
    if (writing) advanceWriting(dt);
    if (startedWrite) composeText();

    // 绘制
    if (!inverted) drawPhys();

    requestAnimationFrame(frame);
  }

  // 初始帧：白底黑方块
  drawPhys();

  // 先等字体，再起循环（避免写之前字体没到位）
  if (document.fonts) {
    document.fonts.ready.then(() => {
      requestAnimationFrame(frame);
    });
  } else {
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', size);
}
