/* ═══════════════════════════════════════════════════════════════════
   站点前端增强（无依赖，随 Material 的 document$ 事件重入）
   1. 右侧目录阅读进度条
   2. giscus 评论区跟随明暗模式换肤
   3. 站外链接自动新窗口打开
   4. 侧栏层级标题栏里补一个「返回首页」按钮
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var DARK_SCHEME = "slate";

  function isDarkMode() {
    return document.body.getAttribute("data-md-color-scheme") === DARK_SCHEME;
  }

  /* ── 1. 阅读进度条 ─────────────────────────────────────────────── */
  function updateReadingProgress() {
    var sidebar = document.querySelector(".md-sidebar--secondary");
    if (!sidebar) return;

    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    ratio = Math.min(1, Math.max(0, ratio));
    sidebar.style.setProperty("--scroll-progress", (ratio * 100).toFixed(2) + "%");
  }

  /* ── 2. giscus 换肤 ───────────────────────────────────────────── */
  function syncGiscusTheme() {
    var host = document.querySelector(".giscus[data-giscus-theme-light]");
    if (!host) return;

    var theme = isDarkMode()
      ? host.getAttribute("data-giscus-theme-dark")
      : host.getAttribute("data-giscus-theme-light");
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !theme) return;

    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: theme } } },
      "https://giscus.app"
    );
  }

  /* ── 3. 站外链接新窗口打开 ────────────────────────────────────── */
  function externalizeLinks() {
    var host = window.location.hostname;
    document.querySelectorAll(".md-content a[href^='http']").forEach(function (link) {
      if (link.hostname && link.hostname !== host && !link.target) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  /* ── 4. 层级标题栏里的「返回首页」按钮 ────────────────────────── */
  /*  抽屉展开某个栏目后，顶部标题会被换成栏目名（比如「博客」），
      此时没有明显的回首页入口，这里补一个胶囊按钮。 */
  function addHomeLinks() {
    var logo = document.querySelector(
      '.md-nav--primary .md-nav__title[for="__drawer"] a.md-logo'
    );
    if (!logo) return;
    var home = logo.getAttribute("href");
    if (!home) return;

    document
      .querySelectorAll('.md-nav--primary label.md-nav__title[for^="__nav_"]')
      .forEach(function (title) {
        if (title.querySelector(".md-nav__home")) return;
        var link = document.createElement("a");
        link.className = "md-nav__home";
        link.href = home;
        link.textContent = "返回首页";
        title.appendChild(link);
      });
  }

  function onReady() {
    updateReadingProgress();
    syncGiscusTheme();
    externalizeLinks();
    addHomeLinks();
  }

  /* Material 用 RxJS 暴露 document$，每次（含 instant 导航）渲染后触发 */
  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(onReady);
  } else if (document.readyState !== "loading") {
    onReady();
  } else {
    document.addEventListener("DOMContentLoaded", onReady);
  }

  window.addEventListener("scroll", updateReadingProgress, { passive: true });
  window.addEventListener("resize", updateReadingProgress, { passive: true });

  /* 明暗切换时同步 giscus（Material 会在 body 上更新 data-md-color-scheme） */
  var observer = new MutationObserver(syncGiscusTheme);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"]
  });
})();
