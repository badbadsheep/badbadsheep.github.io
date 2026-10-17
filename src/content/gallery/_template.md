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
# cover: ../../assets/images/xxx.png    4:3 建议
# link: https://example.com             视频去平台、项目去仓库
---

写这件作品的来历、做法、坑。

图片与文章一样放在 `src/assets/images/`，用相对路径引用（**下面是代码块，不是真图片**）：

```markdown
![](../../assets/images/作品名-01.png)
```

