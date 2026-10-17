/**
 * 搜索的客户端部分。
 *
 * 索引在构建期生成（src/pages/search-index.json.ts），只有第一次打开搜索时才请求。
 * 中文用双字切分（bigram），英文按词；两者共用同一套倒排表。
 *
 * 打分：标题命中 ×3、正文命中 ×1，另外两条直拳：
 *   整串出现在标题里 +12，出现在摘要里 +5（这两条救回了短查询与单字查询）
 */

interface Doc {
  u: string;
  t: string;
  s: string;
  d: string;
  k: string;
  n: string;
}

interface Payload {
  v: number;
  docs: Doc[];
  title: Record<string, number[]>;
  body: Record<string, number[]>;
}

interface SearchUI {
  input: HTMLInputElement;
  list: HTMLElement;
  hint: HTMLElement;
}

let payload: Payload | null = null;
let titleMap: Map<string, number[]> = new Map();
let bodyMap: Map<string, number[]> = new Map();
let ui: SearchUI | null = null;
let active = -1;
let results: Doc[] = [];

const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

/** 归一化：小写、全角转半角空格、去掉标点 */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[，。、；：！？"'“”‘’（）【】《》,.;:!?"'()[\]{}<>/\\|~`@#$%^&*+=_-]+/g, ' ')
    .trim();

/** 查询切成检索词：中文连续段 → 双字 + 单字兜底；英文 → 词前缀 */
function terms(query: string): string[] {
  const q = normalize(query);
  const out = new Set<string>();
  for (const chunk of q.split(' ')) {
    if (!chunk) continue;
    if (CJK.test(chunk)) {
      if (chunk.length === 1) out.add(chunk);
      else for (let i = 0; i < chunk.length - 1; i++) out.add(chunk.slice(i, i + 2));
    } else {
      out.add(chunk);
    }
  }
  return [...out];
}

async function ensureIndex(): Promise<void> {
  if (payload) return;
  const res = await fetch('/search-index.json');
  if (!res.ok) throw new Error('索引加载失败');
  payload = (await res.json()) as Payload;
  titleMap = new Map(Object.entries(payload.title));
  bodyMap = new Map(Object.entries(payload.body));
}

function score(query: string, ts: string[]): Map<number, number> {
  const scores = new Map<number, number>();
  const bump = (i: number, n: number): void => {
    scores.set(i, (scores.get(i) ?? 0) + n);
  };

  for (const t of ts) {
    for (const [key, ids] of titleMap) {
      if (key === t || (t.length > 1 && key.startsWith(t))) ids.forEach((i) => bump(i, 3));
    }
    for (const [key, ids] of bodyMap) {
      if (key === t) ids.forEach((i) => bump(i, 1));
      else if (!CJK.test(t) && t.length > 2 && key.startsWith(t)) ids.forEach((i) => bump(i, 1));
    }
  }

  const q = normalize(query);
  payload?.docs.forEach((d, i) => {
    const inTitle = normalize(d.t).includes(q);
    const inSum = normalize(d.s).includes(q);
    if (inTitle) bump(i, 12);
    else if (inSum) bump(i, 5);
  });

  return scores;
}

/** 把命中处包成 <mark>，其余走 textContent，绝不拼 HTML 字符串 */
function highlight(text: string, query: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const q = normalize(query);
  if (!q) {
    frag.append(text);
    return frag;
  }
  const hay = normalize(text);
  const at = hay.indexOf(q);
  if (at < 0) {
    frag.append(text);
    return frag;
  }
  // 用归一化后的位置映射回原文（只做粗略映射：跳过被折叠的标点差异）
  const before = text.slice(0, at);
  const hit = text.slice(at, at + q.length);
  const after = text.slice(at + q.length);
  frag.append(before);
  const mark = document.createElement('mark');
  mark.textContent = hit;
  frag.append(mark, after);
  return frag;
}

function renderEmpty(message: string): void {
  if (!ui) return;
  ui.list.replaceChildren();
  ui.hint.textContent = message;
}

function render(query: string): void {
  if (!ui || !payload) return;
  const q = normalize(query);

  if (!q) {
    results = [...payload.docs].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5);
    ui.hint.textContent = '最近更新';
  } else {
    const data = payload;
    const scores = score(q, terms(q));
    results = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || data.docs[b[0]].d.localeCompare(data.docs[a[0]].d))
      .slice(0, 20)
      .map(([i]) => data.docs[i]);
    if (results.length === 0) {
      // 倒排没命中时，退化成整串包含判断（单字、拼音残段都能救一下）
      results = payload.docs.filter(
        (d) => normalize(d.t).includes(q) || normalize(d.s).includes(q)
      );
    }
    ui.hint.textContent = results.length ? `${results.length} 条结果` : '没有找到。换个词试试？';
  }

  active = -1;
  ui.list.replaceChildren(
    ...results.map((d) => {
      const li = document.createElement('li');
      li.className = 'search__item';
      const a = document.createElement('a');
      a.href = d.u;
      const title = document.createElement('span');
      title.className = 'search__item-title';
      title.append(highlight(d.t, q));
      const meta = document.createElement('span');
      meta.className = 'search__item-meta';
      meta.textContent = [d.n, d.d].filter(Boolean).join(' · ');
      const sum = document.createElement('span');
      sum.className = 'search__item-meta';
      sum.append(highlight(d.s, q));
      a.append(title, meta);
      if (d.s) a.append(sum);
      li.append(a);
      return li;
    })
  );
}

function moveActive(delta: number): void {
  if (!ui) return;
  const items = [...ui.list.querySelectorAll<HTMLAnchorElement>('a')];
  if (items.length === 0) return;
  items.forEach((a) => a.removeAttribute('data-active'));
  active = (active + delta + items.length) % items.length;
  const current = items[active];
  current.setAttribute('data-active', '');
  current.scrollIntoView({ block: 'nearest' });
}

export function init(next: SearchUI): void {
  ui = next;
  let timer = 0;

  void ensureIndex()
    .then(() => {
      render('');
      ui!.input.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => render(ui!.input.value), 90);
      });
      ui!.input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveActive(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveActive(-1);
        } else if (e.key === 'Enter') {
          const items = ui!.list.querySelectorAll<HTMLAnchorElement>('a');
          const target = active >= 0 ? items[active] : items[0];
          if (target) window.location.href = target.href;
        }
      });
    })
    .catch(() => renderEmpty('索引没加载出来，可能是本地还没构建。跑一次 pnpm build 再试。'));
}
