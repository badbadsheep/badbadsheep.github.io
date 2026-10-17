# badbadsheep · 纯 Astro 重构规格书

**版本** v1.0 · **日期** 2026-10-17 · **状态** 待你审阅（第 21、22 节是重点）

> 这份文档要你做的事只有一件：**把你不想要的东西划掉。**
> 第 21 节是等你补的两张图，第 22 节是我替你做的默认决定（可以一票否决），
> 其余章节是我按你的选择推出来的实现方案，看不懂的部分直接说"这段我不懂"，我重写成人话。

---

## 0. 读法

| 你想知道 | 看第几节 |
|---|---|
| 为什么这样选型 | 1、3、14 |
| 目录长什么样 | 4 |
| 我以后怎么写文章 | 5、19 |
| 每个页面长什么样、有什么交互 | 7、9 |
| 搜索/评论/代码块怎么工作 | 10、11、12 |
| 手机和老电脑会不会卡 | 15、16 |
| 什么算"做完了" | 20 |
| 还需要你提供什么 | 21 |

---

## 1. 决策记录

每条都标明是谁定的，避免以后翻账。

| # | 决策 | 来源 |
|---|---|---|
| 1 | 静态站，Astro 7.4.0，工程放 `G:\badbadblog` 根 | 你 |
| 2 | 砍掉 MkDocs，单引擎 | 交办包 README + 你 |
| 3 | 双层人格：首页长屏，第一页有彩色交互动画，之后都为有视觉冲击力的黑白几何构成 / 阅读区安静秩序 | 你 |
| 4 | 首页 = 第一屏全屏炫技 + 四栏目屏 + 页脚联系方式 | 你 |
| 5 | 第一屏 `scroll-snap` 吸附，之后自由滚动 | 你 |
| 6 | 第一屏之后右上角常驻：三道杠 / 明暗 / 归档 / 搜索 | 你（参考 blog.crisq.top） |
| 7 | 门面锁黑；文章页默认黑、可切白；偏好全站共享 | 你 |
| 8 | 字体：Instrument Serif（拉丁）+ 得意黑（中文签名字） | 你 |
| 9 | 代码块彩色、VSCode 配色、注释要够亮 | 你 |
| 10 | 代码行号 + 语言标签 + 复制按钮 | 你 |
| 11 | 全文搜索，中英文，自建 bigram 索引，无第三方库 | 你 |
| 12 | 评论用 giscus，只在 blog / notes / stories 底部 | 你 |
| 13 | 文章页需要 TOC / 上下篇 / 元信息条 / 图片灯箱 | 你 |
| 14 | 落地页：流水栏目用列表，影像用气泡墙 | 你 |
| 15 | 首屏图形：WebGL2 做粒子与形变，CSS 做装饰层；**不用 three.js** | 你 + 我实测（134KB 归因） |
| 16 | 每屏 5–6 条，See More 静止在右下角 | 你 |
| 17 | 性能预算 150KB，只量首屏，懒加载不算 | 你 |
| 18 | 工具链：new.ps1 + 写作手册 + /credits/ + 先备着的 CI | 你 |
| 19 | 内容一次性洗成标准 Markdown，之后只写标准语法 | 你 |
| 20 | 先本地跑通，部署最后再切 | 你 |

**没有被我替你决定的**：第一屏动效、气泡框形态、手机端降级强度。见第 21 节。

---

## 2. 不变契约（迁移期间一个字都不能改）

来自 `NAMING.md`，这是硬约束。

### 2.1 站点身份

| 项 | 值 |
|---|---|
| 站点名 | `badbadsheep`（顶部大字、`<title>`、OG `site_name`、页脚） |
| 署名 | `badbadsheep`（front matter `authors`、RSS、JSON-LD） |
| 一句话 | `Welcome to my world` |
| 邮箱 | `3360421858@qq.com` |
| GitHub | `badbadsheep` |
| 头像 | `/assets/avatar.png` → 迁移后 `/avatars/avatar.png`（见 13） |
| 标识 | `/assets/logo.png` → `/logo.png` |
| 域名 | `https://badbadsheep.github.io/`（CNAME 通道留着，本次不配） |

### 2.2 四栏目

| 键 | 中文 | URL | 形态 | 时间流 | 归档 |
|---|---|---|---|---|---|
| `blog` | 博客 | `/blogs/` | 流水 | 是 | 是 |
| `note` | 笔记 | `/notes/` | 流水 | 是 | 是 |
| `story` | 故事 | `/stories/` | 流水 | 是 | 是 |
| `gallery` | 影像 | `/gallery/` | 合集 | **否** | **否** |

### 2.3 四分类（仅 gallery）

`painting` 绘画 / `video` 视频 / `interactive` 交互 / `project` 项目 —— front matter 写错在构建期失败。

### 2.4 URL 规则（**一个都不许动**）

| 内容 | URL | 示例 |
|---|---|---|
| 博客 | `/blogs/<slug>/` | `/blogs/the-born-of-badbadblog/` |
| 笔记 | `/notes/<slug>/` | `/notes/dev-setup/` |
| 故事 | `/stories/<slug>/` | — |
| 作品 | `/gallery/<slug>/` | — |
| 主题 | `/topics/<slug>/` | `/topics/mkdocs/` |
| 归档 | `/archive/` | |
| 关于 | `/about/` | |
| 新增：致谢 | `/credits/` | 本次新增，不影响旧链 |
| 订阅 | `/feed_rss_created.xml` | 文件名沿用，订阅者不换链 |

`slug` = 文件名（ASCII 小写连字符）。front matter 里若写了 `slug`，必须与文件名一致，否则**构建期报错**（防断链）。

### 2.5 四条铁律

1. URL 一旦发布不再改
2. 一个内容只属于一个栏目
3. 界面中文、URL 英文
4. 主题靠 `tags`，归属靠目录；`categories:` 字段废弃并删除

---

## 3. 技术栈

| 层 | 选择 | 说明 |
|---|---|---|
| 框架 | Astro `7.4.0`（静态，`output: 'static'`） | 无 adapter、无 SSR |
| 样式 | 原生 CSS + 设计令牌 | 不上 Tailwind，避免 utility 类污染排版语义 |
| 客户端 JS | 原生 TS 模块，按需 `import()` | 无 UI 框架、无状态库 |
| 图形 | 手写 WebGL2 + CSS 层 | 不引 three.js / OGL（见 14） |
| 搜索 | 自建 bigram 倒排索引（构建期生成） | 无依赖 |
| 评论 | giscus（iframe 懒加载） | 无后端 |
| 代码高亮 | Shiki（Astro 内置），双主题 `dark-plus` / `light-plus` | 即 VSCode 官方配色 |
| 字体子集 | `subset-font`（harfbuzz wasm），构建前跑 | 无 Python 依赖 |
| 图片 | `astro:assets`（sharp） | AVIF/WebP + srcset |
| 站图/RSS | `@astrojs/sitemap` + `@astrojs/rss` | |
| 包管理 | pnpm 12 / Node 24 | 已在本机验证 |

**不引入**：Tailwind、React/Vue/Svelte、GSAP/Lenis、three.js、Pagefind、图标库、markdown-it 系插件链。

---

## 4. 目录结构

```
G:\badbadblog\
├─ astro.config.mjs
├─ package.json
├─ tsconfig.json
├─ SPEC.md                     ← 本文档
├─ README.md                   ← 写作与维护手册（交付物）
├─ .gitignore
├─ public/
│  ├─ favicon.png  favicon-dark.png  logo.png
│  ├─ avatars/avatar.png
│  └─ fonts/                        ← Instrument Serif + 得意黑子集（构建期生成）
├─ src/
│  ├─ assets/
│  │  └─ images/                    ← 文章插图（走图片管线）
│  ├─ content/
│  │  ├─ blog/the-born-of-badbadblog.md
│  │  ├─ notes/dev-setup.md  basics-of-c-language.md
│  │  ├─ stories/            （空，等第一篇）
│  │  ├─ gallery/            （空，等第一件）
│  │  └─ pages/about.md  credits.md
│  ├─ content.config.ts             ← 集合与 schema 校验
│  ├─ data/
│  │  ├─ site.ts                    ← 站点身份（原 card.yml）
│  │  ├─ sections.ts               ← 四栏目常量（原 _sections.py）
│  │  ├─ categories.ts             ← 四分类常量（原 gallery.py CATEGORIES）
│  │  ├─ topics.ts                 ← 主题登记表（原 topics.yml）
│  │  └─ featured.ts               ← 精选作品（原 featured.yml，现为空）
│  ├─ layouts/
│  │  ├─ Base.astro                ← html/head/主题预置/全局脚本
│  │  ├─ Facade.astro              ← 门面（首页、影像）
│  │  └─ Reading.astro             ← 阅读区（文章、作品详情、关于、致谢）
│  ├─ components/
│  │  ├─ shell/  NavCluster.astro  Drawer.astro  ThemeToggle.astro
│  │  │          SearchTrigger.astro  SearchOverlay.astro  SkipLink.astro
│  │  ├─ facade/ Hero.astro  SectionScreen.astro  Bubble.astro  SeeMore.astro
│  │  │          ArtCanvas.astro
│  │  ├─ reading/ Prose.astro  Aside.astro  Figure.astro  Toc.astro
│  │  │           ArticleMeta.astro  PrevNext.astro  Lightbox.astro  CopyButton.astro
│  │  ├─ gallery/ GalleryWall.astro  CategoryFilter.astro
│  │  └─ comments/ Giscus.astro
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ blog/index.astro        blog/[...slug].astro
│  │  ├─ notes/index.astro       notes/[...slug].astro
│  │  ├─ stories/index.astro     stories/[...slug].astro
│  │  ├─ gallery/index.astro     gallery/[...slug].astro
│  │  ├─ archive/index.astro
│  │  ├─ topics/[slug].astro
│  │  ├─ about/index.astro       credits/index.astro
│  │  ├─ 404.astro
│  │  ├─ feed_rss_created.xml.ts ← /feed_rss_created.xml（文件名即路由）
│  │  ├─ search-index.json.ts    ← 搜索索引端点
│  │  └─ robots.txt.ts
│  ├─ styles/
│  │  ├─ tokens.css   （设计令牌，全站唯一取值来源）
│  │  ├─ shell.css    （跨页控件）
│  │  ├─ facade.css   （门面版式）
│  │  └─ reading.css  （阅读版式）
│  └─ scripts/
│     ├─ art/index.ts  art/particles.ts  art/lines.ts  art/parallax.ts
│     ├─ snap.ts  nav.ts  drawer.ts  filters.ts  theme.ts
│     ├─ search.ts  toc.ts  lightbox.ts  copy.ts  giscus.ts
│     └─ lib/raf.ts  lib/tier.ts  lib/ease.ts
├─ scripts/
│  ├─ new.ps1                      ← 写作入口（改造后）
│  ├─ check-links.mjs              ← 替代 mkdocs --strict
│  ├─ subset-fonts.mjs             ← 字体子集
│  └─ fonts-src/SmileySans-Oblique.otf   ← 得意黑源文件（OFL）
└─ .github/workflows/deploy.yml    ← 先备着，不推
```

---

## 5. 内容模型

### 5.1 集合与 schema

`src/content.config.ts`，用 Astro 7 的 glob loader。

```ts
blog      title?  date  authors  tags  draft  summary?
notes     title?  date          tags  draft  summary?
stories   title?  date          tags  draft  summary?
gallery   title   category  year  medium?  cover?  link?  summary?
pages（about / credits）  纯正文，无 schema
```

规则：

| 字段 | 类型 | 规则 |
|---|---|---|
| `title` | string? | 缺省时取**正文第一个 H1**；都没有就用文件名。**正文里同名的首个 H1 在渲染时被剥掉**（修线上 "CCCCCCCCCCC" 那个 bug） |
| `date` | date | 流水栏目必填；缺失时构建告警并回退 git 提交日 |
| `slug` | string? | 若存在，必须 === 文件名，否则构建失败 |
| `tags` | string[] | 自由写；只有登记在 `topics.ts` 的才生成聚合页 |
| `draft` | boolean | `true` → dev 可见（带草稿标记条）、构建时剔除 |
| `summary` | string? | 缺省时取正文首段前 120 字（去掉 `<!-- more -->` 之前的部分） |
| `category` | enum | `painting \| video \| interactive \| project`，写错构建失败 |
| `year` | int | 作品年份，用于倒序 |
| `cover` | string? | 4:3 建议；缺省用分类名占位气泡 |

### 5.2 正文语法（迁移后的唯一写法）

标准 Markdown + 三个**原生 HTML 块**。**不再支持** `!!!`、`???`、`{width=100%}`、`<!-- more -->`。

```markdown
<aside class="callout callout--tip" data-title="为什么要用虚拟环境">

正文（这里是普通 Markdown，块级 HTML 后面空一行即可）。

</aside>

<details class="qa">
<summary>折叠的问题</summary>

点开才看到的内容。

</details>
```

> 为什么不是 Astro 组件：`.md` 文件里不能 import 组件（那是 MDX 的能力）。
> 为了不引入 MDX 那一整套，提示框与折叠改用原生 HTML + CSS 类，语义与样式都在，
> 而且正文仍然是纯 Markdown —— 换任何渲染器都读得懂。
> 图片宽度不再手写属性：`.prose img` 默认撑满栏宽。

### 5.3 旧文迁移映射（一次性，逐条可查）

| 旧写法 | 新写法 | 涉及文件 |
|---|---|---|
| `!!! tip "标题"` | `<Aside type="tip" title="标题">` | `dev-setup.md` ×1 |
| `??? question "标题"` | `<details><summary>标题</summary>` | `dev-setup.md` ×4 |
| `![x](p){width=100%}` | `<Figure src=p alt=x width="full">` | `the-born-of-badbadblog.md` ×1 |
| `<!-- more -->` | front matter `summary`（我抽取） | `the-born-of-badbadblog.md`（2 个）、`basics-of-c-language.md`（2 个） |
| `categories: [C语言]` | 删除 | `basics-of-c-language.md` |
| 正文首个 `# 标题` | 若无 front matter `title` 则转为 `title`，并从正文剥离 | 两篇笔记 + 一篇博客 |
| 图片 `../../assets/images/x.png` | **原样保留**（目录搬移后相对路径不变，见 13） | 全部 |

> 注意：`basics-of-c-language.md` 里那段 C 代码本身有语法错误（`printf("0不能做除数")` 缺分号、`flaot`、`#include <stdio.h>{`）。
> **我不改你的代码**，只保证它被正确高亮显示。要不要修是你的事。

---

## 6. 设计系统

### 6.1 令牌（`tokens.css`）

沿用现有结构，但把灰阶换成**真正的纯黑白**：

| 令牌 | 深色（默认） | 浅色 | 用途 |
|---|---|---|---|
| `--bg` | `#000000` | `#ffffff` | 页面底 |
| `--bg-2` | `#0a0a0a` | `#f7f7f7` | 抬升面 |
| `--bg-3` | `#141414` | `#ededed` | 悬停面 |
| `--line` | `#1f1f1f` | `#e0e0e0` | 发丝线 |
| `--line-2` | `#3d3d3d` | `#bdbdbd` | 强分割线 |
| `--fg` | `#ffffff` | `#000000` | 主文字 |
| `--fg-2` | `#a8a8a8` | `#555555` | 次级（对比度 ≥ 7:1） |
| `--fg-3` | `#8a8a8a` | `#6b6b6b` | 元信息（对比度 ≥ 5:1） |
| `--accent` | `var(--fg)` | `var(--fg)` | 强调入口，本期保持黑白；将来上色只改这一行 |

保留：字阶（`--t-mega` 到 `--t-xs`）、间距、`--radius: 0`、动效曲线、`--measure: 42rem`、`--breath-*`。
新增：`--art-tier-*`（图形降级参数）、`--bubble-*`（气泡尺寸，等示意图后填）、`--nav-h`。

### 6.2 CSS 分层与加载

| 文件 | 内容 | 谁加载 |
|---|---|---|
| `tokens.css` | 只有变量与 `@font-face` | 全站 |
| `shell.css` | 导航簇、抽屉、筛选、跳过链接、焦点环、明暗按钮 | 全站 |
| `facade.css` | 首页第一屏、栏目屏、气泡、See More、影像墙 | 门面两处 |
| `reading.css` | `.prose` 全部排版、TOC、代码块、提示框、灯箱、评论容器 | 阅读区五处 |

放 `src/styles/` 由 Astro 打包（获得 HMR、压缩、内容哈希），`@font-face` 用绝对路径 `/fonts/x.woff2` —— 字体在 `public/`，不会被改写，也不会 404（这是交办包当初踩过的坑）。

### 6.3 字体策略

| 字体 | 用途 | 来源 | 处理 |
|---|---|---|---|
| Instrument Serif 400 | 拉丁大字、站名、英文标题 | 交办包 `design/fonts/`（OFL） | 直接自托管，normal 21KB + italic 懒加载 |
| 得意黑 Smiley Sans（Oblique） | **只用于签名性中文字** | `scripts/fonts-src/`（OFL） | 构建前扫描源码收集字符 → 子集化 → 预计 ≤ 20KB |
| 系统字体 | 正文中文、所有元信息 | — | `ui-sans-serif / PingFang SC / Microsoft YaHei` |
| 等宽 | 日期、序号、代码、元信息 | — | `ui-monospace / Cascadia Mono / Consolas` |

**"签名性中文"的判定**：`sections.ts` / `categories.ts` 里的栏目名与分类名、页面大标题、`See More`／`更多`／`全部`／`归档`／`搜索`／`关于` 这类闸门词。约 40–60 字。
**子集自动重建**：`pnpm fonts` 扫描 `src/**/*.{astro,md,ts}` 收集全部 CJK 字符 → 重新生成 woff2。写新文章后跑一次即可；忘记跑也不会掉字（会回落到系统宋体，不出现豆腐块）。

### 6.4 门面 vs 阅读区

| | 门面（首页 / 影像） | 阅读区（文章 / 作品 / 关于） |
|---|---|---|
| 底色 | 锁死 `#000` | 默认 `#000`，可切 `#fff` |
| 几何图形 | 大面积、主动、可交互 | 仅一层 ≤ 6% 不透明度的静态网格/噪点，滚出视口即不重绘 |
| 字号 | 流体 mega，可溢出裁切 | 18px / 1.85，最大 42rem |
| 留白 | 极端（一屏一屏） | 常规（段距 1.4em） |
| 动效 | 允许持续动画 | 只允许进入时的淡入 + 滚动高亮 |
| 光标 | 可自定义（见 7.1） | 系统光标 |

---

## 7. 页面规格

### 7.0 全站骨架

```
<html lang="zh-CN" data-theme="dark">   ← 内联脚本在样式之前预置主题，避免闪白
  <a class="skip">跳到正文</a>
  <NavCluster />      ← 首页第一屏隐藏，其余位置常驻右上角
  <Drawer />          ← 三道杠展开的栏目入口
  <SearchOverlay />   ← 默认隐藏
  <main id="main">
  <Footer />          ← 门面与阅读区两套视觉
```

### 7.1 首页 `/`

**布局（一屏一屏）**

| 屏 | 内容 | 状态 |
|---|---|---|
| 1 | 全屏黑白几何 + 头像演化出的强交互 + 大字 `badbadsheep` | **TBD，等你示意图** |
| 2 | `Blog.` 栏目屏：5–6 条气泡 + 右下角 See More | 气泡形态 TBD |
| 3 | `Note.` 同构 | 同上 |
| 4 | `Story.` 同构 | 同上 |
| 5 | `Gallery.` 同构（气泡内为封面占位） | 同上 |
| 6 | 页脚：邮箱 / GitHub / 关于 / 归档 / RSS / credits，小字 | 已定 |

**滚动**：第 1 屏 `scroll-snap: start` 吸附；第 2 屏起自由滚动。吸附仅在 `≥768px`、`prefers-reduced-motion: no-preference`、非触屏拖动打断时生效。

**导航出现**：滚过第 1 屏高度后，右上角淡入（200ms），上滑时隐藏、下滑时出现。

**第一屏的接口契约**（形状先定死，效果等你图）：

```ts
// src/scripts/art/index.ts
createScene({ canvas, tier, reduced, theme })
  → { setPointer(x, y), setScroll(p), setTheme(t), resize(), destroy() }
```
- `tier`: `'full' | 'reduced' | 'static'`（判定见 16）
- 所有效果都必须实现 `static` 分支：渲染一帧确定构图，之后不请求 RAF
- 禁止在主线程做逐帧 CPU 计算；粒子位置在 GPU 里算

**四屏网格层**（第 2–5 屏的底纹）

第一屏不动。第 2–5 屏统一铺一张**静态方形网格**，纯 CSS（`facade.css` 的 `.screen` 背景），没有 JS、不呼吸、不跟随指针。

- 格子 56px（`--grid-cell`）、线宽 0.3px（`--grid-line`）、颜色 `--grid-ink`。格子从每屏左上角起算，不追求与屏幕左右边缘对齐。
- 网格是 `.screen` 的背景，文字与气泡天然压在它上面；气泡与 See More 另有不透明底 `--bg`，网格不会从卡片内部透出来（改气泡底色前先读这段）。
- 无降级分支：静态背景在任何情况下都成立（`prefers-reduced-motion`、无 JS 都一样）。

### 7.2 `/blog/` `/notes/` `/stories/` 列表页

- 顶部：栏目名大字（得意黑）+ 一句话栏目描述 + 条数
- 主体：时间流列表（日期在左、标题、摘要、栏目/标签），沿用 `web.css` 的 `.row` 语言
- 分页：每页 15 条，`/<栏目>/page/2/`；条数不足时不出分页
- 空态：一句自嘲 + 一个"去别处看看"的链接
- 排序：`date` 倒序

### 7.3 `/gallery/` 影像墙

- 顶部：`Gallery.` 大字 + 四分类筛选条（横向，计数为 0 的分类不显示）
- 主体：气泡墙（与首页同一套 `Bubble` 组件，尺寸更大）
- 筛选：原地过滤 + URL 同步 `?c=painting`（沿用现有 `data-filter-*` 语义）
- 空态：四个分类都为空时显示"这里还空着"的引导，不是空白
- 作品详情 `/gallery/<slug>/`：走 `Reading` 布局，`medium / year / link` 显示在元信息条；有 `link` 时显示"去看看 →"

### 7.4 文章页（blog / notes / stories）

| 区块 | 内容 |
|---|---|
| 页头 | 栏目名（小）+ 标题（中文得意黑 / 拉丁 Instrument）+ 元信息条 |
| 元信息条 | 日期 · 栏目 · 标签 · 字数 · 预计阅读时间（`字数/350` 分钟，向上取整） |
| 右栏 | TOC（仅 `≥72rem` 显示），`IntersectionObserver` 高亮当前节，2px 黑/白指示条 |
| 正文 | `.prose`：18px/1.85、`--measure 42rem`、段距 1.4em、列表与引用细线、表格发丝线 |
| 代码 | Shiki 双主题、行号（CSS counter，非 DOM）、语言标签、复制按钮 |
| 图片 | 懒加载 + 灯箱（点击全屏，ESC/点遮罩关闭，`<dialog>` 实现） |
| 页尾 | 上一篇/下一篇（同栏目内，按日期）→ 评论区 |
| 评论区 | 仅 blog/notes/stories 三处；giscus 懒加载（见 11） |

### 7.5 `/archive/`

按年月分组，覆盖三个流水栏目；月份标题用等宽小字（`2026 年 10 月`），条目复用 `.row`。

### 7.6 `/topics/<slug>/`

只生成 `topics.ts` 里登记过的标签（目前只有 `MkDocs`）。未登记标签不生成页面，但文章页的标签仍然可点 → 指向 `/topics/`? **不**，未登记标签在文章页渲染为不可点的纯文本（避免死链）。

### 7.7 `/about/` 与 `/credits/`

- `/about/`：我重写（去掉 MkDocs + Material，写清现在的技术栈、写这段话的人、版权声明）。**写完给你过**。
- `/credits/`：字体（Instrument Serif OFL、得意黑 OFL）、Astro、图标来源、图片来源、旧站迁移说明。

### 7.8 `/404/`

门面风格：一屏黑底 + 几何图形（指针可扰动）+ 一句自嘲（我起草，你改）。给三个出口：首页 / 归档 / 搜索。

### 7.9 RSS / sitemap / robots

- `/feed_rss_created.xml`：三个流水栏目的最近 20 条，含正文 HTML（相对链接转绝对）
- `sitemap-index.xml`：`@astrojs/sitemap`，排除 `/404/`
- `robots.txt`：allow all + sitemap 地址

---

## 8. 组件清单

| 组件 | 职责 | 客户端 JS |
|---|---|---|
| `Base.astro` | html、head、主题预置、样式与字体、全局脚本 | 内联 <400B |
| `Facade.astro` / `Reading.astro` | 两套外壳 | 否 |
| `NavCluster` | 三道杠 / 明暗 / 归档 / 搜索 四件套 | 是（~1KB） |
| `Drawer` | 栏目入口抽屉（焦点陷阱、ESC、遮罩） | 是（~1.2KB） |
| `SearchOverlay` | 全屏搜索层 | 懒加载（~2.5KB + 索引） |
| `ArtCanvas` | 第一屏 WebGL 容器 | 懒加载（~9KB） |
| `SectionScreen` / `Bubble` / `SeeMore` | 栏目屏与气泡 | 否（CSS 动画） |
| `Prose` / `Aside` / `Figure` | 正文排版与语义块 | 否 |
| `Toc` | 右侧目录与滚动高亮 | 是（~800B） |
| `Lightbox` | 图片全屏查看 | 是（~900B） |
| `CopyButton` | 代码复制 | 是（~500B） |
| `Giscus` | 评论区 | 懒加载 iframe |
| `GalleryWall` / `CategoryFilter` | 影像墙与筛选 | 是（~1.1KB） |

---

## 9. 交互行为详表

| 交互 | 触发 | 行为 | 降级 |
|---|---|---|---|
| 第一屏吸附 | 滚动越过第一屏 | `scroll-snap` 对齐；触屏拖动不拦截 | 不吸附 |
| 导航淡入 | 滚过第一屏高度 | 下滑出现、上滑隐藏、滚回顶部隐藏 | 常显 |
| 三道杠 | 点击 | 右侧抽屉滑入，焦点移入面板，`body` 锁滚 | 无 JS 时展开为普通链接列表 |
| 明暗切换 | 点击 | 切 `data-theme`，写 `localStorage['bbs:theme']`，首页不响应 | 跟随系统 |
| 归档 | 点击 | 跳 `/archive/` | — |
| 搜索 | 点击 / `⌘K` | 全屏层滑下，输入即出结果，↑↓ 选择，Enter 打开，ESC 关闭 | 无 JS 时跳到 `/archive/` |
| 分类筛选 | 点击（影像墙） | 原地过滤 + `?c=` 同步 + 重新计算计数 | 无 JS 时显示全部 |
| TOC 高亮 | 滚动 | `IntersectionObserver` 标当前节 | 静态目录 |
| 灯箱 | 点击图片 | `<dialog>` 全屏，ESC/遮罩关闭，焦点回归 | 新标签打开原图 |
| 复制代码 | 点击按钮 | `navigator.clipboard`，按钮文案切"已复制"1.5s | 选中全部 |
| 评论加载 | 进入视口 | 注入 giscus iframe，主题跟随站点 | 一个 GitHub Discussions 链接 |
| 首页气泡 | 悬停 | 轻微位移/描边加粗（≤4px，120ms） | 无 |
| 指针图形 | 移动（仅门面） | 喂给 WebGL uniform | 不动 |

**键盘与焦点**：抽屉与搜索层必须有焦点陷阱；所有可点元素有 `:focus-visible` 环（`--focus-ring`）；`Tab` 顺序符合视觉顺序。

---

## 10. 搜索实现

### 10.1 索引（构建期生成，`/search-index.json`）

```json
{
  "v": 1,
  "docs": [
    { "u": "/notes/dev-setup/", "t": "从零搭好本地写作环境", "s": "目标：在一台全新的 Windows 机器上…", "d": "2026-10-09", "k": "notes" }
  ],
  "title": { "写作": [0], "环境": [0] },
  "body":  { "环境": [0], "配置": [0] }
}
```

- 中文：连续两字切 bigram（`从零`、`零搭`、`搭好`…），单字查询退回单字表
- 英文/数字：小写词干，去停用词
- 记录值用 base36 delta 编码，压缩后估算 **8–14KB**（gzip），懒加载

### 10.2 查询与排序

| 步骤 | 规则 |
|---|---|
| 归一化 | 转小写、去全角空格、剥离标点 |
| 命中 | 标题权重 ×3、摘要 ×2、正文 ×1；多 bigram 累加 |
| 门槛 | 至少命中 1 个 bigram；结果上限 20 |
| 排序 | 分数降序 → 日期降序 |
| 高亮 | 返回摘要中首个命中位置 ±40 字切片，前端包 `<mark>` |

### 10.3 交互

- 覆盖层从顶部滑下（220ms），输入框自动聚焦
- 空输入时显示"最近 5 条"而不是空白
- 结果列表可键盘上下选择；`Enter` 打开、`ESC` 关闭并还原滚动位置
- 无 JS：搜索按钮退化为指向 `/archive/` 的链接

---

## 11. 评论（giscus）

| 项 | 值 |
|---|---|
| 出现位置 | `/blog/*` `/notes/*` `/stories/*` 文章底部（**gallery 作品页没有**） |
| 实现 | `@giscus/client` 不引入；直接注入官方 script 标签 |
| 加载时机 | `IntersectionObserver` 进入视口 + 距底部 400px |
| 主题 | 跟随站点 `data-theme`：`postMessage({ giscus: { setConfig: { theme } } })` |
| 配置 | `PUBLIC_GISCUS_REPO` / `REPO_ID` / `CATEGORY` / `CATEGORY_ID`（`.env`，**你提供**） |
| 开发态 | `import.meta.env.DEV` 时显示占位框 + 一句"本地不加载评论" |
| 无 JS | 显示一个指向仓库 Discussions 的链接 |
| 体积 | iframe 独立域名，不计入本站 JS 预算 |

> 依赖：仓库必须**公开**且开启 Discussions，并安装 giscus App。订阅者需 GitHub 登录 —— 这是 giscus 的固有代价，你已确认接受。

---

## 12. 代码高亮

- Shiki 内置主题 `dark-plus` / `light-plus`（即 VSCode 官方配色，注释 `#6A9955` / `#008000`，够亮）
- 双主题同时输出，CSS 用 `[data-theme]` 切换 `--shiki-*` 变量
- 行号用 CSS counter 生成（不进 DOM，减少 HTML 体积）
- 语言标签取 `lang`，映射成显示名（`powershell` → `PowerShell`、`c` → `C`）
- 复制按钮：客户端 500B，`navigator.clipboard` + 1.5s 反馈
- 长代码行横向滚动，不折行（C 代码折行会毁掉可读性）

---

## 13. 图片

| 项 | 决定 |
|---|---|
| 存放 | 文章插图 `src/assets/images/`；图标/头像/字体 `public/` |
| 正文引用 | 保持相对路径 `../../assets/images/x.png`。**`src/content/notes/a.md` 到 `src/assets/images/x.png` 恰好也是 `../../`，所以正文路径一个字都不用改** |
| 优化 | `astro:assets` 生成 AVIF/WebP + srcset，宽 400/800/1200 |
| 首图 | 不设懒加载障碍；正文图 `loading="lazy"` + `decoding="async"` |
| 灯箱 | 点缩略图开原图，`<dialog>` 实现 |
| 头像/logo | 不做管线处理（小、且要稳定 URL），`public/avatars/avatar.png`、`public/logo.png` |
| 旧图迁移 | `assets/images/*.png`（4 张，共 873KB）原样搬入 `src/assets/images/`，由管线重新压 |

> 实现阶段验证项：Astro 7 的 Markdown 图片是否默认走图片管线。若不默认，退化方案是给需要优化的图用 `<Figure>` 组件（迁移时本来就要碰那些图）。

---

## 14. 首屏图形（WebGL2 + CSS 分工）

### 14.1 为什么不是 three.js

实测（esbuild + minify，r186）：只 `import { WebGLRenderer }` 就是 **134KB gzip / 110KB brotli**，加全屏 shader + 4000 粒子只多 1.1KB。归因：着色器库 34.9%、WebGL 后端 24.8%、数学库 12.5%、WebGLRenderer 本体 6.8%、WebXR 2.5%。你要的是二维全屏 shader，不需要 3D 后端。

对照：手写 WebGL2 全屏 shader 是 **580B gzip**，OGL 是 13.3KB。

### 14.2 分层职责

| 层 | 用什么 | 负责 |
|---|---|---|
| WebGL2 | 手写 | 粒子场、线条流动、几何形变、鼠标涟漪、噪声位移 |
| CSS | transform / clip-path / mask / animation | 网格、噪点、描边方块、遮罩显影、视差、悬停位移 |
| DOM | — | 文字与可访问内容（图形层永远 `aria-hidden`） |

### 14.3 技术约束

- 只在 `WebGL2RenderingContext` 可用时启用；否则整层换成 CSS 静态构图
- 粒子数：`full` 20000 / `reduced` 3000；`DPR` 上限 2 / 1.5
- 页面不可见、画布滚出视口 → 停止 RAF
- `webglcontextlost` → 切静态，不报错、不重试
- 所有颜色从 `tokens.css` 的 `--art-*` 读，主题切换即时生效

### 14.4 首屏骨架开销

| 项 | gzip |
|---|---|
| WebGL2 骨架（program/uniform/buffer、RAF、DPR、resize、暂停、降级） | ~1.5KB |
| 每个效果 | 1–3KB |
| 首屏调度（吸附、导航、指针） | ~3KB |
| **合计** | **~8–12KB** |

---

## 15. 性能预算（首屏，gzip）

| 项 | 预算 | 说明 |
|---|---|---|
| HTML | ≤ 22KB | 首页无长列表，服务端直出 |
| CSS | ≤ 14KB | 只加载 `tokens + shell + facade` |
| JS | ≤ 14KB | 主题预置（内联 <400B）+ WebGL 骨架 + 调度 |
| 字体 | ≤ 40KB | 得意黑子集 ≤20KB + Instrument Serif normal 21KB；italic 懒加载 |
| 首屏图片 | 0KB | 纯几何，无位图 |
| **合计** | **≤ 90KB** | 留 60KB 余量给意外 |

其他硬指标：

- 阅读页 JS ≤ 8KB（TOC + 复制 + 灯箱，全部懒加载初始化）
- 搜索索引 ≤ 15KB，且**只在打开搜索时**请求
- 评论 iframe 只在进入视口时加载
- 单页初次渲染无布局跳动（字体 `size-adjust` + 固定高度占位）

---

## 16. 降级矩阵

| 条件 | tier | 行为 |
|---|---|---|
| 无 WebGL2 | `static` | CSS 几何构图一帧；无 RAF |
| `prefers-reduced-motion: reduce` | `static` | 同上，且所有过渡 1ms |
| `navigator.connection.saveData` | `static` | 不加载图形脚本与字体 |
| `deviceMemory ≤ 4` 或 `hardwareConcurrency ≤ 4` | `reduced` | 粒子 1/6、DPR 1.5、无后处理、30fps |
| 屏宽 < 700px | `reduced` | 同上 + 关闭指针视差 |
| 无 JS | — | 全站可读：内容、列表、文章、RSS 全静态；筛选显示全部；搜索退化为归档链接 |
| 字体加载失败 | — | 回落系统宋体/黑体，不出现豆腐块 |
| `webglcontextlost` | `static` | 一格降级，不弹错 |

---

## 17. 无障碍清单

- [ ] 每页第一个 Tab 是"跳到正文"
- [ ] 所有交互元素可键盘操作，`:focus-visible` 可见（纯黑白下用 3px 双层环）
- [ ] 抽屉与搜索层有焦点陷阱，关闭后焦点回到触发按钮
- [ ] `aria-pressed`（筛选）、`aria-expanded`（抽屉）、`aria-current`（当前页）
- [ ] 正文对比度 ≥ 7:1，元信息 ≥ 4.5:1（两套主题都测）
- [ ] 图形层 `aria-hidden="true"`，不进入 Tab 顺序
- [ ] `prefers-reduced-motion` 下无持续动画
- [ ] 图片有 `alt`（装饰图用空 alt）
- [ ] 页面语言 `lang="zh-CN"`
- [ ] 表单/搜索框有可见或隐藏 label

---

## 18. 内容迁移清单（执行时逐条打勾）

- [ ] `content/blog/the-born-of-badbadblog.md` → `src/content/blog/`，`<!-- more -->` 抽取为 `summary`，`{width=100%}` 改 `<Figure>`，删 `slug` 冲突检查
- [ ] `content/notes/dev-setup.md` → `src/content/notes/`，1 个 tip + 4 个 details
- [ ] `content/notes/basics-of-c-language.md` → `src/content/notes/`，删 `categories`，抽 `title`，剥离正文首个 H1，处理 2 个 `<!-- more -->`
- [ ] `content/about.md` → `src/content/pages/about.md`（重写技术栈段）
- [ ] 新建 `src/content/pages/credits.md`
- [ ] `assets/images/*.png` ×4 → `src/assets/images/`（873KB）
- [ ] `assets/avatar.png` → `public/avatars/avatar.png`；`logo.png`、`favicon*.png` → `public/`
- [ ] `design/fonts/instrument-serif-*.woff2` + LICENSE → `public/fonts/`
- [ ] `data/card.yml` → `src/data/site.ts`
- [ ] `data/topics.yml` → `src/data/topics.ts`
- [ ] `data/featured.yml` → `src/data/featured.ts`（空数组）
- [ ] `_section-indexes/*` 作废（改由路由生成）
- [ ] `tooling/templates/*` 改写为新语法后放进 `scripts/templates/`

---

## 19. 工具链与日常流程

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 本地预览，`http://localhost:4321` |
| `pnpm build` | 构建到 `dist/`（含字体子集、搜索索引） |
| `pnpm preview` | 预览产物 |
| `pnpm check` | `astro check` 类型与 schema 校验 |
| `pnpm links` | 构建后爬 `dist/` 校验所有内链与图片 |
| `pnpm fonts` | 重建字体子集 |
| `.\scripts\new.ps1 "标题" -Section notes -Tags "环境配置,MkDocs"` | 新建文章骨架并在 VS Code 打开 |
| `.\scripts\new.ps1 -Publish -Slug xxx` | 草稿转正（`draft: false`） |

`check-links.mjs` 规则：
1. 扫描 `dist/**/*.html`，抽 `href` / `src`
2. 站内链接：目标文件存在（目录形式则查 `index.html`）
3. 锚点：目标文件里有对应 `id`（仅同页与站内绝对/相对）
4. 图片：`src/assets` 与 `public` 的资源都在产物里
5. 有死链 → 退出码 1，打印文件:行

`README.md`（写作手册）内容：装依赖、起服务、写一篇、加图片、加标签、转正、构建、常见报错。

---

## 20. 实施顺序与阶段验收

| 阶段 | 做什么 | 验收 |
|---|---|---|
| **0 骨架** | Astro 初始化、依赖、目录、`content.config.ts`、四集合路由、内容迁移、图片管线、`check-links` | 三个旧 URL 全部 200 且文字与线上一致；`pnpm links` 通过；`astro check` 零错误 |
| **1 阅读区** | `tokens/reading.css`、`.prose`、代码块、Aside/Figure、TOC、元信息、上下篇、灯箱、主题切换 | 两篇笔记 + 一篇博客在明暗两套下都正常；代码截图核对配色；TOC 高亮正确 |
| **2 门面壳** | `shell.css`、`NavCluster`、`Drawer`、列表页、归档、主题页、关于、credits、404、RSS、sitemap | 键盘走完全站；两个主题都无对比度问题；RSS 通过校验器 |
| **3 搜索** | 索引端点、`SearchOverlay`、高亮、键盘操作 | 中英文各 5 个查询命中正确；索引体积达标 |
| **4 首页** | 第一屏图形（按你的示意图）+ 四栏目屏 + 气泡 + See More | 与示意图一致；首屏预算达标；三档降级都验证 |
| **5 抛光** | giscus、降级矩阵、性能实测、无障碍、README、CI | Lighthouse a11y ≥ 95；首屏 ≤ 90KB；`pnpm build` 无警告 |

每阶段结束我会给你：本地 dev 地址 + 关键页截图 + 本阶段清单打勾。

---

## 21. 待你补的两件事（阻塞阶段 4）

### 21.1 第一屏示意图

我需要从图里读出：

1. **构图**：大字 `badbadsheep` 放在哪（正中/左下/被图形穿过）？大小占屏多少？
2. **头像怎么变成几何**：是拆成那些彩色线条再黑白化？是变成一个由线条构成的可扰动网格？还是保留圆形的轮廓？
3. **交互**：鼠标移动时发生什么？点击时？滚动离屏时？
4. **黑白**：第一屏是否真的纯黑白（你说以后才打破），还是现在就允许那一点彩色？
5. **进入第二屏的方式**：一个"往下"提示？还是滚动即走？

### 21.2 气泡框示意图

我需要知道：

1. 气泡是**正圆 / 圆角矩形 / 不规则**？是否有小尾巴？
2. 气泡里放什么（标题 / 日期 / 摘要 / 封面图）？文字在气泡内还是在旁边？
3. 5–6 个气泡怎么排（散落 / 网格 / 大小不一）？有没有重叠？
4. 气泡是否漂浮/跟随鼠标？
5. See More 按钮的形态（方框 / 圆形 / 只有文字 + 箭头）？

> 你可以直接画在纸上拍照，或给我参考站的某个具体区块 —— 都行。

---

## 22. 我替你做的默认决定（**这一节请逐条划掉你不同意的**）

| # | 默认 | 理由 | 可否 |
|---|---|---|---|
| 1 | 阅读区右上角也用同一套四件套，不做侧边栏 | 全站一致，少一套 UI | |
| 2 | `/stories/` `/gallery/` 现在为空 → 做"有内容感"的空态，不是空白 | 空页很难看 | |（不要生成一些奇怪的东西在这些页面！ 只需要在屏幕正中央写下“未来，这里将繁花满地”
| 3 | 不建 `/topics/` 总索引页，标签点击直达聚合页 | NAMING 里没有这一页 | |
| 4 | 未登记的标签在文章页渲染成**不可点**的纯文本 | 避免死链 | |
| 5 | 摘要缺失时自动取首段前 120 字 | 少写一个字段 | |
| 6 | `draft: true` 在 `pnpm dev` 可见（顶部一条草稿提示条），`build` 时剔除 | 比"看不见"好用 | |
| 7 | 图片：正文图进 `src/assets/`，图标/头像/字体进 `public/` | 管线只管值得优化的 | |
| 8 | 站名 `badbadsheep`，无中文名，tagline 保持 `welcome to my world` | 你只说了大字写 badbadsheep | |
| 9 | 页脚：` 2026 badbadsheep` + 关于 / 归档 / RSS / GitHub / 邮箱 / credits | | |
| 10 | 404 文案我起草（自嘲风），你改 | | | 
| 11 | `about.md` 我重写，写完给你过 | 旧文案必错 | |
| 12 | 文章列表每页 15 条 | | |
| 13 | 只保留 `/feed_rss_created.xml`，不再额外给 `/rss.xml` | 避免两个 Feed 打架 | |
| 14 | 得意黑使用它自带的斜体字形（Oblique） | 更有脾气 | |
| 15 | 第一屏吸附只在 `≥768px` 且非 reduced-motion 时启用 | 手机上容易卡手感 | |
| 16 | 不引入任何 UI 框架、不引 Tailwind | 体积与可控性 | |

---

## 23. 风险与已知坑

| 风险 | 影响 | 应对 |
|---|---|---|
| Astro 7 的 Markdown 处理器换代（Sätteri / Unified 两套） | 自定义 remark 插件写法可能与旧文档不同 | 阶段 0 先验证；我们的方案不依赖 remark 插件（正文已洗成标准语法），影响面小 |
| 首屏 WebGL 在你机器上的实际帧率 | 可能达不到"冲击力" | 阶段 4 先在真机（你的浏览器 + 手机）测，按实测调粒子数与后处理 |
| 纯黑白门面 + 彩色代码块 | 视觉上可能打架 | 代码块只在阅读区出现，门面无代码；实测后如需可给代码块一层极淡底色隔离 |
| 得意黑子集需要新字 | 若忘跑 `pnpm fonts`，新字回落系统字体 | 不出现豆腐块，只是字形不统一；README 里写死"新增中文标题后跑一次" |
| giscus 需要仓库公开 + Discussions | 你需自己去配 | 阶段 5 才接，之前是占位 |
| 线上旧站仍在服务 | 迁移期间两套并存 | 本次只在本地跑；切换上线是你单独决策的一步（阶段外） |

---

## 24. 实现记录（第一轮交付 · 2026-10-17）

### 24.1 已经跑起来的

| 项 | 状态 |
|---|---|
| 构建 | `pnpm build` 13 页，0 警告 |
| 类型 | `pnpm check` 0 error / 0 warning（TypeScript 固定 6.x，`astro check` 尚不支持 7） |
| 链接 | `pnpm links` 13 页 311 条站内链接，0 死链 |
| 正文 | 3 篇迁移完成（h1 修复、`!!!`→aside、`???`→details、`<!-- more -->`→summary、删 `categories`） |
| 阅读区 | prose / 代码块（行号 + 语言标签 + 复制）/ TOC / 元信息 / 上下篇 / 灯箱 / 明暗切换 |
| 站点面 | 首页（首屏留空 + 四栏目屏 + 气泡 + See More）/ 四栏目列表 / 影像墙 / 归档 / 主题 / 关于 / 致谢 / 404 / RSS / sitemap / robots |
| 搜索 | 自建 bigram 索引端点 + 全屏层 + 高亮 + 键盘操作，中英文各验证一次 |
| 字体 | Instrument Serif 自托管 + 得意黑子集 56.1KB（`pnpm fonts` 可重建） |
| 首屏预算 | **88.8 KB / 150 KB**（HTML 4.2 + CSS 4.7 + JS 3.2 + 字体 76.6） |
| 结构化数据 | 文章页 `og:type=article` + `published_time` + tags + **JSON-LD BlogPosting**（含 wordCount / keywords） |
| 部署 | `.github/workflows/deploy.yml` 已写，触发条件**只留手动**，流水线含死链门禁 |
| 命令 | `pnpm verify` / `dev.cmd` / `check.cmd`（双击可用，ASCII + CRLF，避开 cmd 中文乱码） |

### 24.2 与本文档不一致的地方（都是实现时被迫或更优的选择）

| 原文 | 实际 | 原因 |
|---|---|---|
| 正文用 `<Aside>` `<Figure>` 组件 | 原生 HTML + `.callout` / `<details>` 类 | `.md` 不支持 import 组件；避免引入 MDX |
| 首页每分类 15 条分页 | 每页 15 条已实现，但首页每屏只取 6 条 | 首页是"一屏一件事"，不是完整列表 |
| 导航"上滑隐藏、下滑出现" | 第一屏隐藏、之后常驻 | 隐藏/出现太跳；要改只动 `shell.ts` 一个函数 |
| 得意黑子集 ≤20KB | 56.1KB | 中文字形本身就重（约 150 字节/字），15–20KB 只够 100 字以内；这个尺寸已包含全部界面文案 + 三篇标题与各级小标题 |
| 图片 srcset 400/800/1200 | Astro 默认优化为 WebP + 固定宽高，无多尺寸 srcset | `.md` 里的图片只走默认管线；要 srcset 需改组件（作品页封面以后可单独做） |
| 首页气泡是三列网格 | **已按你附录的图改成长条**：`.bubbles--rows` + `layout="row"`，一条一行，栏目小字在左、标题居中偏左、日期在右，宽度 95%，每屏 6 条 | 你画的就是"窄而长、占满宽度"；形状仍由 `--bubble-*` 控制 |

### 24.3 第二轮：实测抓出并修掉的四个真问题

| # | 问题 | 怎么发现的 | 修法 |
|---|---|---|---|
| 1 | 关掉 JS 后右上角三个按钮全是死的（抽屉、搜索、明暗都要脚本），全站走不通 | 禁用 JS 打开首页，只能看到 hero | `<noscript>` 里给一条朴素导航带（8 个链接），保证无脚本也能走遍全站 |
| 2 | 复制按钮在文档没焦点 / 非安全上下文时直接降级成"已选中" | headless 点击复制，剪贴板是空的 | 改成三级降级：`navigator.clipboard` → `execCommand('copy')` → 全选兜底 |
| 3 | 目录高亮用 `IntersectionObserver` 的可见带，标题恰好滚到顶端时**一个都不亮** | 滚到「一次性安装」后查 `[data-active]`，是空的 | 改成滚动法：取最后一个顶部越过 140px 的标题；到底部时锁最后一节 |
| 4 | `new.ps1` 在本机直接**解析失败**（报一堆语法错） | 直接跑它 | 文件是 UTF-8 **无 BOM**，Windows PowerShell 按 GBK 读 → 中文串把引号截断。改为 UTF-8 **带 BOM** 后解析通过 |

顺带验证通过的流程（这些只有真跑才敢说"能用"）：

| 流程 | 结果 |
|---|---|
| 草稿 | dev 里列表可见、文章页可打开且带草稿提示条；build 产物里完全不存在 |
| 转正 | `-Publish -Slug x` 把 `draft: true` 改成 `false`；重复执行会提示"本来就不是草稿"，幂等 |
| 写作脚本 | `new.ps1` 生成 front matter 正确（title / date / tags / draft） |
| 分页 | 临时把 `PAGE_SIZE` 改成 1：`/notes/page/2/`、`/page/3/` 正确生成，翻页控件是「← 新一点 2 / 3 旧一点 →」 |
| 无 JS | 导航带 8 条链接可点，直接开 `/notes/` 正常 |
| 主题 | 切浅色 → 写 localStorage → 刷新保持；**带着浅色偏好回首页，门面仍是黑底白字** |
| 交互 | 复制内容与代码一致、图片灯箱开合、Ctrl+K 开搜索 + 方向键 + Enter 跳转、评论区占位文案 |

### 24.4 第三轮：用户实测反馈修掉的三个问题

| # | 反馈 | 根因 | 修法 |
|---|---|---|---|
| 1 | 首屏没有吸附效果，跟后面的内容连在一起 | `scroll-snap-type` 写在了 `.is-home` 上，而这个类挂在 `<body>`；**滚动容器是文档元素 `<html>`，写在 body 上浏览器根本不认** | 类挪到 `<html>`，选择器改成 `html.is-home`；hero 加 `scroll-snap-stop: always` |
| 2 | 把文章从 blog 挪到 story 后整站打不开 | ① 挪完 `blog/` 空目录 → `No files found` 警告；② 编辑时留下一行空的 `summary:` → YAML 读成 `null` → zod 报 "received object"（因为 `typeof null === 'object'`）；③ 我给的 `blog/_template.md` 里有个**活的**图片示例，指向不存在的文件 | ① 每个空目录配一份 `_template.md`；② schema 全面改用 `.nullish()`：空字段 = 没写；③ 所有模板的图片示例一律放进代码块；④ 配置 `redirects` 保住旧 URL |
| 3 | `_handoff/` 留着有点误导 | 迁移已全部完成，那 44 个文件只是对照用 | 已删除（zip 也一并忽略了，要不要删由你决定） |

吸附实测（headless 真滚轮事件）：

```
滚动容器 scroll-snap-type = y proximity
第一屏 900px / 视口 900px    align=start  stop=always
滚 140px  → scrollY = 0     ✓ 吸回第一屏
滚 2200px → scrollY = 2200  ✓ 越过第一屏，之后完全自由
再上滚 120 → scrollY = 2080  ✓ 自由滚动，不与你抢
```

新增 `pnpm images` 并串进 `pnpm verify`：图片不存在时 Astro 只会甩一个 `ImageNotFound`，
这个脚本提前指出「哪个文件第几行 → 哪张不存在的图」。

### 24.5 留给下一轮

1. 第一屏动效（等示意图）—— 接入点在 `src/scripts/art/index.ts`，管道已就绪
2. 气泡最终形态（你画的已经是长条，剩下的是圆角/描边/是否漂浮）—— 改 `tokens.css` 里四个 `--bubble-*` 变量即可换形
3. giscus 的四项 ID（`.env`）
4. 手机端降档强度（现在按 reduced 档实现，等真机实测再定）
5. 部署（GitHub Actions 与线上切换）



---

## 25. 第四轮：界面细节（8 条反馈）

| # | 反馈 | 做法 |
|---|---|---|
| 1 | 抽屉的「栏目」标题会跟着内容滚 | 面板 `overflow: hidden`；标题条 `flex: 0 0 auto`；列表 `flex: 1 1 auto` + **`min-height: 0`**（少这一条，flex 子项的 min-height 默认 auto，会把面板顶出屏幕，于是标题跟着跑） |
| 2 | 点 RSS 弹出一屏代码 | 抽屉里移除 RSS 入口。**订阅源本身保留**（`/feed_rss_created.xml`），它本来就不是给人点开看的 |
| 3 | 「更多文章（8）」改成 `See More`，不要括号 | 按钮文案固定 `See More`，条数不再显示 |
| 4 | QQ 邮箱改成小字、不做超链接 | 抽屉底部 `<p class="drawer__mail">`，纯展示 |
| 5 | 索引 + 外面 合并成「其他」 | 其他 = 关于 / 归档 / 致谢 / GitHub；不含 RSS、不含邮箱 |
| 6 | 抽屉字体调大、对比度提高 | 标题 14px、条目 **17px**、条目色改成 `--fg`（纯白），分组标签 `--fg-2` |
| 7 | 文章靠左、目录固定在右侧垂直居中 | `.page--wide`（84rem）+ 正文 `margin-left` 靠左；目录 `position: fixed; top: 50%; transform: translateY(-50%)`，横向**贴着正文栏右缘**（间距 32px），不是贴屏幕右缘 |
| 8 | 代码超过 5 行折叠 + Unfold / Fold | `reading.ts` 按**真实行高**算裁剪高度写进 `--code-fold-h`；淡出遮罩用 `--code-solid`（= Shiki 主题底色，深色 #1E1E1E / 浅色 #FFFFFF，避免露出色差）；按钮固定底部居中，展开后变 `Fold` |

两个实现细节值得记：

- **目录的位置**一开始我做成"贴屏幕右边缘"，在 1600px 上正文与目录之间空出 528px，很难看。改成"贴正文栏右缘 + 32px 间距"后是 32px。竖向仍然是视口 50% 居中，滚到哪儿都不动。
- **目录什么时候出现**：标题数 > 1 才渲染。当前三篇真文章都只有 1 个标题，所以现在**看不到目录** —— 写成分节的文章自然就有。

验证数据（headless 实测）：

```
抽屉        矮视口 1200×560：列表可滚（视口 504 / 内容 663），滚 159px 后标题条 top 仍是 0
           条目 17px / 标题 14px / 条目色 #fff / 邮箱 tagName=P（非链接）
文章布局    1600×950：正文 176…848，目录 880…1104（间距 32px），目录中心 475 = 视口中心
           滚 900px 后目录中心仍是 475
代码折叠    8 行 → 裁剪高 141px；点 Unfold → 222px、按钮变 Fold；31 行块同样折叠
See More    See More →  （不再有条数）
构建        18 页 / 595 条站内链接 / 0 死链 / 0 error
```

---

## 26. 第五轮：又 7 条（含两条上轮没解决的）

| # | 反馈 | 根因 | 做法 |
|---|---|---|---|
| 1 | 代码左右很长时，得滚到代码块最下面才拖得到横向滚动条 | `pre` 自带的横向条只在块底部 | 加一条 `position: sticky; bottom: 0` 的**代理滚动条**：代码块还在视口里时它一直贴在窗口下沿，随时能拖；与 `pre.scrollLeft` 双向同步。有代理条时才隐藏 `pre` 自带的那条（无 JS 时原生条照旧） |
| 2 | 博客/笔记/故事 与 影像 的落地页大字大小不一 | 影像页用 `--t-mega`（最大 208px），其余三页用 `--t-xl`（最大 64px）—— 差了三倍 | 新增 `--t-mark`（mega 与 xl 的中间值，最大 8.5rem），四个栏目页统一用它 |
| 3 | 抽屉里加「回到主页」 | — | 放在四个栏目**上方**，带边框的按钮样式 |
| 4 | 上下篇太宽 + 中间加「回到上一级」 | 上下篇是 `grid 1fr 1fr`，拉满 42rem | 改成 `flex` + `width: fit-content`（实测 158px / 正文栏 672px）；「回到上一级」放在上下篇与评论之间，指向该栏目导航页 |
| 5 | RSS 有用，加回「其他」 | — | 其他 = 关于 / 归档 / 致谢 / **RSS** / GitHub |
| 6 | ①「栏目」还在滚 ②看不到目录 | ① 我的 flex 修法在你的浏览器里不够（我这边复现不出来，说明是面板整体滚，不是列表滚）<br>② 目录断点写在 **1278px**，把 Windows 125% 缩放下 1440 物理像素（≈1152 CSS 像素）整个挡在门外 | ① 标题条再加 `position: sticky; top: 0` 双保险 —— 谁滚它都不走<br>② 断点降到 **992px**（990px 才是真正放不下的界线）；目录收录 h2/h3/**h4**，标题数 ≥1 就显示 |
| 7 | 首页页脚的 QQ 邮箱奇大无比 | 门面页脚把邮箱做成了 `--t-l` 的大字链接 | 改成与同一行其它项一致的小字（12px）、纯文本不可点，`user-select: all` 方便整段复制 |

验证数据：

```
横向代理条   代码块 818px 高跨视口时：条底=700（视口 700）✓ 贴住；
             拖代理条 150px → 代码 scrollLeft 同步 150
栏目标题     博客/笔记/故事/影像 四页均为 105.6px（此前 64 vs 208）
抽屉         position=sticky；「← 回到主页」是列表第一个元素；其他含 RSS
目录         1152px 窗口下出现，3 条，x 763…987（此前整块 display:none）
上下篇       158px（正文栏 672px）；块顺序 article__head → prose → prevnext → up-link → comments
页面页脚     邮箱 12px（与同行一致），标签 SPAN（非链接）
```

---

## 27. 第六轮：目录面板可拖 + 抽屉收尾

| # | 反馈 | 做法 |
|---|---|---|
| 1 | 删掉抽屉里的 QQ 邮箱 | 整块删除（连 `.drawer__mail` 样式一起），抽屉现在只有：回到主页 / 四栏目 / 其他（关于·归档·致谢·RSS·GitHub） |
| 2 | 目录与正文之间加淡实线；目录左端加拖拽手柄；最宽半屏、最窄彻底收起贴右；文字自适应 | 目录从"浮在正文右边"改成**右侧满高面板**：`border-left: 1px solid var(--line)` 就是那条分隔线；左缘 12px 宽的 `col-resize` 手柄；宽度写进 `--toc-w`，`body:has(.toc-panel) .page--wide` 的右边距读同一个变量，所以**拖宽时正文自动变窄、文字重新折行**；上限 `50vw`，下限 40px（收起成竖排「目录」+ 手柄，点一下复原）；拖到的宽度记在 `localStorage['bbs:toc-w']` |
| 3 | 目录是怎么生成的？为什么没有「基本语法」和「introduction」？ | Astro 的 `render()` 返回正文里所有标题（depth/slug/text），我按 depth 过滤。原来只收 h2–h4，而那篇正文用的是 `# Introduction` / `# 基本语法`（depth 1）→ 被过滤掉。**改成收 h1–h4**（文章标题来自 front matter、不在 headings 里，所以不会重复） |

验证数据（1600×900）：

```
面板      224px 固定右侧，分隔线 1px rgb(31,31,31)
拖到最宽  720px（= 1440/2，被半屏卡住），正文 672 → 630px（文字重排），localStorage 写入 720
拖到最窄  40px，data-collapsed=true，目录内容隐藏，正文回到 672
点面板    224px 复原；刷新后仍是 224px（记住了）
目录条目  Introduction | 基本语法 | 2026/10/15   ← 三个都在了
抽屉      邮箱元素与 @qq.com 文本均已不存在
```

---

## 28. 第七轮：字体根治 + 正文跟随目录

| # | 反馈 | 根因 | 做法 |
|---|---|---|---|
| 1 | 标题字体不一样 | 中文子集是**构建期**按当前源码里的字切的；改完文章跑的是 `pnpm dev`，dev 不重建 → 新标题里的字回落宋体，**同一个标题里两种字体**。实测：子集停在 15:53（361 字），内容 18:36 已改，重跑后 363 字 | dev 里加 `live-font-subset` 插件：启动先补一次、改到 `src/**` 的 md/astro/ts 时防抖 80ms 重建、字集变了就整页刷新；字体文件在 dev 下带 `Cache-Control: no-store`。**两个坑**：① `integrations` 要放 Astro 集成（带 hooks），直接塞 Vite 插件是静默失效；② 配置会被打包，相对路径 `import()` 不可靠，改走子进程 |
| 2 | 拖目录时正文不动，拖动就没意义 | 正文写死 `min(100%, 42rem)`，空间够就是 42rem，右端永远不动 | 正文宽度改成「填满左边距 → 目录左缘」，上限 `--article-max: 68rem`。**拖手柄本质上就是行长旋钮**：目录拖宽 → 一行变短 |
| 2b | 正文左边界再往右一点点 | — | 左边距 `max(s5, 4vw)` → `clamp(s5, 8vw, 10rem)`（1440 下 100 → 115px） |
| 3 | 栏目详情页左上角也要「回到上一级」 | — | 四个栏目页顶部都加了 `.up-link`，指向 `/`。`.up-link` 从 reading.css 搬到 shell.css（影像页是门面布局，读不到 reading.css） |
| 4 | 上下篇挤在一起 | 上一轮为了"窄"改成了 `width: fit-content` | 改成 `justify-content: space-between`，两个标题分别贴正文栏的左右边界 |

验证数据：

```
字体覆盖  document.fonts.check 对三个中文标题全部 true
          （"从0开始的C语言生活" / "网站大迁徙" / "这个网站诞生的稀里糊涂"）
dev 重建  写入含"龘"的临时文章：3.5s 内 55116 → 55736 字节，
          日志 [fonts] 子集已重建…刷新页面；删掉后自动回到 55116
字体缓存  dev 下 Cache-Control: no-store, must-revalidate
正文宽度  目录 224 → 正文 1069 ｜ 400 → 893 ｜ 560 → 733 ｜ 700 → 593，与目录间距恒为 32px
栏目按钮  /blogs/ /notes/ /stories/ /gallery/ 全部在 (176, 72)
上下篇    只有一个邻居时贴对应那一侧；两个都有时分别贴左右边缘
构建      12 页 / 413 条站内链接 / 0 死链 / 0 error
```

---

## 附：首页线框（你给的版本，用于对照实现）

```
┌──────────────────────────────────────────────┐
│                                              │
│                badbadsheep                     │  ← 第 1 屏（吸附）
│                                              │  ← 第 1 屏（吸附）
│              [几何 / 头像演化]                │     无导航
│                                         │
│                                     ↓        │
├──────────────────────────────────────────────┤
│                              ☰  ◐  ⌗  ⌕      │  ← 右上角四件套淡入
│                                              │
│  Blog.                                       │  ← 第 2 屏
│ （     气泡窄而长 自适应占据页面95%宽度       ）|                     
│ （   <标题>--<日期>                                   ）   |
│ （                                      ）  |
│             这样放6条试试看                                 |
│                                              |
│                                See More →    │  ←  See More右下角
│                     
├──────────────────────────────────────────────┤
│  Note.                            02         │  ← 第 3 屏（同构）
├──────────────────────────────────────────────┤
│  Story.                           03         │  ← 第 4 屏
├──────────────────────────────────────────────┤
│  Gallery.                         04         │  ← 第 5 屏
├──────────────────────────────────────────────┤
│  badbadsheep 2026                            │  ← 页脚
│  mail · github · 关于 · 归档 · RSS · credits  │
└──────────────────────────────────────────────┘
```
