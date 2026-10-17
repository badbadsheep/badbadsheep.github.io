import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('.', import.meta.url));

/**
 * 语言标签的人类可读名（代码块右上角那个小字）
 * key 是围栏语言标记，value 是显示名
 */
const LANG_LABELS = {
  c: 'C',
  cpp: 'C++',
  cs: 'C#',
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
  md: 'Markdown',
  markdown: 'Markdown',
  sh: 'Shell',
  bash: 'Bash',
  ps: 'PowerShell',
  ps1: 'PowerShell',
  powershell: 'PowerShell',
  py: 'Python',
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  astro: 'Astro',
  text: 'Text',
  plaintext: 'Text',
};

/** 在 <pre> 上写 data-lang，供 CSS 生成语言标签、供复制按钮判断 */
const langLabel = {
  name: 'bbs:lang-label',
  pre(node) {
    const raw = this.options.lang || '';
    const label = LANG_LABELS[raw] || raw || 'Text';
    node.properties['data-lang'] = label;
  },
};

/**
 * dev 里让中文字体子集跟着正文一起长。
 *
 * 为什么需要：子集是按「当前源码里出现的字」切出来的。你新写一个中文标题，
 * 那几个字一开始不在子集里，会回落到宋体 —— 表现就是一个标题里两种字体。
 * 以前只在构建时重建，所以 `pnpm dev` 里永远是旧子集。
 *
 * 这里做三件事：
 *   1. dev 启动时先重建一次
 *   2. 改到 src 下的 md/astro/ts 时防抖 60ms 重建
 *   3. 字集真的变了就整页刷新（配合下面的 no-store，浏览器会重新拉字体）
 */
function liveFontSubset() {
  const rebuild = () =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [path.join(PROJECT_ROOT, 'scripts/subset-fonts.mjs')],
        { cwd: PROJECT_ROOT },
        (error) => resolve(!error)
      );
    });

  const subsetSize = () => {
    try {
      return fs.statSync(path.join(PROJECT_ROOT, 'public/fonts/smiley-sans-subset.woff2')).size;
    } catch {
      return 0;
    }
  };

  const vitePlugin = {
    name: 'bbs:live-font-subset',
    apply: 'serve',
    configureServer(server) {
      let timer = null;

      const run = async (announce) => {
        const before = subsetSize();
        const ok = await rebuild();
        const after = subsetSize();
        if (!ok) {
          server.config.logger.warn('[fonts] 子集重建失败，界面会回落系统字体');
          return;
        }
        if (announce && after !== before) {
          server.config.logger.info(`[fonts] 子集已重建（${before} → ${after} 字节），刷新页面`);
          server.ws.send({ type: 'full-reload' });
        }
      };

      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => void run(true), 80);
      };

      void run(false);

      const watchable = /[\\/]src[\\/].*\.(md|astro|ts|tsx|json)$/;
      for (const event of ['change', 'add', 'unlink']) {
        server.watcher.on(event, (file) => {
          if (watchable.test(file)) schedule();
        });
      }

      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/fonts/')) {
          res.setHeader('Cache-Control', 'no-store, must-revalidate');
        }
        next();
      });
    },
  };

  return {
    name: 'bbs:live-font-subset',
    hooks: {
      'astro:config:setup'({ updateConfig }) {
        updateConfig({ vite: { plugins: [vitePlugin] } });
      },
    },
  };
}

export default defineConfig({
  site: 'https://badbadsheep.github.io',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  prefetch: { defaultStrategy: 'hover' },

  /**
   * 旧址跳新址。
   * 「URL 一旦发布不再改」是硬规矩，但内容确实会被挪栏目 ——
   * 挪的时候在这里补一条，旧链接才不会死。
   */
  redirects: {
    // 这篇从 blog 挪到了 story（2026-10-17）
    '/blogs/the-born-of-badbadblog/': '/stories/the-born-of-badbadblog/',
  },

  integrations: [
    sitemap({
      // 404 和 /proto/ 下的原型页都不进 sitemap
      // （原型页自己带 noindex，进 sitemap 等于给搜索引擎递矛盾信号）
      filter: (page) => !page.includes('/404') && !page.includes('/proto/'),
    }),
    liveFontSubset(),
  ],

  markdown: {
    // 双主题：dark-plus / light-plus 就是 VSCode 官方配色
    shikiConfig: {
      themes: { dark: 'dark-plus', light: 'light-plus' },
      wrap: false,
      transformers: [langLabel],
    },
  },
});
