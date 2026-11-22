---
# 影像 · 作品模板（由 scripts/new.ps1 复制并替换占位符）
# 文件名就是网址最后一段：ink-study-01.md → /gallery/ink-study-01/
# category 只能是 painting / video / interactive / project，写错构建会失败。
title: __TITLE__
category: __CATEGORY__
year: __YEAR__
medium: __MEDIUM__
draft: true
summary: __SUMMARY__
# link: __LINK__
---

写这件作品的来历、做法、踩的坑。

★ 示例必须放在代码块里：模板里留一个"活"的图片链接，只要那张图不存在，
  整个构建就会失败。

```markdown
![](images/作品名-01.png)

[附件.zip](./附件.zip)
```
附件（zip / 音频 / 抓包）放同一个文件夹就行，构建时会被复制到线上同一路径。文件名别带空格 —— 粘贴插件会把空格写成 %20，图片检查会报找不到。

