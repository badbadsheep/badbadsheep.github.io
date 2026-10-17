---
# 博客 · 写作模板（这个文件不会被构建：id 以下划线开头，一律跳过）
# 用法：在编辑器里复制一份，改成你的文件名，写完把 draft 改成 false。
# 命令行也行：.\scripts\new.ps1 "标题" -Section blog
title: 标题
date: 2026-10-17
authors:
  - badbadsheep
tags: []
draft: false
# summary: 不写会自动取正文首段前 120 字
---
正文从这里开始。

## 小节标题

普通段落。图片放在 `src/assets/images/`，从文章里用相对路径引用（**下面是代码块，不是真图片**）：

```markdown
![](../../assets/images/你的文件名.png)
```

代码块的语言标记要写小写（`c`、`js`、`powershell`），否则不会高亮。
