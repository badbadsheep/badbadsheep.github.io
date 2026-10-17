/**
 * 影像墙的分类筛选：原地过滤 + URL 同步（?c=painting）。
 * 没有 JS 时所有作品都显示 —— 筛选是增强，不是前提。
 */

const root = document.querySelector<HTMLElement>('[data-filter-root]');

if (root) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-value]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')];
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  let value = '';

  const apply = (next: string, push: boolean): void => {
    value = next;
    let shown = 0;
    for (const item of items) {
      const ok = !value || (item.dataset.category ?? '') === value;
      item.toggleAttribute('hidden', !ok);
      if (ok) shown++;
    }
    for (const b of buttons) {
      b.setAttribute('aria-pressed', b.dataset.filterValue === value ? 'true' : 'false');
    }
    if (empty) empty.toggleAttribute('hidden', shown !== 0);

    if (push) {
      const url = new URL(window.location.href);
      if (value) url.searchParams.set('c', value);
      else url.searchParams.delete('c');
      window.history.replaceState(null, '', url);
    }
  };

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const next = b.dataset.filterValue ?? '';
      apply(value === next ? '' : next, true);
    });
  }

  // 首屏按 URL 还原
  const initial = new URL(window.location.href).searchParams.get('c') ?? '';
  apply(initial, false);
}

// 显式标成模块，避免和其他脚本的顶层变量撞名（TS 会把纯脚本当全局作用域）
export {};
