/**
 * 全站外壳的行为：明暗切换、导航显示、栏目抽屉、搜索层。
 * 一个入口，所有页面共用。约 2KB gzip。
 */

const THEME_KEY = 'bbs:theme';
const root = document.documentElement;

/* ── 明暗 ─────────────────────────────────────────────────────────────── */

type Theme = 'dark' | 'light';

const readPref = (): Theme | 'auto' => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
};

const resolved = (): Theme => {
  const p = readPref();
  if (p !== 'auto') return p;
  // 默认深色，不跟随系统：跟着系统走的话，浅色系统的访客永远看不到这个站本来的样子
  return 'dark';
};

const syncButtons = (theme: Theme): void => {
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    btn.setAttribute('title', theme === 'light' ? '切到深色' : '切到浅色');
  });
};

const applyTheme = (): void => {
  const theme = resolved();
  root.setAttribute('data-theme', theme);
  syncButtons(theme);
  // giscus 若已加载，让它跟着换色
  document.querySelectorAll<HTMLIFrameElement>('iframe.giscus-frame').forEach((f) => {
    f.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
  });
};

const setTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 隐私模式：只影响本次 */
  }
  applyTheme();
};

document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => setTheme(resolved() === 'dark' ? 'light' : 'dark'));
});

applyTheme();

/* ── 焦点工具 ─────────────────────────────────────────────────────────── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const trapFocus = (container: HTMLElement): ((e: KeyboardEvent) => void) => {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const nodes = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
};

/* ── 导航显示 ─────────────────────────────────────────────────────────────
   首页：第一屏全程隐身，滚过它之后常驻。
   其余页面：常驻。
   （SPEC 里写过"上滑隐藏/下滑出现"，实测那样太跳，先常驻；要改就是这个函数。） */

const nav = document.querySelector<HTMLElement>('[data-nav]');

if (nav) {
  const hero = document.querySelector<HTMLElement>('.hero');
  if (hero) {
    const update = (): void => {
      const past = window.scrollY > hero.offsetHeight * 0.85;
      nav.toggleAttribute('data-hidden', !past);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  } else {
    nav.removeAttribute('data-hidden');
  }
}

/* 抽屉或搜索层打开时，导航簇要让位 —— 否则它会从半透明遮罩后面亮着 */
const setOverlay = (open: boolean): void => {
  document.body.toggleAttribute('data-overlay', open);
};

/* ── 栏目抽屉 ─────────────────────────────────────────────────────────── */

const drawer = document.querySelector<HTMLElement>('[data-drawer]');

if (drawer) {
  const panel = drawer.querySelector<HTMLElement>('.drawer__panel')!;
  const toggles = [...document.querySelectorAll<HTMLElement>('[data-drawer-toggle]')];
  let lastFocus: HTMLElement | null = null;
  let offTrap: ((e: KeyboardEvent) => void) | null = null;

  const openDrawer = (): void => {
    lastFocus = document.activeElement as HTMLElement;
    drawer.hidden = false;
    setOverlay(true);
    requestAnimationFrame(() => drawer.setAttribute('data-open', ''));
    toggles.forEach((t) => t.setAttribute('aria-expanded', 'true'));
    root.style.overflow = 'hidden';
    offTrap = trapFocus(panel);
    document.addEventListener('keydown', offTrap);
    document.addEventListener('keydown', onKey);
    panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  };

  const closeDrawer = (): void => {
    drawer.removeAttribute('data-open');
    setOverlay(false);
    toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    root.style.overflow = '';
    const done = (): void => {
      drawer.hidden = true;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else window.setTimeout(done, 220);
    if (offTrap) {
      document.removeEventListener('keydown', offTrap);
      offTrap = null;
    }
    document.removeEventListener('keydown', onKey);
    lastFocus?.focus();
  };

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeDrawer();
    }
  }

  toggles.forEach((t) =>
    t.addEventListener('click', () => {
      if (drawer.hasAttribute('data-open')) closeDrawer();
      else openDrawer();
    })
  );

  drawer.querySelectorAll<HTMLElement>('[data-drawer-close]').forEach((b) =>
    b.addEventListener('click', closeDrawer)
  );

  // 点栏目链接后收起，跳转照常发生
  drawer.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) =>
    a.addEventListener('click', () => {
      closeDrawer();
    })
  );
}

/* ── 搜索层 ─────────────────────────────────────────────────────────────
   索引是懒加载的：第一次打开搜索才去拿 /search-index.json。 */

const overlay = document.querySelector<HTMLElement>('[data-search]');
let searchOpen = false;

if (overlay) {
  const input = overlay.querySelector<HTMLInputElement>('[data-search-input]')!;
  const list = overlay.querySelector<HTMLElement>('[data-search-list]')!;
  const hint = overlay.querySelector<HTMLElement>('[data-search-hint]')!;
  const closers = overlay.querySelectorAll<HTMLElement>('[data-search-close]');
  let lastFocus: HTMLElement | null = null;
  let offTrap: ((e: KeyboardEvent) => void) | null = null;
  let mod: typeof import('./search') | null = null;

  const ensureSearch = async (): Promise<void> => {
    if (mod) return;
    hint.textContent = '正在准备索引…';
    mod = await import('./search');
    mod.init({ input, list, hint });
  };

  const openSearch = async (): Promise<void> => {
    if (searchOpen) return;
    searchOpen = true;
    lastFocus = document.activeElement as HTMLElement;
    overlay.hidden = false;
    setOverlay(true);
    requestAnimationFrame(() => overlay.setAttribute('data-open', ''));
    offTrap = trapFocus(overlay);
    document.addEventListener('keydown', offTrap);
    root.style.overflow = 'hidden';
    await ensureSearch();
    input.focus();
    input.select();
  };

  const closeSearch = (): void => {
    if (!searchOpen) return;
    searchOpen = false;
    overlay.removeAttribute('data-open');
    overlay.hidden = true;
    setOverlay(false);
    if (offTrap) {
      document.removeEventListener('keydown', offTrap);
      offTrap = null;
    }
    root.style.overflow = '';
    lastFocus?.focus();
  };

  document.querySelectorAll<HTMLElement>('[data-search-open]').forEach((b) =>
    b.addEventListener('click', () => void openSearch())
  );
  closers.forEach((b) => b.addEventListener('click', closeSearch));

  document.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K';
    if ((e.metaKey || e.ctrlKey) && isK) {
      e.preventDefault();
      if (searchOpen) closeSearch();
      else void openSearch();
    }
    if (e.key === 'Escape' && searchOpen) closeSearch();
    // 输入时会话里的 "/" 也可以唤起，但在输入框里时不抢
    const tag = (e.target as HTMLElement)?.tagName;
    if (e.key === '/' && !searchOpen && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      void openSearch();
    }
  });
}

// 显式标成模块，避免和其他脚本的顶层变量撞名（TS 会把纯脚本当全局作用域）
export {};
