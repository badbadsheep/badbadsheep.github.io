/**
 * 首页四屏的动态底纹。
 *
 * ══ 要做什么 ══
 * 首页第 2–5 屏（博客 / 笔记 / 故事 / 影像）背后那张"线"，以前是四屏共用一张
 * 静态方格。现在每一屏有自己的几何：方格 → 正三角 → 正六边形 → 不规则多边形，
 * 滚动跨过两屏之间时，线会连续地转、加、抖，而不是硬切。
 *
 * ══ 怎么做到的 ══
 * 一个 sticky 在「四屏」这一段里的画布（100svh 高，滚出四屏自动让开），
 * 画布上跑一个全屏 fragment shader，四种线场都在 GPU 里算：
 *
 *   方格      两族平行线（0° / 90°）
 *   正三角    三族平行线（30° / 90° / 150°）—— 底边水平
 *   正六边形  三角晶格的 Voronoi 边界（晶格点距 56 → 边长 32.33、对边 56）
 *   不规则    同一套 Voronoi，但每个晶格点按哈希抖动
 *
 * 三种图案共用同一个线距（56），所以跨屏时**没有整体缩放**，线只在原地转角度
 * （0°→30°）、加一族（权重 0→1）、换层（线族↔细胞）、抖顶点（0→0.62）。
 *
 * 三件真事叠在一起：
 *   ① 参数插值：角度 0°→30°、第三族权重 0→1、抖动 0→0.62
 *   ② 错峰：每个像素的起始时刻由一个低频噪声决定（最多晚 0.38 个进度），
 *      于是过渡像一道波浪扫过屏幕，而不是整体齐步换装（这个手感来自参考站）
 *   ③ 域扭曲：过渡中段把采样坐标按噪声推开最多 ±4px，线跟着弯一下再站直
 *
 * ══ 硬约束 ══
 *   · 不引 three.js / 任何依赖，纯 WebGL2 + 一个 quad
 *   · 没有 WebGL2 / saveData → 一根手指都不碰 DOM，原来那张 CSS 静态方格照旧
 *   · prefers-reduced-motion → 仍然画（每屏还是各自的图案），但没有过渡：
 *     跨屏时直接换，不做 morph
 *   · 没有常驻 rAF：滚动、resize、换主题才重画一次，静止时一帧都不画
 *   · 不跟指针交互（首屏 hero 那套指针推留在 Hero.astro 里，与此无关）
 */
import { readInkColor, readCssNumber, type RGB } from './tokens';

/** 四种几何。数组顺序就是四个栏目的顺序。
 *
 *  三族平行线：第 1 族固定 90°（永远是横线），第 2 族固定 150°，第 3 族角度在 ang0 里插值。
 *    · 方格 = ang0 0°  + 第 2 族权重 0      → 只有 0° / 90° 两族 = 方格子
 *    · 三角 = ang0 30° + 第 2 族权重 1      → 30° / 90° / 150° 三族 = 正三角，底边水平
 *  三族线距全部相同（SP = 56 = 方格原来的格子），所以跨屏时没有"整张网缩放"，
 *  线只会转角度、加一族，横向不会突然窜位。
 *
 *  ang0 = 第 3 族线的角度（方格 0° → 三角 30°）
 *  w2   = 第 2 族线的权重（方格没有 → 三角 1）
 *  fam  = 线族层权重   wor = Voronoi 层权重
 *  jit  = 晶格点抖动（0 = 正六边形 → 0.62 = 不规则多边形）
 *
 *  故事/影像 的 fam = 0，此时 ang0 / w2 取和笔记一样的值，免得"正在淡出的那族"半路又转角度。
 */
const PATTERNS = [
  { ang0: 0, w2: 0, fam: 1, wor: 0, jit: 0 }, // 博客：方格
  { ang0: 30, w2: 1, fam: 1, wor: 0, jit: 0 }, // 笔记：正三角（底边水平）
  { ang0: 30, w2: 1, fam: 0, wor: 1, jit: 0 }, // 故事：正六边形
  { ang0: 30, w2: 1, fam: 0, wor: 1, jit: 0.62 }, // 影像：不规则多边形
] as const;

/** 线距 / 六边形晶格点间距：同一个 56，四种图案尺寸一致 */
const SP = 56;
/** 过渡中段的域扭曲幅度（css px，实际位移是它的一半） */
const WARP = 8;
/** 错峰宽度：不同区域开始变形的时刻最多错开这么多（0..1 的比例） */
const SPREAD = 0.38;

/** 底纹相对页面的移动速度（1 = 死死贴住页面；0.5 = 慢半拍的视差层）。
 *  方向：滚轮往下滚、页面内容往上走时，底纹也**往上**走（同向）。 */
const PARALLAX = 0.5;
/** 平滑时间常数（ms）：滚轮是一格一格跳的，靠这个把底纹位移抹成连续运动。
 *  越大越"追不上"，越小越贴着滚动位置。 */
const EASE_MS = 110;
/** 像素预算：这张底纹是整屏像素着色。2560×1440@2x = 1470 万像素，
 *  再快的集显也会掉帧（表现就是滚动"一顿一顿"）。超过预算就按比例降像素比。 */
const PIXEL_BUDGET = 4.2e6;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

out vec4 outColor;

uniform float uDpr;
uniform float uPhase;     // 底纹的纵向相位（css px）——由 JS 平滑后给进来
uniform float uMorph;     // 0..1：当前这一屏 → 下一屏的进度
uniform float uAng0A, uAng0B;
uniform float uW2A, uW2B;
uniform float uFamA, uFamB;
uniform float uWorA, uWorB;
uniform float uJitA, uJitB;
uniform float uSp;
uniform float uLineW;
uniform float uLineA;
uniform vec3 uInk;
uniform float uWarp;
uniform float uStatic;   // 1 = 减少动效：不做错峰与扭曲

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y);
}

/* 一族平行线：到最近一条的距离（css px） */
float familyDist(vec2 p, float deg, float spacing) {
  float a = radians(deg);
  return abs(fract(dot(p, vec2(cos(a), sin(a))) / spacing + 0.5) - 0.5) * spacing;
}

/* 三角晶格（可抖动）的最近点与次近点：两者之差的一半就是到 Voronoi 边的距离。
   3×3 邻域足够 —— 抖动幅度不到半个点距，更远的点不可能更近。 */
vec2 cellNearest(vec2 p, float s, float jit) {
  const float R3 = 0.8660254;
  float j = p.y / (s * R3);
  float i = (p.x - j * s * 0.5) / s;
  vec2 base = floor(vec2(i, j) + 0.5);
  float f1 = 1e9;
  float f2 = 1e9;
  for (int dj = -1; dj <= 1; dj++) {
    for (int di = -1; di <= 1; di++) {
      vec2 c = base + vec2(float(di), float(dj));
      vec2 jt = (vec2(hash21(c), hash21(c + 19.19)) - 0.5) * (jit * s);
      vec2 wp = vec2(c.x * s + c.y * s * 0.5, c.y * s * R3) + jt;
      float d = distance(p, wp);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return vec2(f1, f2);
}

/* 线宽 w 的一条线，返回 0..1 的覆盖率（带一像素抗锯齿） */
float lineCov(float d, float w) {
  float aa = max(fwidth(d) * 0.5, 0.5 / uDpr);
  return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d);
}

void main() {
  /* gl_FragCoord.y 是**从下往上**数的（OpenGL 规矩）。uPhase 由 JS 给：
     滚轮往下滚时它变小，于是同一处纹样在屏幕上的高度变大 —— 也就是**跟着内容一起往上走**。 */
  vec2 p = vec2(gl_FragCoord.x / uDpr, gl_FragCoord.y / uDpr + uPhase);

  /* 半个像素的相位对齐：方格的两族线正好落在整数坐标上（线距是整数 56），
     而像素中心在 x.5 处，于是每条线都被"劈"在两个像素上、只画到 72% 的浓度。
     把图案整体挪半个设备像素，线就落在像素中心，1.3px 该有多亮就多亮（#222）。 */
  p += 0.5 / uDpr;

  /* ── 两个进度，各管一件事 ──────────────────────────────────────────────
     tg：全屏统一的进度，用来插值**几何参数**（角度、抖动）。
         几何必须统一 —— 否则同一时刻屏幕上不同位置角度不同，直线会被"拉弯"，
         看起来像塑料被烤化了。
     tl：每个像素错开的进度（低频噪声决定，最多晚 SPREAD），只用来插值**权重**
         （哪一层在、哪一族在）。波浪感全部来自这里：线的形状是一致的，
         只是"该换的那一层"从屏幕一侧扫到另一侧。 */
  float tg = uMorph;
  float tl = uMorph;
  if (uStatic > 0.5) {
    tg = step(0.5, uMorph);
    tl = tg;
  } else if (uMorph > 0.001 && uMorph < 0.999) {
    /* 只有过渡中才需要那个低频噪声。uMorph 是 uniform，所以整个 shader 走的是同一个分支：
       "某屏占满视口"的时候这里一次噪声都不算（省下来的正好是最常驻的状态）。 */
    tl = clamp((uMorph - vnoise(p * 0.0023) * ${SPREAD.toFixed(2)}) / (1.0 - ${SPREAD.toFixed(2)}), 0.0, 1.0);
  }
  tg = tg * tg * (3.0 - 2.0 * tg);
  tl = tl * tl * (3.0 - 2.0 * tl);

  /* 域扭曲：两端为 0、中段最大（跟着统一进度走，整片一起轻轻弯） */
  float amp = sin(tg * 3.14159265) * uWarp * (1.0 - uStatic);
  if (amp > 0.001) {
    vec2 w = vec2(vnoise(p * 0.0026 + 3.7), vnoise(p * 0.0026 + 11.3)) - 0.5;
    p += w * amp;
  }

  /* 几何：统一进度 */
  float ang0 = mix(uAng0A, uAng0B, tg);
  float jit = mix(uJitA, uJitB, tg);
  /* 权重：错峰进度 */
  float w2 = mix(uW2A, uW2B, tl);
  float famW = mix(uFamA, uFamB, tl);
  float worW = mix(uWorA, uWorB, tl);

  /* 三族线的角度是固定的（90° / 150°）或者只转 30°（0°→30°），线距恒定 ——
     所以过渡时线只在原地转/淡入淡出，不会整片横向窜位。 */
  float cov = 0.0;
  if (famW > 0.003) {
    float c0 = lineCov(familyDist(p, ang0, uSp), uLineW);
    float c1 = lineCov(familyDist(p, 90.0, uSp), uLineW);
    float c2 = lineCov(familyDist(p, 150.0, uSp), uLineW) * w2;
    cov = max(cov, max(c0, max(c1, c2)) * famW);
  }
  if (worW > 0.003) {
    vec2 f = cellNearest(p, uSp, jit);
    cov = max(cov, lineCov((f.y - f.x) * 0.5, uLineW) * worW);
  }

  vec3 bg = vec3(1.0) - uInk;
  outColor = vec4(mix(bg, uInk, clamp(cov, 0.0, 1.0) * uLineA), 1.0);
}`;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // 编译失败就当没有这个功能，别把页面搞崩
    console.warn('[screens] shader 编译失败：', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function mountScreens(): void {
  const container = document.querySelector<HTMLElement>('.screens');
  if (!container) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return; // 省流量：保留静态方格

  /* 低配设备（少核 / 小内存 / 窄屏）把像素比压到 1.5：这张底纹是整屏像素着色，
     2 倍屏上全屏铺满的代价不小，而它本来也只是很淡的线。 */
  const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || window.innerWidth < 700;
  const dprCap = reduced ? 1.25 : lowEnd ? 1.5 : 2;

  const canvas = document.createElement('canvas');
  canvas.className = 'screens__art';
  canvas.setAttribute('aria-hidden', 'true');

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  });
  if (!gl) return; // 没有 WebGL2：一个字都不改，CSS 静态方格照旧

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  if (!program) return;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[screens] program 链接失败：', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // 一个盖住视口的 quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  const U = {
    dpr: u('uDpr'),
    phase: u('uPhase'),
    morph: u('uMorph'),
    ang0: [u('uAng0A'), u('uAng0B')],
    w2: [u('uW2A'), u('uW2B')],
    sp: u('uSp'),
    fam: [u('uFamA'), u('uFamB')],
    wor: [u('uWorA'), u('uWorB')],
    jit: [u('uJitA'), u('uJitB')],
    lineW: u('uLineW'),
    lineA: u('uLineA'),
    ink: u('uInk'),
    warp: u('uWarp'),
    static: u('uStatic'),
  };

  /* ── 令牌（颜色与线宽都从 CSS 读，主题切换不用写第二套） ─────────────── */
  let ink: RGB = [1, 1, 1];
  let lineW = 1.3;
  let lineA = 0.133;

  const readTokens = (): void => {
    ink = readInkColor(container);
    lineW = readCssNumber(container, '--screen-line-w', 1.3);
    lineA = readCssNumber(container, '--screen-line-a', 0.133);
  };

  /* ── 尺寸与版面 ───────────────────────────────────────────────────────── */
  let dpr = 1;
  let screensTop = 0;
  let screens: { top: number; h: number }[] = [];
  /** 底纹纵向相位：target 是"跟着滚到哪儿"，shown 是平滑后真正画出来的 */
  let phaseTarget = 0;
  let phaseShown = 0;
  let lastDrawAt = 0;

  const measure = (): void => {
    const rect = container.getBoundingClientRect();
    screensTop = rect.top + window.scrollY;
    screens = [...container.querySelectorAll<HTMLElement>('.screen')].map((el) => ({
      top: el.offsetTop,
      h: el.offsetHeight,
    }));
  };

  const resize = (): void => {
    const wCss = Math.max(1, canvas.clientWidth);
    const hCss = Math.max(1, canvas.clientHeight);
    /* 像素比：先按设备来，再用像素预算兜住 —— 大屏 2x 是这张底纹唯一会掉帧的情形。 */
    let scale = Math.min(window.devicePixelRatio || 1, dprCap);
    if (wCss * hCss * scale * scale > PIXEL_BUDGET) {
      scale = Math.sqrt(PIXEL_BUDGET / (wCss * hCss));
    }
    dpr = Math.max(1, Math.min(scale, dprCap));
    const w = Math.max(1, Math.round(wCss * dpr));
    const h = Math.max(1, Math.round(hCss * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    measure();
    gl.viewport(0, 0, canvas.width, canvas.height);
    request();
  };

  /* ── 绘制：只在"有变化"时画一帧，静止时零开销 ──────────────────────────
     四屏底纹不跟指针交互（首屏 hero 那套指针推开照旧在 Hero.astro 里，没动）。 */
  let raf = 0;
  let inView = true;
  let lost = false;

  const draw = (): void => {
    raf = 0;
    if (lost || !inView) return;

    const scrollY = window.scrollY;

    /* ── 底纹的纵向位移 ──────────────────────────────────────────────────
       ① 方向：滚轮往下滚 = 页面内容往上走，底纹也往上走（同一个方向）。
          数学上就是相位取 **负**、随 scrollY 增大而变小。
       ② 速度：乘 PARALLAX（0.5 = 慢半拍），像落在内容后面的一层，不是死贴着内容。
       ③ 平滑：滚轮是一格一格跳的，先算出目标相位，再用时间常数 EASE_MS 追过去 ——
          格子就不再"跟着滚轮一顿一顿"，而是连续滑。追的过程会继续排帧，追上就停。 */
    phaseTarget = -scrollY * PARALLAX;
    const now = performance.now();
    const dt = lastDrawAt ? Math.min(64, now - lastDrawAt) : 16;
    lastDrawAt = now;
    const k = 1 - Math.exp(-dt / EASE_MS);
    phaseShown += (phaseTarget - phaseShown) * k;
    let easing = Math.abs(phaseTarget - phaseShown) > 0.08;
    if (!easing) phaseShown = phaseTarget;

    /* 哪两屏之间、走了多少。按「屏心到屏心」算：某一屏正好占住视口时 m=0，
       下一屏占住视口时 m=1 —— 中间那段才是过渡区。 */
    const n = screens.length;
    let a = 0;
    let b = 1;
    let m = 0;

    if (n >= 2) {
      const y = scrollY + window.innerHeight * 0.5 - screensTop;
      const mid = screens.map((s) => s.top + s.h * 0.5);
      if (y <= mid[0]) {
        a = 0;
        b = 1;
        m = 0;
      } else if (y >= mid[n - 1]) {
        a = n - 2;
        b = n - 1;
        m = 1;
      } else {
        let i = 0;
        for (let k = 0; k < n - 1; k += 1) if (y >= mid[k]) i = k;
        a = i;
        b = i + 1;
        m = clamp((y - mid[i]) / Math.max(1, mid[i + 1] - mid[i]), 0, 1);
        // 两头留一口气：一屏完整占住视口时图案是定的，过渡集中在中间
        m = smoothstep(0.2, 0.8, m);
      }
    }

    const A = PATTERNS[Math.min(a, PATTERNS.length - 1)];
    const B = PATTERNS[Math.min(b, PATTERNS.length - 1)];

    gl.uniform1f(U.dpr, dpr);
    gl.uniform1f(U.phase, phaseShown);
    gl.uniform1f(U.morph, m);
    gl.uniform1f(U.ang0[0], A.ang0);
    gl.uniform1f(U.ang0[1], B.ang0);
    gl.uniform1f(U.w2[0], A.w2);
    gl.uniform1f(U.w2[1], B.w2);
    gl.uniform1f(U.sp, SP);
    gl.uniform1f(U.fam[0], A.fam);
    gl.uniform1f(U.fam[1], B.fam);
    gl.uniform1f(U.wor[0], A.wor);
    gl.uniform1f(U.wor[1], B.wor);
    gl.uniform1f(U.jit[0], A.jit);
    gl.uniform1f(U.jit[1], B.jit);
    gl.uniform1f(U.lineW, lineW);
    gl.uniform1f(U.lineA, lineA);
    gl.uniform3f(U.ink, ink[0], ink[1], ink[2]);
    gl.uniform1f(U.warp, WARP);
    gl.uniform1f(U.static, reduced ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 还在"追"滚动位置的路上：继续排帧，直到追上（之后静止，一帧都不画）
    if (easing) request();
  };

  function request(): void {
    if (!raf && !lost) raf = requestAnimationFrame(draw);
  }

  /* ── 接上页面 ─────────────────────────────────────────────────────────── */
  container.prepend(canvas);
  readTokens();
  resize();

  window.addEventListener('scroll', request, { passive: true });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 160);
  });

  // 字体/内容撑开导致版面变化时重新量
  if ('ResizeObserver' in window) new ResizeObserver(() => request()).observe(container);

  // 只在自己可见时画
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        if (inView) request();
      },
      { threshold: 0 }
    ).observe(canvas);
  }

  // 换主题：墨色与线 alpha 都会变
  new MutationObserver(() => {
    readTokens();
    request();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // 上下文丢了就撤掉画布，退回 CSS 静态方格（不报错、不重试）
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.remove();
  });
}
