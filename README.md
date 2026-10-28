# badbadsheep's blog


# 目录

| 内容| 路径 |
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

# 编辑文章

按照以下markdown格式写即可（也可以复制一份_template）

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

## 常见语法

斜体 (Italic)
*文字* 或 _文字_

粗体 (Bold)
**文字** 或 __文字__

粗斜体 (Bold + Italic)
***文字*** 或 ___文字___

删除线 (Strikethrough)。
~~文字~~(左右两个~~)

行内代码 / 等宽字体 (Inline Code)
`用单反引号括起来即可`


 高亮 (Highlight)
语法：==文字==


对话链接：
**[我的博客网站](badbadsheep.github.io)**



## 插入图片

图片储存在 `src/assets/images/`，正文里用相对路径引用：

```markdown
![](../../assets/images/xxx.png)
```

如果想要并排放置两张图片，用一个 `div` 把图片包起来：

**并排 + 整体再缩到 xx %**：

```markdown
<div class="figures w-xx">

![](../../assets/images/a.png)

![](../../assets/images/b.png)

</div>
```

**单张缩放**（等比，居中）：

```markdown
<div class="figures w-66">

![](../../assets/images/a.png)

![](../../assets/images/b.png)

</div>
```

可用的宽度：`w-25` `w-33` `w-40` `w-50` `w-60` `w-66` `w-75` `w-90`。

手机屏（< 768px）下并排会自动变成上下堆叠，宽度类在 60% 以上的一律恢复 100%，
免得小屏上挤成两条缝。

---

## 如何彻底删掉一篇文章

下面的操作每一步都不能漏：

**1. 删掉文件**

```powershell
Remove-Item src\content\note\要删的那篇.md
```

**2. 清掉图片**

```powershell
pnpm images:unused
```

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

---

# 评论功能

评论区用 giscus，存进 GitHub Discussions。配置：

```powershell
Copy-Item .env.example .env
```

只在博客 / 笔记 / 故事的文章页出现，作品页没有。

在github登录就可以发表评论辣~

---

# 构建与自检

```powershell
pnpm verify    # 一条命令过关：字体子集 → 图片引用 → 类型 → 构建 → 死链
pnpm build     # 只构建（会先重建字体子集）
pnpm preview   # 预览产物（和线上最接近）
pnpm check     # 只查类型与 front matter
pnpm links     # 只查链接（需要先 build）
pnpm images    # 只查图片引用（不用 build，秒出）
```
---

# 改栏目 URL

只改 `src/data/sections.ts` 里的 `url` 字段，路由是动态生成的，不用挪文件。

若旧地址已经发布过，必须在 `astro.config.mjs` 里加 `redirects` —— 否则旧链接直接 404，违反"URL 一旦发布不再改"。

---

# 推送 GitHub 与部署

运行push.cmd即可

手动做，等价于：

```powershell
git remote add origin https://github.com/badbadsheep/badbadsheep.github.io.git
git push -u origin main
```

# 推送报错对照

| 报错 | 原因与处理 |
|---|---|
| `fatal: not a git repository` | 不在工程目录，或仓库没初始化。双击 `push.cmd` 会自动处理 |
| `Authentication failed` / `403` | 凭据过期。控制面板 → 凭据管理器 → Windows 凭据 → 删掉 `git:https://github.com`，再推一次重新登录 |
| `Updates were rejected because the remote contains work…` | 远程有别人的提交（同一祖先）。脚本会自动 rebase 重试；还失败就手动解决冲突 |
| 脚本报「远程的 main 和本地没有共同祖先」 | 这个地址上是个无关的旧仓库。旧站不要了用 `push.cmd -Force`；想留着旧历史就 `git pull --allow-unrelated-histories origin main` |
| 仓库卡在 rebase／一堆 `AA` 冲突 | 上次 rebase 没做完。`git rebase --abort` 回到 rebase 之前，再决定走法；不要在上面继续叠操作 |
| `The batch file cannot be found.` | rebase 重写了工作区，把正在运行的 `push.cmd` 自己切走了。**不是错误**，真正要看的是它上面那几行冲突提示 |
| `Multiple versions of pnpm specified` | `deploy.yml` 里又写了 `version:`。pnpm 版本只由 `package.json` 的 `packageManager` 决定 |
| `Invalid workflow file … No event triggers defined in 'on'` | `on:` 被写坏了，见 10.4 |
| `Deploy` 在 `configure-pages` 报错 | Pages 的 Source 还没设成 GitHub Actions，见 10.3 |


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

welcome to my world!
