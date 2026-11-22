---
# 这是作品模板，不会被构建（id 以下划线开头，一律跳过）。
# 文件名就是网址最后一段：src/content/gallery/<slug>.md → /gallery/<slug>/
# category 只能是 painting / video / interactive / project 之一，写错构建会失败。
title: 作品名
category: painting
year: 2026
medium: 数字绘画
draft: true
summary: 一句话说明这件作品。
# cover: images/xxx.png    4:3 建议
# link: https://example.com             视频去平台、项目去仓库
---

写这件作品的来历、做法、坑。

图片放 `images/`，附件放同一文件夹，正文都用相对路径引用（**下面是代码块，不是真图片**）：

```markdown
![](images/作品名-01.png)

[附件.zip](./附件.zip)
```
附件（zip / 音频 / 抓包）放同一个文件夹就行，构建时会被复制到线上同一路径。文件名别带空格 —— 粘贴插件会把空格写成 %20，图片检查会报找不到。


