# 参与这个仓库

这是**一个人的静态博客**，不是招募协作的开源项目。欢迎的是「哪里坏了」的具体报告，
不接「把首页改成 XX 风格」这类大改 —— 不是因为不好，是因为站点的取舍已经记在
[SPEC.md](SPEC.md) 里了，改一处会牵动别处。

动手之前请读一遍 [README.md](README.md)。那里面写了哪个文件管哪件事，
比任何一份通用说明都准。

---

## 报一个问题

用 [Issue 模板](https://github.com/badbadsheep/badbadsheep.github.io/issues/new?template=bug_report.yml)
开 issue，或者直接发邮件到 **3360421858@qq.com**。

一条能用的报告至少要有：**出问题的地址 + 浏览器与系统 + 期望什么 / 实际什么**。
只有「打不开」三个字的报告，我没法复现，只能来回问。

文章里的错别字、事实错误也走邮件，不必开 issue。

---

## 本地跑起来

需要 **Node ≥ 22.22** 和 **pnpm ≥ 9**（版本差距太大会被 `engines` 拦下来）。

```powershell
pnpm install
pnpm dev        # http://localhost:4321
```

不想开终端就双击根目录的 `dev.cmd`。它自己 `cd` 到文件所在目录，从哪双击都跑对工程。

---

## 提交之前

**一条命令：**

```powershell
pnpm verify
```

它按顺序做五件事，任何一步失败就停：字体子集 → 图片引用 → 类型检查 → 构建 → 死链检查。
这就是部署流水线里跑的同一套东西（见 `.github/workflows/deploy.yml`），本地过了线上才过。

也可以双击 `check.cmd`，等价。

### 几条硬规矩

| 规矩 | 为什么 |
|---|---|
| **URL 一旦发布不再改** | 改了就在 `astro.config.mjs` 的 `redirects` 里补一条旧地址 → 新地址，别让旧链接 404 |
| **新写中文标题，跑 `pnpm fonts`** | 中文展示字体是按「源码里出现过的字」切的子集，不跑新字会回落到宋体，一个标题里两种字体 |
| **正文图片用相对路径 `../../assets/images/x.png`** | 从 `src/content/<栏目>/x.md` 到 `assets/` 正好是 `../../`，构建时会转 WebP 并带上宽高 |
| **`slug` 必须和文件名一致** | 不一致等于换网址，`astro check` 里是硬报错 |
| **代码块语言标记要小写** | `c` / `js` / `powershell`，写 `C` 会退化成纯文本 |

---

## 不要提交的东西

`.gitignore` 已经挡住了，列在这里是为了万一：

- `dist/`、`.astro/` —— 构建产物，重建就有
- `.env` —— giscus 的仓库 ID 与分类 ID，属于本机配置（模板见 `.env.example`）
- `public/fonts/smiley-sans-subset.woff2` —— 构建期从 `scripts/fonts-src/` 的源字体切出来的成品
- `.shots/` —— 本地截图自检

**源字体 `scripts/fonts-src/SmileySans-Oblique.otf`（约 1.9MB）要提交**。
它是子集的输入，CI 上没有它就跑不了 `pnpm fonts`，流水线第一步就挂。

---

## 提交信息

不强制规范，但请让一句话能读出来改了什么：

```
修复：移动端目录遮挡正文
内容：新增《C 语言基础》
样式：收紧列表项间距
依赖：astro 7.4.0 → 7.4.2
```

`chore(deps)` / `chore(ci)` 前缀留给 Dependabot 的自动 PR。

---

## 分支与合并

个人站，直接在 `main` 上提交是常态。要试大改动就开分支，验证过再合 ——
`deploy.yml` 的触发条件目前**故意只有手动**，所以推上去不等于上线，
什么时候上线由 `workflow_dispatch` 那一下决定。

---

## 许可证

代码是 [MIT](LICENSE)。**文章、图片、字体之外的原创内容不在此列**，版权归作者所有 ——
想转载某一篇，发邮件问一声就行。
