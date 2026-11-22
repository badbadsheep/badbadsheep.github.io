---
# 博客 · 写作模板（这个文件不会被构建：id 以下划线开头，一律跳过）
# 用法：整个文件夹复制一份改名，改 front matter，写完把 draft 改成 false。
# 命令行也行：.\scripts\new.ps1 "标题" -Section blog
title: 标题
date: 2026-10-17
authors:
  - badbadsheep
tags: []
draft: true
# summary: 不写会自动取正文首段前 120 字
---

正文从这里开始。

## 小节标题

普通段落。图片放 `images/`，附件放同一文件夹，正文都用相对路径引用（**下面是代码块，不是真图片**）：

```markdown
![](images/你的文件名.png)

[附件.zip](./附件.zip)
```
附件（zip / 音频 / 抓包）放同一个文件夹就行，构建时会被复制到线上同一路径。文件名别带空格 —— 粘贴插件会把空格写成 %20，图片检查会报找不到。


代码块的语言标记要写小写（`c`、`js`、`powershell`），否则不会高亮。
