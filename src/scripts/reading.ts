/**
 * 阅读区的渐进增强：代码块工具条、目录高亮、图片灯箱、评论懒加载。
 * 没有它页面照样能读 —— 只是少了复制按钮和灯箱。
 */

/* ── 代码块：包一条顶栏（语言 + 复制） ─────────────────────────────────── */

/**
 * execCommand('copy') 被标准标成了废弃，ts 会给一条 ts(6387)。
 * 但它仍然是「窗口没有焦点时」唯一能写进剪贴板的路（navigator.clipboard 那时会抛），
 * 所以这条降级必须留着 —— 这里自己声明一个签名，只是让类型检查别再报废弃，
 * 运行时的调用和原来一模一样。
 */
interface LegacyDocument {
  execCommand(commandId: string): boolean;
}

function legacyCopy(): boolean {
  return (document as unknown as LegacyDocument).execCommand('copy');
}

/**
 * 复制到剪贴板，三级降级：
 *   1. navigator.clipboard（要安全上下文 + 文档有焦点）
 *   2. execCommand('copy')（老浏览器、或者窗口没焦点时唯一能用的路）
 *   3. 全选代码，让用户自己按 Ctrl+C
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 落到下一级 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const done = legacyCopy();
    ta.remove();
    return done;
  } catch {
    return false;
  }
}

const preBlocks = document.querySelectorAll<HTMLPreElement>('.prose pre.astro-code');

preBlocks.forEach((pre) => {
  if (pre.parentElement?.classList.contains('code')) return;

  const lang = pre.dataset.lang || 'Text';
  const wrap = document.createElement('div');
  wrap.className = 'code';

  const bar = document.createElement('div');
  bar.className = 'code__bar';

  const label = document.createElement('span');
  label.className = 'code__lang';
  label.textContent = lang;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'code__copy';
  btn.textContent = '复制';

  btn.addEventListener('click', async () => {
    const text = pre.querySelector('code')?.textContent ?? '';
    if (await copyText(text)) {
      btn.textContent = '已复制';
      btn.setAttribute('data-done', '');
      window.setTimeout(() => {
        btn.textContent = '复制';
        btn.removeAttribute('data-done');
      }, 1500);
    } else {
      // 连 execCommand 都不行：全选，让用户自己按 Ctrl+C
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      btn.textContent = '已选中';
    }
  });

  bar.append(label, btn);

  /**
   * 结构：
   *   .code
   *     .code__bar     语言 + 复制
   *     .code__body    只在这里做高度裁剪（pre 自己还要横向滚，不能抢它）
   *     .code__fade    折叠时的淡出遮罩
   *     .code__fold    Unfold / Fold
   */
  const body = document.createElement('div');
  body.className = 'code__body';

  pre.replaceWith(wrap);
  body.append(pre);
  wrap.append(bar, body);

  /* ── 超过 5 行就折叠 ──────────────────────────────────────────────── */
  const FOLD_LINES = 5;
  const lines = pre.querySelectorAll('.line');

  if (lines.length > FOLD_LINES) {
    const fade = document.createElement('div');
    fade.className = 'code__fade';
    fade.setAttribute('aria-hidden', 'true');

    const fold = document.createElement('button');
    fold.type = 'button';
    fold.className = 'code__fold';
    fold.textContent = 'Unfold';
    fold.setAttribute('aria-expanded', 'false');

    /** 按真实行高算折叠高度，字体换了/字号变了都跟着变 */
    const applyFoldHeight = (): void => {
      const first = pre.querySelector<HTMLElement>('.line');
      if (!first) return;
      const lineHeight = first.getBoundingClientRect().height;
      if (lineHeight < 1) return; // 字体还没加载好，晚点再算
      const codeEl = pre.querySelector('code');
      const padTop = codeEl ? parseFloat(getComputedStyle(codeEl).paddingTop) || 0 : 0;
      wrap.style.setProperty('--code-fold-h', `${Math.round(lineHeight * FOLD_LINES + padTop + 6)}px`);
    };

    applyFoldHeight();
    // 网页字体是异步的：加载完再量一次，避免折叠高度按 fallback 字体算错
    if (document.fonts?.ready) void document.fonts.ready.then(applyFoldHeight);

    fold.addEventListener('click', () => {
      const folded = wrap.dataset.fold === 'true';
      wrap.dataset.fold = folded ? 'false' : 'true';
      fold.textContent = folded ? 'Fold' : 'Unfold';
      fold.setAttribute('aria-expanded', folded ? 'true' : 'false');
      if (!folded) {
        // 收起后代码块会突然变矮，把它的顶部带回视野，免得页面猛地一跳
        wrap.scrollIntoView({ block: 'nearest' });
      }
    });

    wrap.dataset.fold = 'true';
    wrap.append(fade, fold);
  }

  /* ── 横向滚动条：钉在视口底部 ────────────────────────────────────────
     pre 自己的横向滚动条只在代码块最底下，代码一长就得先滚到块尾才拖得动。
     这里加一条 position: sticky; bottom: 0 的代理条 —— 只要代码块还在视口里，
     它就一直贴在窗口下方，随手就能左右拖。两边同步 scrollLeft。 */
  const xbar = document.createElement('div');
  xbar.className = 'code__x';
  const xinner = document.createElement('div');
  xinner.className = 'code__x-inner';
  xbar.append(xinner);
  xbar.setAttribute('aria-hidden', 'true');

  const refreshXbar = (): void => {
    const needs = pre.scrollWidth > pre.clientWidth + 1;
    if (needs) {
      wrap.setAttribute('data-xscroll', '');
      xinner.style.width = `${pre.scrollWidth}px`;
      xbar.scrollLeft = pre.scrollLeft;
    } else {
      wrap.removeAttribute('data-xscroll');
    }
  };

  pre.addEventListener(
    'scroll',
    () => {
      if (wrap.hasAttribute('data-xscroll')) xbar.scrollLeft = pre.scrollLeft;
    },
    { passive: true }
  );
  xbar.addEventListener(
    'scroll',
    () => {
      if (wrap.hasAttribute('data-xscroll')) pre.scrollLeft = xbar.scrollLeft;
    },
    { passive: true }
  );

  refreshXbar();
  if (document.fonts?.ready) void document.fonts.ready.then(refreshXbar);
  window.addEventListener('resize', refreshXbar, { passive: true });

  wrap.append(xbar);
});

/* ── 目录：滚动时高亮当前节 ───────────────────────────────────────────── */

const toc = document.querySelector<HTMLElement>('[data-toc]');

if (toc) {
  const links = new Map<string, HTMLElement>();
  toc.querySelectorAll<HTMLAnchorElement>('[data-toc-link]').forEach((a) => {
    links.set(decodeURIComponent(a.hash.slice(1)), a);
  });

  const headings = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));

  if (headings.length) {
    let current: HTMLElement | null = null;
    const setActive = (id: string): void => {
      if (current) current.removeAttribute('data-active');
      const link = links.get(id) ?? null;
      current = link;
      link?.setAttribute('data-active', '');
    };

    /**
     * 用"越过了哪条线"来判定，而不是用 IntersectionObserver 的可见带：
     * 可见带的做法在标题恰好滚到顶端时会一个都不亮（那一节你自己正在读，
     * 目录却停在上一节），属于反直觉。这里改成：取最后一个顶部已经越过
     * 视口上方 140px 的标题。
     */
    const LINE = 140;
    const update = (): void => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActive(headings[headings.length - 1].id);
        return;
      }
      let activeId = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= LINE) activeId = h.id;
        else break;
      }
      setActive(activeId);
    };

    let ticking = false;
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();

    // 点目录时立刻高亮，不等滚动结束
    toc.querySelectorAll<HTMLAnchorElement>('[data-toc-link]').forEach((a) =>
      a.addEventListener('click', () => setActive(decodeURIComponent(a.hash.slice(1))))
    );
  }
}

/* ── 目录拖尾：预览线身后的彩色小点 ─────────────────────────────────────
   拖动时那条 2px 的灰线太安静。这里在它身后撒 2×2 像素的彩色小点。

   点的逻辑只有一句：**生在哪就停在哪**。线一走开，点留在原地，连起来就是轨迹。
   于是越早生下的点离得越远、也越淡 —— 近密远疏；点永远落在线的反方向，
   线往右走，尾巴就甩在左边。速度越快撒得越多、尾巴伸得越长，慢拖就是一小团。

   降级：prefers-reduced-motion 时整个效果不介入，灰线照旧。 */
interface TrailDot {
  x: number;
  y: number;
  /** 已活时长（ms） */
  age: number;
  /** 总寿命（ms） */
  ttl: number;
  color: string;
}

interface Trail {
  start(x: number): void;
  move(x: number): void;
  end(): void;
}

/** 小点边长，CSS 像素 —— 用户指定的 2×2 */
const TRAIL_DOT = 2;
/** 点数量上限，狂拖时兜底 */
const TRAIL_MAX = 4200;
const TRAIL_TOKENS = ['--trail-1', '--trail-2', '--trail-3', '--trail-4', '--trail-5'] as const;

function createTrail(): Trail | null {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'toc-trail';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  /** 颜色只在 tokens.css 里定义，这里按当前主题读一次 */
  let palette: string[] = [];
  const readPalette = (): void => {
    const cs = getComputedStyle(document.documentElement);
    palette = TRAIL_TOKENS.map((name) => cs.getPropertyValue(name).trim()).filter(Boolean);
    if (!palette.length) palette = ['#ffffff'];
  };
  readPalette();

  const dots: TrailDot[] = [];
  let dpr = 1;
  let raf = 0;
  let running = false;
  let last = 0;
  /** 指针最新位置 */
  let targetX = 0;
  /** 上一帧画到的位置，用来算速度 */
  let frameX = 0;
  /** 平滑后的水平速度，px/ms */
  let vx = 0;

  const resize = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };

  /** 纵向：中间密、上下两端自然稀（两个均匀随机数相加 = 三角分布） */
  const pickY = (h: number): number => h * (0.5 + (Math.random() + Math.random() - 1) * 0.5);

  const spawn = (speed: number, dir: number, h: number): void => {
    // 拖得越快：一帧撒得越多、尾巴伸得越长；慢拖就是贴着线的一小团
    const count = Math.min(90, Math.max(5, Math.round(3 + speed * 95)));
    const reach = Math.min(170, 10 + speed * 75);
    for (let i = 0; i < count; i += 1) {
      // 幂次分布：绝大多数点挤在线上，越往后越稀 —— 这就是"由密到疏"
      const back = Math.pow(Math.random(), 2.6) * reach;
      dots.push({
        x: targetX - dir * back,
        y: pickY(h),
        age: 0,
        ttl: 130 + Math.random() * 230,
        color: palette[(Math.random() * palette.length) | 0],
      });
    }
    if (dots.length > TRAIL_MAX) dots.splice(0, dots.length - TRAIL_MAX);
  };

  const frame = (now: number): void => {
    const dt = Math.min(48, Math.max(1, now - last));
    last = now;

    const dx = targetX - frameX;
    frameX = targetX;
    vx += (dx / dt - vx) * 0.45;

    const h = window.innerHeight;
    const speed = Math.abs(vx);
    if (running && speed > 0.01) spawn(speed, vx > 0 ? 1 : -1, h);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const side = Math.max(1, Math.round(TRAIL_DOT * dpr));

    // 边画边收：寿终的点直接就地覆盖掉
    let keep = 0;
    for (let i = 0; i < dots.length; i += 1) {
      const dot = dots[i];
      dot.age += dt;
      const k = dot.age / dot.ttl;
      if (k >= 1) continue;
      dots[keep] = dot;
      keep += 1;
      ctx.globalAlpha = Math.pow(1 - k, 1.25);
      ctx.fillStyle = dot.color;
      ctx.fillRect(Math.round(dot.x * dpr), Math.round(dot.y * dpr), side, side);
    }
    dots.length = keep;
    ctx.globalAlpha = 1;

    if (!running && !dots.length) {
      raf = 0;
      canvas.remove();
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  return {
    start(x) {
      readPalette(); // 刚刚可能切过明暗
      resize();
      running = true;
      targetX = x;
      frameX = x;
      vx = 0;
      dots.length = 0;
      last = performance.now();
      document.body.append(canvas);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    move(x) {
      targetX = x;
    },
    end() {
      running = false;
    },
  };
}

/* ── 目录面板：拖左边缘改宽度 ───────────────────────────────────────────
   宽度写进 CSS 变量 --toc-w，正文区的右边距读的是同一个变量，
   所以拖动时文字会跟着重新排布，不是被面板盖住。
   范围：最宽半屏，最窄 40px（只剩一条竖排「目录」，点它就能拉回来）。 */
const tocPanel = document.querySelector<HTMLElement>('[data-toc-panel]');

if (tocPanel) {
  const grip = tocPanel.querySelector<HTMLElement>('[data-toc-grip]');
  /** 预览线的彩色拖尾；偏好减少动效时是 null，一切照旧 */
  const trail = createTrail();
  const root = document.documentElement;
  const STORE = 'bbs:toc-w';
  const MIN_W = 40;
  const COLLAPSE_BELOW = 92;
  const DEFAULT_W = 224;

  const applyWidth = (w: number, persist = false): void => {
    const max = Math.max(MIN_W, Math.round(window.innerWidth * 0.5));
    const clamped = Math.max(MIN_W, Math.min(Math.round(w), max));
    root.style.setProperty('--toc-w', `${clamped}px`);
    tocPanel.toggleAttribute('data-collapsed', clamped < COLLAPSE_BELOW);
    if (persist) {
      try {
        localStorage.setItem(STORE, String(clamped));
      } catch {
        /* 隐私模式：只在本次生效 */
      }
    }
  };

  const currentWidth = (): number => {
    const raw = getComputedStyle(root).getPropertyValue('--toc-w');
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : DEFAULT_W;
  };

  // 恢复上次拖到的宽度
  const saved = Number.parseInt(localStorage.getItem(STORE) ?? '', 10);
  if (Number.isFinite(saved) && saved > 0) applyWidth(saved);

  // 窗口变窄时把它压回半屏以内
  window.addEventListener('resize', () => applyWidth(currentWidth()), { passive: true });

  if (grip) {
    let dragging = false;
    let startX = 0;
    let startW = 0;
    let pendingW = 0;
    let preview: HTMLElement | null = null;
    /** 拖动开始时不动的那个段落，以及它在视口里的位置 */
    let anchor: Element | null = null;
    let anchorTop = 0;

    /**
     * 拖目录时**不实时重排**，只显示一条预览线，松手才应用宽度。
     *
     * 原因（录屏逐帧量出来的）：行宽一变，整篇会重新折行，70% 宽的插图也跟着
     * 放大缩小，文档总高在拖动过程中上下浮动几千像素 —— 正在读的那一段会被推走，
     * 幅度一大还会被浏览器夹到底部（看起来就是"拖一下直接跳到评论区"）。
     * 实时重排带来的手感收益，抵不上"读着读着页面跑了"的代价，所以改成松手生效。
     */
    const pickAnchor = (): void => {
      const nodes = [...document.querySelectorAll('.prose > *')];
      anchor = nodes.find((n) => n.getBoundingClientRect().bottom > 0) ?? null;
      anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;
    };

    /** 重排后把锚点段落挪回原来的视口位置（松手只重排一次，这里补偿那一次） */
    const keepAnchor = (): void => {
      if (!anchor) return;
      const delta = anchor.getBoundingClientRect().top - anchorTop;
      if (Math.abs(delta) > 0.5) {
        /**
         * 必须瞬时滚。站点全局开了 scroll-behavior: smooth（shell.css），
         * 写 window.scrollBy 会变成一段 500ms 的平滑动画；如果在每帧里调，
         * 动画会互相叠加，页面就会自己越滚越远 —— 这正是"拖目录跳走"的原因。
         */
        window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' as ScrollBehavior });
      }
    };

    const showPreview = (clientX: number): void => {
      if (!preview) {
        preview = document.createElement('div');
        preview.className = 'toc-preview';
        preview.setAttribute('aria-hidden', 'true');
        document.body.append(preview);
      }
      preview.style.left = `${Math.round(clientX)}px`;
      preview.dataset.on = '';
    };

    const hidePreview = (): void => {
      if (preview) {
        preview.remove();
        preview = null;
      }
    };

    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      // 往左拖 = 变宽
      pendingW = startW + (startX - e.clientX);
      showPreview(e.clientX);
      trail?.move(e.clientX);
    };

    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      hidePreview();
      trail?.end();
      tocPanel.removeAttribute('data-dragging');
      document.documentElement.classList.remove('is-toc-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      // 松手：一次性应用宽度，然后把正在读的那一段挪回原处
      applyWidth(pendingW || currentWidth(), true);
      requestAnimationFrame(keepAnchor);
    };

    grip.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startW = tocPanel.getBoundingClientRect().width;
      pendingW = startW;
      pickAnchor();
      tocPanel.setAttribute('data-dragging', '');
      document.documentElement.classList.add('is-toc-dragging');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      showPreview(e.clientX);
      trail?.start(e.clientX);
      // 抓取指针：拖动过程中事件始终回到手柄，不会中途丢
      try {
        grip.setPointerCapture(e.pointerId);
      } catch {
        /* 某些浏览器不支持，忽略 */
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });

    // 键盘也能调：← → 各 16px，Home 收到最窄，End 拉到半屏。
    // 和鼠标拖动一样，重排后把正在读的段落挪回原处，不要让人跳走。
    const applyAnchored = (w: number): void => {
      pickAnchor();
      applyWidth(w, true);
      keepAnchor();
    };

    grip.addEventListener('keydown', (e) => {
      const w = tocPanel.getBoundingClientRect().width;
      if (e.key === 'ArrowLeft') {
        applyAnchored(w + 16);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        applyAnchored(w - 16);
        e.preventDefault();
      } else if (e.key === 'Home') {
        applyAnchored(MIN_W);
        e.preventDefault();
      } else if (e.key === 'End') {
        applyAnchored(window.innerWidth * 0.5);
        e.preventDefault();
      }
    });
  }

  // 收起状态下点一下面板就重新拉开
  tocPanel.addEventListener('click', (e) => {
    if (!tocPanel.hasAttribute('data-collapsed')) return;
    if ((e.target as HTMLElement).closest('[data-toc-grip]')) return;
    applyWidth(DEFAULT_W, true);
  });
}

/* ── 图片灯箱 ─────────────────────────────────────────────────────────── */

const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');

if (dialog) {
  const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')!;

  document.querySelectorAll<HTMLImageElement>('.prose img').forEach((el) => {
    el.addEventListener('click', () => {
      img.src = el.currentSrc || el.src;
      img.alt = el.alt;
      dialog.showModal();
    });
  });

  const close = (): void => dialog.close();
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', close);
  dialog.querySelector('img')?.addEventListener('click', close);
}

/* ── 评论：滚到附近才注入 iframe ──────────────────────────────────────── */

const giscusHost = document.querySelector<HTMLElement>('[data-giscus]');

if (giscusHost) {
  const load = (): void => {
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    const attrs: Record<string, string | undefined> = {
      'data-repo': giscusHost.dataset.repo,
      'data-repo-id': giscusHost.dataset.repoId,
      'data-category': giscusHost.dataset.category,
      'data-category-id': giscusHost.dataset.categoryId,
      'data-mapping': 'pathname',
      'data-strict': '0',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'bottom',
      'data-theme': document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
      'data-lang': 'zh-CN',
      'data-loading': 'lazy',
    };
    for (const [key, value] of Object.entries(attrs)) {
      if (value) script.setAttribute(key, value);
    }
    giscusHost.append(script);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        load();
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(giscusHost);
  } else {
    load();
  }
}

// 显式标成模块，避免和其他脚本的顶层变量撞名（TS 会把纯脚本当全局作用域）
export {};
