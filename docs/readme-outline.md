# README 重写大纲（填空用）

> 这不是成品 README，是给你自己重写时对着填的骨架。
> 核心原则：**README 是"门的把手"，不是"整座房子的说明书"。**
> 30 秒内让人知道这是什么、怎么跑、去哪看细节；细节统统指向 `docs/` 和 `SPEC.md`。

---

## 0. 先想清楚写给谁

| 读者 | 他打开 README 想找什么 | 对应章节 |
|---|---|---|
| 第一次来的陌生人（友链、招聘者、同好） | 这站是什么、在线地址、什么风格 | 抬头 + 截图 |
| 想跑起来/改代码的人 | 环境、命令、目录结构、内容在哪 | 快速开始 + 结构 |
| 三个月后的你 | 怎么发文章、怎么部署、报错怎么查 | 写作流程 + 部署 + 排查指针 |
| 未来的维护者 | 设计取舍、降级策略、兼容性 | 指向 SPEC.md |

**不要在 README 里写**：Markdown 语法教程、逐轮迭代记录（那是 `SPEC.md` 和 `git log`）、
大段 FAQ（拆到 `docs/troubleshooting.md`）、营销式形容词。

---

## 1. 建议结构（顺序即重要性）

### ① 抬头（3–6 行，最重要）
- [ ] 站名 + 一句话它是什么（不是口号，是事实：谁的站、写什么、给谁看）
- [ ] 在线地址（`https://badbadsheep.github.io`）
- [ ] 技术栈一句话：Astro 静态站 · 无框架运行时 · 无后端 · GitHub Pages
- [ ] 一张图（首页或文章页截图）——比十行形容词有用

### ② 快速开始（10 行内）
- [ ] 前置：Node `>=22.22`、pnpm（版本由 `package.json` 的 `packageManager` 决定）
- [ ] 三条命令：`pnpm install` → `pnpm dev` → 打开 `http://localhost:4321`
- [ ] 一条"全都查一遍"：`pnpm verify`（字体子集 → 图片引用 → 类型 → 构建 → 死链）
- [ ] 端口被占怎么办（一句话即可）

### ③ 这个站怎么组织的（半屏内）
- [ ] 内容：`src/content/{blog,note,story,gallery,pages}/`，一篇文章一个文件夹
- [ ] 站点数据：`src/data/{site,sections,categories,topics}.ts`
- [ ] 样式：`src/styles/tokens.css` 是唯一取值来源；`shell/facade/reading` 是版式
- [ ] 交互：`src/scripts/`（无框架，原生 DOM）
- [ ] 设计取舍与历史决策：`SPEC.md`（一句话指过去，别复制）

### ④ 写内容（放在最显眼的位置之一）
- [ ] front matter 最小示例（title/date/tags/summary/draft）
- [ ] 新建文章 → 粘图 → 附件 → 草稿转正 → 提交前自检：**指向 `docs/writing-a-post.md`**
- [ ] 图片放 `images/`、附件放文章根目录、文件名别带空格（三条硬规则）

### ⑤ 构建与发布
- [ ] `pnpm build` / `pnpm preview` / `pnpm verify` 各干什么
- [ ] 发布：GitHub Actions + `push.cmd`；Pages Source 要设成 GitHub Actions
- [ ] 改栏目 URL 要加 `redirects`（"URL 一旦发布不再改"）

### ⑥ 兼容与降级（这是本站的设计特色，值得写）
- [ ] 无 WebGL2 / 省流量 / `prefers-reduced-motion` 时哪些动效降级（CSS 静态画面兜底，内容不受影响）
- [ ] 无 JS 时：导航有 `<noscript>` 兜底，文章照常可读
- [ ] 目标浏览器基线（如果你自己定过，就写清楚，例如"近两年 Chrome/Safari/Firefox"）

### ⑦ 许可与致谢
- [ ] 代码许可（MIT，见 `LICENSE`）
- [ ] 字体授权：`public/fonts/` 里有 Cascadia Mono、Instrument Serif 的 OFL 文本；
      Smiley Sans（得意黑）的授权文本目前**没进仓库**，重写 README 时建议补一份或至少写明来源
- [ ] 评论：giscus（GitHub Discussions），需要 `.env` 配置

### ⑧ 排查（最多留 3–5 条，其余拆走）
- [ ] 只留最高频的：端口占用、图片路径、front matter 空值、旧链接 404
- [ ] 其余完整表格移到 `docs/troubleshooting.md`，README 留一行指针

---

## 2. 你这个仓库当前 README 的实际问题（重写时逐条处理）

| 问题 | 位置 / 证据 | 怎么处理 |
|---|---|---|
| 没有"这是什么站/在线地址/技术栈"，直接从目录表开始 | 开头 | 补 ① |
| 一级标题当章节用，`# 目录`、`# 编辑文章`……层级混乱；末尾还有 `## 十一、常见问题` 这种编号残留 | 全文 | 统一成 `##` 两级结构；删编号 |
| 引用了不存在的文件：`.env.example`、`src/content/pages/credits.md` | "评论功能"、"目录"表 | 核实后改成本仓库真实路径（现在只有 `.env`；pages 下只有 about/links）|
| "见第七节"但 README 里没有第七节 | "首页第一屏的动效"那行 | 删掉或改成 `SPEC.md` 链接 |
| 示例目录名过期：`src/content/blog/20261025-WHUCTF-2026-wp/` | "插入图片" | 换成现名 `WHUCTF2026-misc-wp/`（或直接不写具体文章名）|
| 链接没写协议：`[我的博客网站](badbadsheep.github.io)` | Markdown 语法示例 | 改成 `https://...`，或把整节 Markdown 教程移到 `docs/` |
| 有整段 Markdown 语法教程（斜体/粗体/删除线…） | "常见语法" | 移到 `docs/markdown-cheatsheet.md`，README 只留 `docs/writing-a-post.md` 指针 |
| 构建报错对照表很长（20+ 行） | README 后半 | 拆到 `docs/troubleshooting.md`，README 留 3 条高频 + 指针 |
| 没有截图、没有许可证说明、没有目录结构图 | — | 补 ①、③、⑦ |
| 结尾 `welcome to my world!` | 文末 | 可留可删；别当正文 |

---

## 3. 写完自检清单

- [ ] 从没来过的人照着"快速开始"能在 5 分钟内把站跑起来
- [ ] 每个 `docs/...` 链接都真实存在（点一遍）
- [ ] 每个命令都真跑一遍（尤其 `pnpm verify`）
- [ ] 全文没有一个"AI 腔"的空话；每句话都是可验证的事实
- [ ] 长度控制在 150–250 行；超了就把细节挪进 `docs/`
- [ ] 最后一节是"去哪看更多"（docs / SPEC / LICENSE），而不是感叹句
