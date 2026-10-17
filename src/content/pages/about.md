---
title: 关于
desc: 这个站是什么，以及它是怎么被拼出来的
---

## 关于此站

一个用 Markdown 写作、用 Git 管理、托管在 GitHub Pages 上的个人博客。

2026 年 10 月建站，最初是 MkDocs + Material；后来嫌它太像文档，重写成了纯 Astro。

## 技术组成

| 组成 | 选型 | 说明 |
| --- | --- | --- |
| 静态站点生成 | Astro | 内容集合 + 构建期校验，全站零框架运行时 |
| 样式 | 原生 CSS + 设计令牌 | 黑白几何的门面，安静的阅读区 |
| 门面动效 | WebGL2 + CSS | 手写着色器，不引 3D 库 |
| 搜索 | 自建倒排索引 | 中英文都能搜，索引只在打开搜索时加载 |
| 评论 | giscus | 存在 GitHub Discussions 里 |
| 部署 | GitHub Pages | 由 GitHub Actions 自动构建发布 |
| 订阅 | RSS | 构建时生成，支持任意阅读器 |

## 版权

除特别注明外，本站文章采用
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)
许可协议，转载请注明出处。

文章未经授权请勿转载。
