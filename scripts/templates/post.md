---
# 博客 · 写作模板（由 scripts/new.ps1 复制并替换占位符）
# 只改冒号后面的值；tags 可以留空（写成 []）。
title: __TITLE__
date: __DATE__
authors:
  - badbadsheep
tags: __TAGS__
draft: true
summary: __SUMMARY__
---

正文从这里开始。

## 小节标题

普通段落。图片放 `images/`，附件放同一文件夹，正文都用相对路径引用。
★ 示例必须放在代码块里：模板里留一个"活"的图片链接，只要那张图不存在，
  整个构建就会失败（这条规矩是原来 mkdocs --strict 时代就有的，我踩过一次）。

```markdown
![](images/你的文件名.png)

[附件.zip](./附件.zip)
```
附件（zip / 音频 / 抓包）放同一个文件夹就行，构建时会被复制到线上同一路径。文件名别带空格 —— 粘贴插件会把空格写成 %20，图片检查会报找不到。


代码块的语言标记要写小写（`c`、`js`、`powershell`），否则不会高亮。
