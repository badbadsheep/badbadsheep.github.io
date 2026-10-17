/**
 * 首屏动效的驱动层 —— 场景本身【留空】，但管道全部接好了。
 *
 * ══ 现在是什么状态 ══
 * 第一屏看到的是 Hero.astro 里那套纯 CSS 静态几何构图。这个文件目前只做三件事：
 *   1. 判定降级档位（full / reduced / static），写到 <html data-art-tier>
 *   2. 帮场景把画布尺寸、DPR、resize、页面隐藏、滚出视口这几件事处理好
 *   3. 采样指针与滚动进度，喂给场景
 * 因为 REGISTRY 是空的，所以现在没有任何 canvas 绘制发生 —— 这就是"留空"。
 *
 * ══ 接一个动效要做什么 ══
 *   1. 新建 src/scripts/art/xxx.ts，导出一个 SceneFactory：
 *
 *        import type { SceneContext, Scene } from './index';
 *        export const createXxxScene: SceneFactory = ({ canvas, tier, reduced }) => {
 *          const gl = canvas.getContext('webgl2');
 *          if (!gl) return null;              // 交给 static 降级
 *          // …编译 shader、建 buffer…
 *          return {
 *            render(time) { … },
 *            setPointer(x, y) { … },
 *            setScroll(p) { … },
 *            setTheme(theme) { … },
 *            resize() { … },
 *            destroy() { … },
 *          };
 *        };
 *
 *   2. 在这个文件顶部的 REGISTRY 里登记：REGISTRY.default = createXxxScene;
 *   3. Hero.astro 不用改。CSS 那层继续当降级画面。
 *
 * ══ 硬约束（别绕过） ══
 *   · 不许在主线程逐帧算粒子位置 —— 那是 GPU 的事
 *   · static 档位必须能出画面（CSS 层已经保证了，别把 CSS 层删掉）
 *   · 颜色从 CSS 变量读（--art-ink / --art-line），这样主题切换不用写第二套
 */

export type Tier = 'full' | 'reduced' | 'static';

export interface SceneContext {
  canvas: HTMLCanvasElement;
  tier: Exclude<Tier, 'static'>;
  reduced: boolean;
  /** 从 CSS 变量读到的墨色，给 shader 当 uniform */
  ink: [number, number, number];
}

export interface Scene {
  /** 每帧调用；time 是毫秒 */
  render(time: number): void;
  setPointer(x: number, y: number): void;
  /** 0 = 第一屏刚出现，1 = 第一屏完全滚过 */
  setScroll(progress: number): void;
  setTheme(theme: string): void;
  resize(): void;
  destroy(): void;
}

export type SceneFactory = (ctx: SceneContext) => Scene | null;

/* ── 场景登记处：现在是空的，接动效时往这里填 ──────────────────────────── */
const REGISTRY: Record<string, SceneFactory> = {};

const prefersReduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 档位判定：先看用户意愿，再看设备，最后看屏幕。 */
export function detectTier(): Tier {
  if (prefersReduced()) return 'static';

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return 'static';

  // 没有 WebGL2 就不画：CSS 构图顶上
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) return 'static';
  } catch {
    return 'static';
  }

  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  if (cores <= 4 || mem <= 4 || window.innerWidth < 700) return 'reduced';

  return 'full';
}

/** 从 CSS 里读一个 RGB 三元组变量，比如 --art-ink: 255, 255, 255 */
function readInk(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--art-ink').trim();
  const parts = raw.split(',').map((n) => Number.parseFloat(n));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }
  return [1, 1, 1];
}

export function mountHero(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-art]');
  if (!canvas) return;

  const tier = detectTier();
  document.documentElement.dataset.artTier = tier;
  canvas.dataset.artState = tier;

  const factory = REGISTRY.default;
  // 还没登记场景 —— 就这样。CSS 构图就是最终画面。
  if (!factory || tier === 'static') return;

  const ctx: SceneContext = {
    canvas,
    tier,
    reduced: false,
    ink: readInk(),
  };

  const scene = factory(ctx);
  if (!scene) {
    canvas.dataset.artState = 'static';
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, tier === 'full' ? 2 : 1.5);
  let frame = 0;
  let running = false;
  let last = 0;

  const fit = (): void => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scene.resize();
  };

  const loop = (time: number): void => {
    if (!running) return;
    // reduced 档位压到约 30fps
    if (tier === 'reduced' && time - last < 32) {
      frame = requestAnimationFrame(loop);
      return;
    }
    last = time;
    scene.render(time);
    frame = requestAnimationFrame(loop);
  };

  const start = (): void => {
    if (running) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(loop);
  };

  const stop = (): void => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  fit();
  start();

  /* 指针：只算相对画布的位置，不做任何节流 —— uniform 更新很便宜 */
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    scene.setPointer(
      (e.clientX - rect.left) / Math.max(1, rect.width),
      (e.clientY - rect.top) / Math.max(1, rect.height)
    );
  });
  canvas.addEventListener('pointerleave', () => scene.setPointer(-1, -1));

  /* 滚动进度：0 → 1 表示第一屏滚过去 */
  let scrollTick = 0;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTick) return;
      scrollTick = requestAnimationFrame(() => {
        scrollTick = 0;
        const h = canvas.clientHeight || 1;
        scene.setScroll(Math.min(1, Math.max(0, window.scrollY / h)));
      });
    },
    { passive: true }
  );

  /* 滚出视口 / 切到后台就停，别烧电 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) start();
        else stop();
      },
      { threshold: 0 }
    ).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  /* 设备像素比变化（外接屏 / 缩放）时重建 */
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fit, 180);
  });

  /* 上下文丢失：一格降级，不报错、不重试 */
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    canvas.dataset.artState = 'static';
    scene.destroy();
  });

  /* 主题切换后墨色会变，通知场景重读 */
  new MutationObserver(() => scene.setTheme(document.documentElement.dataset.theme ?? 'dark')).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] }
  );
}
