---
title: 致谢
desc: 这个站用到的东西，以及它们各自的来处
---

这个站的大部分活不是我干的。字体、框架、代码高亮、评论区，都是别人写好免费放出来的。把来处写清楚，是最起码的礼数。

## 字体

| 字体 | 用途 | 授权 |
| --- | --- | --- |
| [Instrument Serif](https://github.com/Instrument/instrument-serif) | 拉丁文大字、站名、英文标题 | SIL Open Font License 1.1 |
| [得意黑 Smiley Sans](https://github.com/atelier-anchor/smiley-sans) | 界面上的中文标题（仅子集） | SIL Open Font License 1.1 |

两种字体都放在 `public/fonts/` 里，随本站一起分发。我没有改动字形，只做了子集化：把用不到的字切掉，文件从 1.9 MB 降到 50 KB 上下。许可全文和字体文件放在同一目录。

正文不使用网络字体。中文全量字体动辄十几 MB，为几个标题去下载它并不划算。正文一律用系统字体，读起来也不违和。

## 技术

- [Astro](https://astro.build/)：静态站点框架，MIT 许可
- [Shiki](https://shiki.style/)：代码高亮，配色取自 VSCode 官方的 Dark+ 和 Light+
- [giscus](https://giscus.app/)：用 GitHub Discussions 做评论区

## 图像

站内插图和头像都是我自己做的。文章里如果用了别人的图，会在正文注明。

## 关于旧站

2026 年 10 月的第一版建在 MkDocs + Material 上。这次重写保住了全部 URL 和正文，只换了外壳。所以从旧链接进来，地址应该还是一样。
