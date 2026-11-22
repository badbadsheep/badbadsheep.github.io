# 写一篇文章

从空白到上线，完整走一遍。**一篇文章 = 一个文件夹**，图和附件都躺在里面，正文用 `./` 引用。

---

## 0. 三十秒版

```powershell
# 1. 新建（会在 src/content/blog/<slug>/index.md 生成草稿）
.\scripts\new.ps1 "标题写这里" -Section blog -Tags "CTF,Misc"

# 2. 写正文；图片直接 Ctrl+Alt+V 粘贴，会自动落到 images/ 并插入 ![](images/文件名)

# 3. 本地看效果（草稿也看得到）
pnpm dev

# 4. 提交前自检
pnpm verify

# 5. 发布
.\scripts\new.ps1 -Publish -Slug <文件夹名>
```

---

## 1. 新建：文件夹名就是网址

`scripts/new.ps1` 会在 `src/content/<栏目>/<slug>/index.md` 建一篇草稿，并直接用 VS Code 打开。

| `-Section` | 目录 | 网址 | 模板 |
|---|---|---|---|
| `blog` | `src/content/blog/` | `/blogs/<slug>/` | 博客 |
| `note` | `src/content/note/` | `/notes/<slug>/` | 笔记 |
| `story` | `src/content/story/` | `/stories/<slug>/` | 故事 |
| `gallery` | `src/content/gallery/` | `/gallery/<slug>/` | 影像（要 `-Category` / `-Year`） |

```powershell
.\scripts\new.ps1 "ISCTF2026 Misc 方向题解" -Section blog -Slug isctf2026-misc -Tags "CTF,Misc"
```

- `-Slug` 不写会从标题里取 ASCII 部分；中文标题取不出来时会退化成 `blog-20261119-210000`
- **文件夹名 = 网址里的 slug**。改文件夹名等于换网址，已发布的链接就断了 —— 真要改，去 `astro.config.mjs` 的 `redirects` 里补一条
- 手动新建等价于：建 `src/content/blog/<slug>/` 目录，从 `src/content/blog/_template/index.md` 复制一份改名 `index.md`
- `images/` **不用手工建**：第一次粘贴图片时插件会自己创建（空目录在 git 里也留不住）

## 2. front matter

```yaml
---
title: 标题
date: 2026-11-19        # 必填，排序和归档都靠它
authors:
  - badbadsheep
tags: ["CTF", "Misc"]   # 可空；只有登记在 src/data/topics.ts 的标签会生成主题页
draft: true             # 草稿：本地可见，构建产物里没有
summary: 一句话摘要      # 不写会自动取正文首段前 120 字
---
```

- 日期写错格式（比如 `2026/11/19`）会在构建期报错，不是悄悄变成 1970
- `slug:` 字段可以省略；写了就必须和文件夹名一模一样，否则构建直接失败（防止悄悄换网址）
- 以 `_` 开头的文件夹（如 `_template`）不参与构建，可以当模板仓

## 3. 图片：Ctrl+Alt+V

粘图之后，图片落在**当前 md 同级的 `images/`**（目录不存在时插件会自己建），正文里插进去的是：

```markdown
![](images/2026-11-19-21-03-44.png)
```

文件名是粘贴时间戳，天然没有空格。**别手动改成带空格的名字** —— Markdown 的链接目标不能有空格，`pnpm images` 也不认 `%20`。

图片依然走 Astro 的资产管线：构建时转成 `/_astro/<文件名>.<hash>.webp`，并补上宽高和 `loading="lazy"`（所以不用手写尺寸；没有 srcset，单张 src 就够）。

并排 / 缩放用 `div` 包起来（路径同样带 `images/`）：

```markdown
<div class="figures w-50">

![](images/a.png)

![](images/b.png)

</div>
```

可用宽度：`w-25` `w-33` `w-40` `w-50` `w-60` `w-66` `w-75` `w-90`。

## 4. 附件：zip / 音频 / 抓包

直接把文件扔进同一个文件夹，正文写相对链接：

```markdown
[题目附件.zip](./题目附件.zip)
```

构建结束时会由 `scripts/lib/post-assets.mjs` 复制到 `dist/blogs/<slug>/`，所以线上路径和本地一样；`pnpm dev` 下则由中间件从源码直接读。**只有图片**走资产管线，其他文件是原样复制（不压缩、不改名）。

音频可以直接放播放器（Astro 会把裸 HTML 原样输出）：

```markdown
<audio controls src="./ham.ogg"></audio>
```

### 大文件别往仓库里塞

git 里的二进制是**永久**负担：删了也还在历史里，GitHub Pages 每次部署都要全量上传。经验线：

| 大小 | 建议 |
|---|---|
| < 5 MB | 直接放文章文件夹 |
| 5–20 MB | 放，但想一下读者真的需要原文件吗 |
| > 20 MB | 外置：GitHub Release 资产 / 对象存储，正文里写绝对 URL |

导出/导入时可以用 `--exclude` 先跳过，正文会留一行「未随文发布」的说明。

## 5. 代码块

围栏语言标记**必须小写**，否则 Shiki 不认（`C`、`Python`、`Plain Text` 都会退化成无高亮）：

- 常规：`c` `cpp` `python` `js` `ts` `bash` `powershell` `yaml` `json` `http` …
- 终端输出、十六进制转储这种没有语法的：写 `text`
- 显示名在 `astro.config.mjs` 的 `LANG_LABELS` 里改（`text` → 右上角显示 `Text`）

## 6. 数学公式

`$行内$` 和 `$$块级$$`，构建期用 KaTeX 渲染成静态 HTML，页面不加载数学 JS。

- 正文里真要写美元符号：`\$5`
- 单个不配对的 `$` 不会变公式，但**同一行出现两个就会被当成一对** —— 像 `192.168.56.88_C$` 这种，用反引号包起来写成 `` `192.168.56.88_C$` ``
- 块级公式放进列表项时要缩进 3 格
- 公式写错不会中断构建，终端会打 `[math]` 警告

## 7. 提示框与折叠

```markdown
<aside class="callout callout--tip" data-title="提示框">

正文。

</aside>

<details class="qa">
<summary>折叠的问题</summary>

点开才看到的答案。

</details>
```

## 8. 草稿 → 发布

- 新建的默认是 `draft: true`：`pnpm dev` 里能看到（列表带草稿标记），`pnpm build` 不包含
- 转正：`.\scripts\new.ps1 -Publish -Slug <文件夹名>`，或手动把 `draft: true` 改成 `false`

## 9. 提交前自检

```powershell
pnpm verify      # = 字体子集 → 图片引用 → 类型检查 → 构建 → 死链检查
```

也可以双击 `check.cmd`。这五步和 GitHub Actions 里部署跑的是同一套，本地过了线上才过。

单独跑某一步：

| 命令 | 查什么 |
|---|---|
| `pnpm images` | 正文里的图片引用是否都指向真实文件（构建期缺图会直接失败） |
| `pnpm images:unused` | 哪些图没有任何正文在用（换图/删文章的残留） |
| `pnpm links` | 构建产物里的站内死链（**附件链接也在这里查**） |
| `pnpm fonts` | 重建中文子集（新写了中文标题时跑一下，否则那几个字会回落到宋体） |

## 10. 删一篇文章

删掉整个文件夹就行 —— 图、附件、正文一起走。

```powershell
Remove-Item src\content\note\要删的那篇 -Recurse
```

再跑一遍 `pnpm build; pnpm links`，看有没有别的文章链到它。

---

## 附：从飞书文档搬一篇文章

`scripts/import-feishu.mjs` 把飞书导出的竞赛文档按「方向」切一篇出来，直接产出符合本仓库约定的文章：

```powershell
# 1. 解压飞书导出
Expand-Archive ISCTF2026.zip .tmp-isctf

# 2. 切一个方向
node scripts/import-feishu.mjs `
  --md .tmp-isctf/ISCTF2026.md `
  --assets .tmp-isctf/图片和附件 `
  --doc-section Misc `
  --content-dir blog `
  --slug isctf2026-misc `
  --title "ISCTF2026 Misc 方向题解" `
  --date 2026-11-19 `
  --tags "CTF,Misc" `
  --exclude "recovered.wav,192.168.56.88_C$" `
  --draft
```

它替你做的：

| 飞书的毛病 | 脚本怎么处理 |
|---|---|
| 全篇反斜杠转义（`\.` `\-` `\(` `\_` …） | 还原；表格行里的 `\|` 保留，否则表格散架 |
| `Plain Text` / `Python` / `C` 大小写乱 | 映射成 Shiki 认的小写名，`Plain Text` → `text` |
| 标题带 `\| Solved \| 谁谁` | 去掉状态列；解出者不是本人时折成一行斜体署名 |
| 图片是 `image 94.png`（带空格的全局编号） | 复制进文章文件夹的 `images/` 并改名 `img-094.png`，引用写成 `![](images/img-094.png)` |
| 同一个文件被上传两次（`ham.ogg` / `ham 1.ogg`） | 按内容哈希去重，两个链接指向同一份 |
| 几十 MB 的中间产物 | `--exclude` 跳过，原位留一行「未随文发布」 |

它**不做**的事（必须自己过一遍）：选题取舍、加图注、改章节顺序、检查 `$` 有没有和公式打架。
