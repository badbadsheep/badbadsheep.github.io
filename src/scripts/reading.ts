/**
 * 阅读区的渐进增强：代码块工具条、目录高亮、图片灯箱、评论懒加载。
 * 没有它页面照样能读 —— 只是少了复制按钮和灯箱。
 */

/* ── 代码块：包一条顶栏（语言 + 复制） ─────────────────────────────────── */

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
    const done = document.execCommand('copy');
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

/* ── 目录面板：拖左边缘改宽度 ───────────────────────────────────────────
   宽度写进 CSS 变量 --toc-w，正文区的右边距读的是同一个变量，
   所以拖动时文字会跟着重新排布，不是被面板盖住。
   范围：最宽半屏，最窄 40px（只剩一条竖排「目录」，点它就能拉回来）。 */
const tocPanel = document.querySelector<HTMLElement>('[data-toc-panel]');

if (tocPanel) {
  const grip = tocPanel.querySelector<HTMLElement>('[data-toc-grip]');
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

    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      // 往左拖 = 变宽
      applyWidth(startW + (startX - e.clientX));
    };

    const onUp = (): void => {
      if (!dragging) return;
      dragging = false;
      tocPanel.removeAttribute('data-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      applyWidth(currentWidth(), true);
    };

    grip.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startW = tocPanel.getBoundingClientRect().width;
      tocPanel.setAttribute('data-dragging', '');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });

    // 键盘也能调：← → 各 16px，Home 收到最窄，End 拉到半屏
    grip.addEventListener('keydown', (e) => {
      const w = tocPanel.getBoundingClientRect().width;
      if (e.key === 'ArrowLeft') {
        applyWidth(w + 16, true);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        applyWidth(w - 16, true);
        e.preventDefault();
      } else if (e.key === 'Home') {
        applyWidth(MIN_W, true);
        e.preventDefault();
      } else if (e.key === 'End') {
        applyWidth(window.innerWidth * 0.5, true);
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
      'data-strict': '1',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
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
