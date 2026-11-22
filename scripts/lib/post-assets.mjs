/**
 * 每篇文章一个文件夹 —— 让 md 旁边的**非图片**文件也能被发布。
 *
 * 为什么需要这个集成：
 *   Astro 的 markdown 只把 `![](...)` 指向的图片送进资产管线（于是拿到
 *   `_astro/xxx.hash.png` 和自动 WebP）。而 `[附件.zip](./附件.zip)` 这种
 *   普通链接会被**原样**写进 HTML，dist 里却没有那个文件 —— 上线就是 404，
 *   本地 `pnpm build && pnpm links` 也会直接报死链。
 *
 * 为什么用复制而不是 `?url` 导入：
 *   纯 markdown 里写不了 import；能写 import 的是 MDX，为几个附件把全站
 *   换成 MDX 不值。复制一步到位，正文里 `./附件.zip` 的写法不用动。
 *
 * 目标目录不靠“猜路由”：
 *   `build.format: 'directory'` 下，文章页固定在 `<section.url><slug>/index.html`，
 *   浏览器解析 `./附件.zip` 就落到 `<section.url><slug>/附件.zip`。
 *   所以只要把文件复制到 `dist<那个目录>` 即可。slug 用 Astro 同一套规则算
 *   （逐段 slug 化 + 去掉结尾的 /index），并且**用真实构建出来的页面反查校验**，
 *   对不上就 warn 并跳过，绝不悄悄放错地方。
 *
 * dev：
 *   dev 下 dist 还不存在，用中间件直接从源码目录应答同一批 URL。
 *   （不这样本地点了是 404，虽然不影响构建，但写作时很困惑。）
 */
import { readdir, mkdir, copyFile, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 图片走 Astro 资产管线，这里不重复复制（复制了也是死重量） */
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg']);

/** 系统垃圾文件 */
const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** 够用的类型表。命中不了的按二进制下载，浏览器行为也正常 */
const MIME = {
  // 图片正常不该走到这里（由资产管线接管），但 dev 下直接请求源码文件名时
  // 给对类型总比 application/octet-stream 好
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.pcap': 'application/vnd.tcpdump.pcap',
  '.pcapng': 'application/vnd.tcpdump.pcap',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.c': 'text/plain; charset=utf-8',
  '.hash': 'text/plain; charset=utf-8',
};

const isImage = (file) => IMAGE_EXT.has(path.extname(file).toLowerCase());
const posix = (p) => p.split(path.sep).join('/');

/**
 * 逐段 slug 化，和 Astro 的 getContentEntryIdAndSlug 保持一致的做法：
 * 每段做 slug，最后去掉结尾的 /index。
 * 目录名约定是纯 ASCII 小写，所以这里只做小写 + 去首尾空白；
 * 真实场景（大写目录名、非 ASCII）由调用方的“反查构建页面”兜底。
 */
function toSlug(relativePath) {
  const withoutExt = relativePath.replace(/\.(md|mdx|markdown)$/i, '');
  const segments = withoutExt.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (segments[segments.length - 1] === 'index') segments.pop();
  return segments.join('/');
}

/**
 * 扫一个内容集合目录，列出所有文章条目。
 * 第一条路径段以 `_` 开头的是模板（content.ts 里也是这么滤的），不参与。
 *
 * @returns {Promise<{slug: string, folder: string, file: string}[]>}
 */
async function listEntries(contentRoot, dir) {
  const base = path.join(contentRoot, dir);
  if (!existsSync(base)) return [];
  const out = [];

  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!/\.(md|mdx|markdown)$/i.test(entry.name)) continue;

      const relative = posix(path.relative(base, full));
      if (relative.split('/')[0].startsWith('_')) continue;

      out.push({ slug: toSlug(relative), folder: path.dirname(full), file: full });
    }
  }

  await walk(base);
  return out;
}

/** 文章文件夹里的附属文件（递归，保留子目录结构），不含 md / 图片 / 垃圾文件 */
async function listAttachments(folder) {
  const out = [];

  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (SKIP_NAMES.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (/\.(md|mdx|markdown)$/i.test(entry.name)) continue;
      if (isImage(entry.name)) continue;
      out.push({ abs: full, rel: posix(path.relative(folder, full)) });
    }
  }

  await walk(folder);
  return out;
}

/**
 * @param {object} options
 * @param {{key: string, url: string, dir: string}[]} options.sections data/sections.ts 里的 SECTIONS
 * @param {string} [options.contentRoot] 默认 src/content
 */
export function postAssets({ sections, contentRoot = 'src/content' } = {}) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('[post-assets] 需要传入 sections（来自 src/data/sections.ts 的 SECTIONS）');
  }

  let root; // 项目根目录，两个 hook 里都要用

  return {
    name: 'bbs:post-assets',
    hooks: {
      'astro:config:done'({ config }) {
        root = fileURLToPath(config.root);
      },

      /* ── 构建：把附件复制到文章页所在目录 ─────────────────────────── */
      async 'astro:build:done'({ dir, pages, logger }) {
        const dist = fileURLToPath(dir);
        // 真实构建出来的页面，用来反查 slug 是否算对（大小写/编码差异都吃掉）。
        // 注意 pages 里的 pathname 是**不带前导斜杠**的目录式路径（`blogs/x/`），
        // 既不是 `/blogs/x/` 也不是 `/blogs/x/index.html`，统一归一化后再比。
        const pageKey = (pathname) =>
          '/' + decodeURIComponent(pathname).replace(/^\/+/, '').toLowerCase();
        const built = new Set(pages.map((p) => pageKey(p.pathname)));

        let files = 0;
        let bytes = 0;
        const missed = [];

        for (const section of sections) {
          const entries = await listEntries(path.join(root, contentRoot), section.dir);
          for (const entry of entries) {
            const target = `${section.url}${entry.slug}/`;
            if (!built.has(pageKey(target))) {
              // 草稿（draft: true）在构建里没有页面，自然也就没有可复制的目标目录
              missed.push(`${section.key}/${entry.slug}`);
              continue;
            }

            const attachments = await listAttachments(entry.folder);
            if (attachments.length === 0) continue;

            const destDir = path.join(dist, target);
            await mkdir(destDir, { recursive: true });
            for (const file of attachments) {
              const to = path.join(destDir, file.rel);
              await mkdir(path.dirname(to), { recursive: true });
              await copyFile(file.abs, to);
              files++;
              bytes += (await stat(file.abs)).size;
            }
          }
        }

        if (files > 0) {
          const mb = (bytes / 1024 / 1024).toFixed(1);
          logger.info(`复制文章附件 ${files} 个（${mb} MB）到页面目录`);
        }
        if (missed.length > 0) {
          // 草稿是正常情况，所以只说一次、不刷屏
          logger.info(`跳过 ${missed.length} 个没有构建页面的条目（草稿或模板）`);
        }
      },

      /* ── dev：同一批 URL 直接从源码目录应答 ───────────────────────── */
      'astro:server:setup'({ server, logger }) {
        const contentRoot = path.join(root, 'src/content');

        server.middlewares.use(async (req, res, next) => {
          const url = req.url;
          if (!url) return next();

          let pathname;
          try {
            pathname = decodeURIComponent(url.split('?')[0]);
          } catch {
            return next();
          }

          const section = sections.find((s) => pathname.startsWith(s.url));
          if (!section) return next();

          const rest = pathname.slice(section.url.length);
          if (!rest || rest.endsWith('/')) return next(); // 页面请求，不是附件

          // 每次请求重扫：dev 下随时会新建文章，缓存反而添乱（就几篇文章）
          for (const entry of await listEntries(contentRoot, section.dir)) {
            const prefix = `${entry.slug}/`;
            if (!rest.toLowerCase().startsWith(prefix.toLowerCase())) continue;

            const rel = rest.slice(prefix.length);
            const file = path.join(entry.folder, ...rel.split('/'));
            if (!file.startsWith(entry.folder) || !existsSync(file)) continue;
            if ((await stat(file)).isDirectory()) continue;

            const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
            res.setHeader('Content-Type', type);
            res.setHeader('Content-Length', String((await stat(file)).size));
            res.end(await readFile(file));
            return;
          }

          next();
        });

        logger.info('文章附件：dev 下从源码目录直出（与 build 结果一致）');
      },
    },
  };
}
