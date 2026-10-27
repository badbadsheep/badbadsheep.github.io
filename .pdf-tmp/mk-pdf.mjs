/**
 * 起只读静态服务 → 用 Chrome 的打印管线把 post.html 打成 PDF。
 * 走 CDP 是为了：打印前等字体/图片就绪、把 GIF 冻结到首帧、
 * 并给「比一页还高的代码块」放行跨页。
 */
import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve('G:/badbadblog');
const TMP = path.join(ROOT, '.pdf-tmp');
const PORT = 8731;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PDF_OUT = path.join(ROOT, '2026-WHUCTF-wp.pdf');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const abs = path.join(ROOT, url);
    if (!abs.startsWith(ROOT)) {
      res.writeHead(403).end('no');
      return;
    }
    const buf = await fsp.readFile(abs);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
    });
    res.end(buf);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--remote-debugging-port=9344',
    `--user-data-dir=${path.join(TMP, 'chrome-profile')}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

let wsUrl;
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch('http://127.0.0.1:9344/json/version');
    wsUrl = (await r.json()).webSocketDebuggerUrl;
    if (wsUrl) break;
  } catch {
    await sleep(200);
  }
}
if (!wsUrl) throw new Error('Chrome 没起来');

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });

await send('Page.enable', {}, S);
await send('Runtime.enable', {}, S);
await send(
  'Emulation.setDeviceMetricsOverride',
  { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false },
  S
);
await send('Emulation.setEmulatedMedia', { media: 'print' }, S);

const nav = await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/.pdf-tmp/post.html` }, S);
if (nav.errorText) throw new Error('导航失败: ' + nav.errorText);

for (let i = 0; i < 200; i++) {
  const st = await send(
    'Runtime.evaluate',
    {
      expression: "document.readyState + '|' + (document.querySelector('.prose') ? 'ok' : 'wait')",
      returnByValue: true,
    },
    S
  );
  if (String(st.result.value) === 'complete|ok') break;
  await sleep(100);
}

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
};

/* 等字体与图片就绪；顺便把 GIF 冻结到第一帧 */
const imgCount = await evaluate(`(async () => {
  await document.fonts.ready;
  const waitImgs = () => Promise.all([...document.images].map(img => (img.complete && img.naturalWidth) ? 1 : new Promise(r => { img.onload = img.onerror = () => r(1); })));
  await waitImgs();
  for (const img of [...document.querySelectorAll('img')]) {
    if (!/\\.gif(\\?|$)/i.test(img.currentSrc || img.src)) continue;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const out = new Image();
    out.src = c.toDataURL('image/png');
    out.alt = img.alt;
    out.className = img.className;
    out.style.cssText = img.style.cssText;
    img.replaceWith(out);
    await new Promise(r => { out.onload = r; out.onerror = r; });
  }
  await document.fonts.ready;
  await waitImgs();
  return document.images.length;
})()`);

const report = await evaluate(`(() => {
  const contentW = document.querySelector('.prose').clientWidth;
  const pageH = 265 * 96 / 25.4;
  const long = [];
  document.querySelectorAll('.code').forEach((el, i) => {
    const h = el.getBoundingClientRect().height;
    if (h > pageH * 0.92) { el.classList.add('is-long'); long.push(i + ':' + Math.round(h / 96 * 25.4) + 'mm'); }
  });
  document.querySelectorAll('.prose p').forEach(p => {
    if (p.querySelector('img.strip')) p.classList.add('strip-group');
  });
  const broken = [...document.images].filter(i => !i.naturalWidth).map(i => i.src);
  const single = [...document.images]
    .filter(i => !i.classList.contains('strip') && !i.closest('.figures'))
    .map(i => Math.round(i.getBoundingClientRect().width / contentW * 100));
  const meta = document.querySelector('.cover__meta');
  return {
    imgs: document.images.length,
    long,
    broken,
    singleW: [...new Set(single)].sort((a, b) => a - b),
    metaFont: meta ? getComputedStyle(meta).fontSize : 'none',
    foot: document.querySelector('.cover__foot') ? 'still there' : 'removed',
    height: Math.round(document.body.scrollHeight / 96 * 25.4) + 'mm',
  };
})()`);
console.log(`[page] 图片 ${report.imgs} 张就绪 | 缺图: ${report.broken.length ? report.broken.join(',') : '无'}`);
console.log(`[layout] 单图宽度%: ${report.singleW.join(',')} | 长代码块放行跨页: ${report.long.length ? report.long.join(',') : '无'}`);
console.log(`[layout] 封面落款: ${report.foot} | 日期作者字号: ${report.metaFont} | 总高: ${report.height}`);

const { data } = await send(
  'Page.printToPDF',
  { displayHeaderFooter: false, printBackground: true, preferCSSPageSize: true, scale: 1, transferMode: 'ReturnAsBase64' },
  S
);

const buf = Buffer.from(data, 'base64');
const tmpOut = path.join(TMP, 'out.pdf');
await fsp.writeFile(tmpOut, buf);

let finalPath = PDF_OUT;
try {
  await fsp.copyFile(tmpOut, PDF_OUT);
} catch (err) {
  finalPath = path.join(ROOT, '2026-WHUCTF-wp-new.pdf');
  await fsp.copyFile(tmpOut, finalPath);
  console.log(`[warn] ${path.basename(PDF_OUT)} 被占用（${err.code}），改写到 ${path.basename(finalPath)}`);
}

const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`[pdf] ${finalPath}  ${(buf.length / 1024).toFixed(0)} KB  ${pages} 页`);

ws.close();
chrome.kill();
server.close();
