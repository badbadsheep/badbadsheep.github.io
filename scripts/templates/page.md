---
# 笔记 / 故事 · 写作模板（由 scripts/new.ps1 复制并替换占位符）
title: __TITLE__
date: __DATE__
tags: __TAGS__
draft: true
summary: __SUMMARY__
---

正文从这里开始。

## 小节标题

<aside class="callout callout--tip" data-title="提示框">

需要强调的旁白写在这里。

</aside>

<details class="qa">
<summary>折叠的问题</summary>

点开才看到的答案。

</details>

图片放 `images/`，附件放同一文件夹，正文都用相对路径引用（**下面是代码块，不是真图片**）：

```markdown
![图注](./你的文件名.png)

[附件.zip](./附件.zip)
```
附件（zip / 音频 / 抓包）放同一个文件夹就行，构建时会被复制到线上同一路径。文件名别带空格 —— 粘贴插件会把空格写成 %20，图片检查会报找不到。

代码块的语言标记要写小写（`c`、`js`、`powershell`），否则不会高亮。
