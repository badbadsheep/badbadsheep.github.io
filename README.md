# badbadsheep

纯静态个人站。Astro 构建，无框架运行时，无后端。

## 0. 先确认文件夹

这个工程在 **`G:\badbadblog`**。

另一个 `G:\BadbadsheepBlog` 是**老仓库**（MkDocs + 老的 Astro 门面）：它的根目录**没有** `dev` 脚本，
在里面敲 `pnpm dev` 会报 `Command "dev" not found`；进它的 `web/` 起服务则只能看到首页，
因为那套门面本来就只管首页/归档/主题，文章页在 MkDocs 那边。**两个工程不是一回事。**

```powershell
cd G:\badbadblog
pnpm dev        # http://localhost:4321
```

不想开终端就**双击 `dev.cmd`** —— 它自己 `cd` 到文件所在目录，从哪双击都跑对工程。
双击 `check.cmd` 是发布前的一次性全检（字体 → 类型 → 构建 → 死链）。

---

## 一、目录速查

| 你想改的东西 | 去哪 |
|---|---|
| 文章 / 笔记 / 故事 | `src/content/blog/` `src/content/note/` `src/content/story/` |
| 影像作品 | `src/content/gallery/` |
| 关于 / 致谢 | `src/content/pages/about.md` `credits.md` |
| 站名、邮箱、GitHub、一句话 | `src/data/site.ts` |
| 栏目名、栏目 URL、每条几篇 | `src/data/sections.ts` |
| 作品分类 | `src/data/categories.ts` |
| 主题（会生成聚合页的标签） | `src/data/topics.ts` |
| 任何颜色、字号、间距 | `src/styles/tokens.css`（**唯一取值来源**） |
| 首页第一屏 | `src/components/facade/Hero.astro` + `src/styles/facade.css` |
| 首页第一屏的动效 | `src/scripts/art/index.ts`（现在是空的，见第七节） |
| 文章页排版 | `src/styles/reading.css` |

设计约定与取舍记录在 [SPEC.md](SPEC.md)。

---

## 二、写一篇

### 用脚本（推荐）

```powershell
.\scripts\new.ps1 "文章标题" -Section note -Tags "环境配置,MkDocs"
```

会自动建好文件（填好 front matter 和草稿标记）并在 VS Code 里打开。

四个栏目：`-Section blog` / `note` / `story` / `gallery`。
作品多三个参数：`-Category painting|video|interactive|project -Year 2026 -Medium 数字绘画`。

### 手写

在对应目录新建 `<slug>.md`。文件名就是网址最后一段，**只用小写英文、数字、连字符**。

```yaml
---
title: 标题
date: 2026-10-17
tags: []
draft: true
summary: 一句话摘要，会出现在列表与气泡里。
---
```

- `title` 可以不写：会取正文第一个 `#` 标题，再不行用文件名
- `summary` 可以不写：会取正文首段前 120 字
- `draft: true` 时本地可见、`pnpm build` 不包含

### 草稿转正式

```powershell
.\scripts\new.ps1 -Publish -Slug 文件名
```

### 排版会自动做这几件事（不用你管）

| 行为 | 触发条件 |
|---|---|
| 页面右侧出现目录 | 文章的 `##` / `###` 标题**多于 1 个**时自动出现，固定垂直居中，随滚动不动 |
| 代码块折叠 | 代码**超过 5 行**就折起，底部一个 `Unfold`；点开变 `Fold` |
| 代码工具条 | 每块代码自动带语言标签 + 复制按钮，行号用 CSS 生成（不进 HTML） |
| 图片灯箱 | 点正文图片全屏查看，ESC 关闭 |
| 上下篇 | 同栏目内按日期自动接上 |
| 阅读时长 | 按 350 字/分钟估算，代码块不计入字数 |

这些都是构建/加载时自动加上的，**不需要在 Markdown 里写任何东西**。

---

## 三、图片

图片放 `src/assets/images/`，正文里用**相对路径**引用：

```markdown
![](../../assets/images/xxx.png)
```

从 `src/content/<栏目>/x.md` 到 `src/assets/images/` 正好是 `../../`，所以这一行永远是这么写。
构建时会自动转 WebP 并带上宽高（不会跳版）。

在 VS Code 里装 **Markdown Image**（或 Paste Image）插件，`Ctrl+Alt+V` 直接粘贴截图落盘。

图标、头像、字体这类"要一个稳定网址"的东西放 `public/`。

---

## 四、标签与主题页

`tags` 随便写，不会报错。但只有登记在 `src/data/topics.ts` 里的标签才会生成 `/topics/<slug>/` 聚合页 ——
因为中文标签直接进网址会变成 `%E4%B8%AD` 那种长串，必须你指定 ASCII slug。

没登记的标签在文章页显示为不可点的纯文本（不制造死链）。

---

## 四·五、彻底删掉一篇文章

删文件只是第一步。漏掉下面任何一步都会留下"看得见的残留"或"看不见的垃圾"。

**1. 删掉文件**

```powershell
Remove-Item src\content\note\要删的那篇.md
```

**2. 清掉只被它引用的图片**

```powershell
pnpm images:unused
```

它会列出 `src/assets/images/` 里没有任何正文引用的图。确认那几张确实是这篇独占的，再删。
（反过来用的 `pnpm images` 是查"引用了不存在的图"，别搞混。）

**3. 处理旧链接（如果那个地址发布过）**

删掉的内容旧地址会 404。要不要保：

- 想保住 → 在 `astro.config.mjs` 的 `redirects` 加一条，指向栏目页或归档：
  `'/notes/要删的那篇/': '/notes/'`
- 不在乎 404 → 跳过这步

**4. 检查有没有别的内容链到它**

```powershell
pnpm build
pnpm links
```

如果别的文章正文里写了 `[...](/notes/要删的那篇/)`，这里会报死链并指出文件行号。

**5. 一次过全查**

```powershell
pnpm verify
```

搜索索引、RSS、sitemap、归档、栏目计数、首页气泡 —— **全都是构建期从内容目录现算的，不用手工改任何地方**。

> 唯一的例外：`src/data/topics.ts` 里登记过的主题。如果删掉的那篇是某个主题唯一的文章，
> 那个 `/topics/<slug>/` 聚合页会变成空页（不报错，但难看）。要么删掉那条登记，要么留着等下一篇。

---

## 五、评论

评论区用 giscus，存进 GitHub Discussions。配置：

```powershell
Copy-Item .env.example .env
```

到 https://giscus.app 选仓库与分类，把四个值填进 `.env`。
四项齐全评论区才会出现；否则页面底部显示一条说明（不会加载任何第三方脚本）。

只在博客 / 笔记 / 故事的文章页出现，作品页没有。

---

## 六、字体

- 拉丁展示字体：Instrument Serif（`public/fonts/`，OFL）
- 中文展示字体：得意黑子集（`public/fonts/smiley-sans-subset.woff2`，OFL）
- 正文：系统字体，不下载网络字体

**新增中文标题后跑一次：**

```powershell
pnpm fonts
```

它会扫描界面文案与所有标题里用到的字，重新切子集（当前约 56KB）。
忘了跑也不会出错 —— 那些字会回落到系统宋体（不会出现豆腐块）。

---

## 七、首页第一屏的动效（现在是空的）

第一屏现在渲染的是纯 CSS 静态几何构图。它**不是临时占位**：
WebGL 不可用、`prefers-reduced-motion`、省流量模式下都会落到它身上，所以它要长期留着。

接动效只做两件事：

1. 新建 `src/scripts/art/my-scene.ts`，导出一个满足 `SceneFactory` 的函数
   （接口见 `src/scripts/art/index.ts` 顶部注释）
2. 在同文件的 `REGISTRY` 里登记：`REGISTRY.default = createMyScene;`

档位判定、DPR、resize、页面隐藏暂停、指针与滚动采样、上下文丢失降级、`<canvas data-art>` 挂载 —— 都已经写好了。

---

## 八、构建与自检

```powershell
pnpm verify    # 一条命令过关：字体子集 → 图片引用 → 类型 → 构建 → 死链
pnpm build     # 只构建（会先重建字体子集）
pnpm preview   # 预览产物（和线上最接近）
pnpm check     # 只查类型与 front matter
pnpm links     # 只查链接（需要先 build）
pnpm images    # 只查图片引用（不用 build，秒出）
```

`pnpm links` 替代了原来 `mkdocs build --strict` 干的事：正文里引用了不存在的图片或页面，它会直接报错并指出文件和行号。**发布前跑一次。**

`pnpm images` 是构建前的一道前置：图片不存在时 Astro 只会甩一个 `ImageNotFound` 然后整站失败，
这个脚本会提前告诉你「哪个文件第几行指向哪张不存在的图」。

`pnpm build` 会自动先跑 `pnpm fonts` —— 字体子集是构建产物、不进仓库，所以这一步不能忘也不能省。

---

## 九、改栏目 URL

只改 `src/data/sections.ts` 里的 `url` 字段，路由是动态生成的，不用挪文件。

若旧地址已经发布过，必须在 `astro.config.mjs` 里加 `redirects` —— 否则旧链接直接 404，违反"URL 一旦发布不再改"。

---

## 十、部署

`.github/workflows/deploy.yml` 已经写好了，但**触发条件故意只有手动**（`workflow_dispatch`），
免得你还没准备好就被推上线。要上线时：

1. 仓库 Settings → Pages → Source 选 **GitHub Actions**
2. 把 `deploy.yml` 里的 `on:` 改成 `push: branches: [main]`
3. 第一次手动跑一次看看

流水线顺序是：装依赖 → 字体子集 → 类型检查 → 构建 → **死链检查**（这一步挂了就不部署）。

`dist/` 是纯静态产物，放任何静态托管都能跑（Vercel / Cloudflare Pages / 自己的服务器）。

---

## 十一、常见问题

**构建报 `ImageNotFound` / `Could not find requested image`**
正文里有一个**活的**图片链接指向不存在的文件。先跑 `pnpm images`，它会直接列出「哪个文件第几行 → 哪张图」。
最常见的来源是模板里的示例链接 —— 所以模板里的示例必须写在代码块里（用 ` ```markdown ` 包起来），
不然你复制模板的那一刻，构建就挂了。

**构建报 `Expected type "string", received "object"`**
front matter 里有一行**只写了键、没写值**（例如 `summary:` 后面空着）。
YAML 读到的是 `null`，而 `typeof null === 'object'`，所以报错写成"收到对象"，极具误导性。
现在空字段已经统一按"没写"处理；真看到这条，去把那行补上值或整行删掉。

**把文章从 blog 挪到 story 之后，旧链接怎么办**
在 `astro.config.mjs` 的 `redirects` 里加一条：旧 `/blogs/xxx/` → 新 `/stories/xxx/`。
构建时会生成跳转页，旧链接不会死。这是「URL 一旦发布不再改」的补丁，别省。

**`pnpm dev` 报 `Command "dev" not found`**
你不在 `G:\badbadblog` 里。见本文开头第 0 节。

**`pnpm dev` 起得来，但点进文章 404**
同上：那是老仓库 `web/` 里的旧门面，不是这个工程。

**构建报 `slug 与文件名不一致`**
front matter 里的 `slug` 必须和文件名一样。改 slug 等于换网址，会让旧链接失效 —— 所以这里是硬报错。

**代码块没有高亮**
语言标记要小写：`c`、`js`、`powershell`。写成 `C`、`JS` 会退化成纯文本。

**新增的中文标题字形不统一**
跑 `pnpm fonts`（或者直接 `pnpm build`，它会自动跑）。

**搜索搜不到刚写的文章**
`astro dev` 里索引是每次请求现算的；如果开着旧的页面没刷新，刷新一下。

**评论区一片空白**
`.env` 里四项没填全，或者仓库没开 Discussions。

**`.\scripts\new.ps1` 报一堆语法错误 / 中文乱码**
这个文件是 **UTF-8 带 BOM** 存的。如果你用别的工具重新保存过它、把 BOM 弄掉了，
Windows PowerShell 会按 GBK 读，中文串会把引号截断、整个脚本解析失败。
用 VS Code 存回「UTF-8 with BOM」即可。

**端口被占（`Port 4321 is in use`）**
之前起的 dev / preview 还在跑。关掉那个窗口，或者 `pnpm dev --port 4400` 换一个。
（我被自己这个坑过一次：占着端口测出来的页面其实是构建产物，不是 dev。）

---

## 十二、仓库文件与许可证

除了源码，根目录还放了这些"让仓库像个正经项目"的文件：

| 文件 | 管什么 |
|---|---|
| `.gitattributes` | 换行符：仓库里存 LF；`*.cmd` 强制 CRLF、`*.ps1` 保持 LF + BOM |
| `.editorconfig` | 编辑器约定（缩进 2 空格、UTF-8、Markdown 不删行尾空格） |
| `CONTRIBUTING.md` | 提交前跑什么、几条硬规矩、哪些东西不许提交 |
| `LICENSE` | MIT |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 自查清单（含"改 URL 要补 redirect"这类容易漏的） |
| `.github/ISSUE_TEMPLATE/` | 站点问题报告表单 |
| `.github/dependabot.yml` | 依赖每周升级开 PR（需在 Settings → Code security 里开启 Dependabot） |

**许可证**：代码是 [MIT](LICENSE)。**文章、图片及其它原创内容不在 MIT 范围内**，
版权归作者所有 —— 想转载某一篇，发邮件问一声就行。

提交前要跑的检查、以及为什么这么定，见 [CONTRIBUTING.md](CONTRIBUTING.md)。

