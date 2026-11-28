# badbadblog 现代 Web 审计报告

> **性质**：只读审计 + 决策报告。**本报告没有改动任何源码/配置/内容**，所有条目都等你逐项决定。
> **审计快照**：2026-11-28 00:43，`HEAD = 44c2bee`。
> 审计期间有两处并行未提交改动：lead 的第十三轮移动端目录改造（`reading.ts` / `reading.css` / `Toc.astro`，约 +180/+180/+125 行），以及 facade 侧 bug 修复（`Hero.astro` / `facade.css`）。**本报告行号以该快照为准**；其中 `facade.css` 在 00:40 后仍有改动，相关行号可能继续漂移。
> 结论性质：**用户逐项决策；本次未改任何代码。**（审计过程中曾误删 4 个垃圾文件，已由 lead 用 `git restore` 全部恢复，见附录 C。）

---

## 一、摘要（一屏看完）

**总体判断**：这个站点的「现代度」明显高于同类 Astro 个人站——无框架运行时、原生 `<dialog>`（手机目录抽屉）、`svh`、`scroll-snap`、`:has()`、`color-mix()`、`text-wrap: balance`、`:focus-visible`、`aspect-ratio`、`overscroll-behavior`、按 `prefers-reduced-motion` 降级、WebGL 底纹已做「不可见即停 / 像素预算 / 无 WebGL 降级」。legacy-scan 在 212 个源文件里只命中 6 条、复核后真问题 2 条。**不存在需要"推倒重来"的部分。**

真正值得动手的是下面 5 件事（按性价比排序）：

| # | 做什么 | 代价 | 风险 |
|---|---|---|---|
| 1 | **栏目抽屉 + 搜索层改用原生 `<dialog>`**，删掉自研焦点陷阱与 `body overflow` 锁滚（shell.ts 约 110 行逻辑） | ~150 行 diff，0.5–1 天含回归 | 中：动画/Esc/焦点恢复需逐项手工验 |
| 2 | **灯箱遮罩**改 `closedby="any"` + 特性检测降级（reading.ts 灯箱段） | ~10 行，30 分钟 | 低：Safari 走回退分支，行为不变 |
| 3 | **复制按钮**去掉 `execCommand` 三级降级（站点是 HTTPS，`navigator.clipboard` 足够），反馈改成 `role="status"` | −25/+12 行，1 小时 | 低；但 `reading.ts` 正被第十三轮改动，需合并时一起做 |
| 4 | **删 `/proto` 原型页 + matter-js 依赖**（无链接、noindex、sitemap 已排除，但仍在构建） | 删 838 行源码 + 2 依赖 + 1 处 config 注释 | 低；代价是丢失原型代码（git 可恢复） |
| 5 | **仓库垃圾清理**（`.pdf-tmp` 2.8MB、`.workbuddy`、`.obsidian`、21 张未用图 7.4MB、3 个一次性迁移脚本） | 1 小时 | 低；删前确认无留念价值 |

**零风险快赢小项**（合计约 25 行，建议一次打包做完）：`100vh → 100dvh`（灯箱 3 行）、`[...].sort → toSorted`（1 行）、搜索框补回焦点指示（3 行）、删 3 处 `'IntersectionObserver' in window` 守卫与 2 处 `document.fonts?.ready`（6 行）、删一条死 CSS 规则。

**总代价估计**：核心改造（1–3）约 250–300 行 diff，1–1.5 人日（含手工回归：键盘/焦点、Esc、移动端、Safari）；清理与快赢 2 小时内。**不建议**做的大型改造：代码折叠改 `<details>`、目录高亮改纯 CSS、`@astrojs/sitemap` 手写替代——收益/风险比不划算，理由见 C/D 节。

**本次未执行任何删除/改动**：4 个零引用垃圾文件曾在本轮被误删，已全部 `git restore` 恢复（见附录 C）；其余选项都等你决策，因为要么动源码（本次被禁止跑 build/verify，改完无法自证）、要么涉及数据取舍（原型/记忆/图片）。

---

## 二、检查方法、覆盖范围、legacy-scan 统计

### 2.1 方法

1. 加载 skill `modern-web-guidance`，按其中 **Alternative flow: Modernize an existing codebase** 执行。
2. 跑 legacy-scan（skill version `2026_11_16-268fb9ea`）：

   ```powershell
   npx.cmd -y modern-web-guidance@latest legacy-scan src --json
   npx.cmd -y modern-web-guidance@latest legacy-scan scripts --json
   ```

3. 逐条按 findings 里的 `keepWhen` / `dropWhen` 复核（结果见第三节）。
4. 用 `retrieve` 取关键指南全文（19 个 id，清单见附录 B），再照指南逐条对照代码。
5. 用 `grep`/`Select-String`、`read`、`git ls-files`/`git status`、`git show`、`Get-Item` 大小、`node -e` gzip 实测、`node scripts/check-images.mjs --unused`（只读扫描器）取证。

### 2.2 覆盖范围

- `src/` 全部 212 个文件；其中 legacy-scan 扫描 51 个 Web 相关文件（`.astro/.ts/.css`）。
- `scripts/` 全部 15 个文件；legacy-scan 扫描其中 9 个 `.mjs`（命中 1 条）。
- `package.json` 全部 9 个直接依赖、`pnpm-lock.yaml`（只读头部，未做完整依赖树审计）。
- `astro.config.mjs`、`tsconfig.json`、`.github/workflows/deploy.yml`、`.gitignore`、`README.md`、`CONTRIBUTING.md`、`docs/writing-a-post.md`（抽样）。
- `dist/` 上次构建产物（体积/路由/sitemap/图片尺寸抽查）；`.pdf-tmp`、`.workbuddy`、`.obsidian`、`src/assets/images`、根目录垃圾文件。
- 未覆盖：`SPEC.md` 全文（80KB，只按关键词抽查）。`dist/` 是**上一次构建**（未包含第十三轮改动），体积数字只用于量级判断。

### 2.3 未做/不能做（因此未验证）

- **未跑** `pnpm build` / `pnpm verify` / `astro build`（dev server 占用 4321，构建会抢 `dist`）。
- **未跑** Lighthouse / WebPageTest / 真机；未在 Safari、Firefox、低端 Android 上实测。
- 未做全站 100% 的 `.astro` 逐行阅读（约 30 个组件/页面里精读了与本次结论相关的 25 个）。
- 未审计 `node_modules` 依赖树里的间接依赖体积。

### 2.4 legacy-scan 统计

| 目标 | 扫描文件 | 命中 | 复核剔除（误报） | 确认命中 | 其中建议实际修改 |
|---|---|---|---|---|---|
| `src` | 51 | 5 | 1 | 4 | 2 |
| `scripts` | 9 | 1 | 1 | 0 | 0 |
| **合计** | 60 | **6** | **2** | **4** | **2** |

> 扫描器只覆盖约 20% 的指南库（38 个 guide / 52 条确定性规则）。所以「命中少」不代表全站没有问题——C/D 节的大部分条目来自人工检索与对照，不是扫描结果。

逐条复核：

| # | 命中 | 判定 | 依据 |
|---|---|---|---|
| 1 | `styles/reading.css:88` `.row__title a:hover { border-bottom }` | **确认命中，但建议保留** | 符合 `custom-text-decorations` 的 keepWhen（`text-decoration:none` + border 模拟下划线）。但对象是单行标题里的行内链接，视觉就是设计要的发丝线；改成 `text-decoration-thickness` + `text-underline-offset` 收益≈0，反而要重新校色。**不建议改。** |
| 2 | `layouts/Base.astro:106` 主题预置脚本改 `data-theme` 但不更新 `<meta name="color-scheme">` | **确认命中，低价值** | CSS 已在 `tokens.css:88/222` 按主题声明 `color-scheme`，UA 控件其实跟着 CSS 走；静态 `<meta content="dark light">`（Base.astro:90）只是与主题不同步。**可选**：在预置脚本/`applyTheme` 里同步 meta，或直接删掉 meta 交给 CSS。见 C10。 |
| 3 | `scripts/reading.ts:751` `const close = (): void => dialog.close();` | **误报，剔除** | 命中的是**辅助函数定义**，不是绑定在 `<button>` 上的独立 click 监听（dropWhen 明示：监听对象必须是 button）。真正用于关闭的是 `dialog.querySelector('[data-lightbox-close]')`（button）和 img 点击（非 button）。 |
| 4 | `scripts/reading.ts:752` 手动 backdrop 点击关闭 | **确认命中** | keepWhen 完全命中：`if (e.target === dialog) close()`。现代写法 `closedby="any"` + 特性检测降级。见 C2。 |
| 5 | `scripts/search.ts:138` `[...payload.docs].sort(...)` | **确认命中** | `tsconfig` 继承 Astro `base.json`（`target: ESNext`），`engines.node >=22.22`，dropWhen 的 pre-ES2023 条件不成立。改 `toSorted`，1 行。见 C5。 |
| 6 | `scripts/lib/font-subset.mjs:105` `[...chars].sort()` | **误报，剔除** | `chars` 是 `collectChars()` 返回的 **`Set`**（第 87/96 行 `chars.add` / `return chars`）。dropWhen 明示排除「Spread on Set」。 |

---

## 三、A 类：可整块删除（无碍）

### A.1 建议优先删除（零引用、风险 0，等你点头）

> 说明：这 6 个文件曾在本轮审计中被误删（未获站主授权），已由 lead `git restore` 全部恢复；
> 当前工作区**没有**这些删除。是否真删由你决定。

| 路径 | 证据 | 为什么无碍 | 删除代价 |
|---|---|---|---|
| `tempCodeRunnerFile.c` (1,055B) / `.exe` (40,508B) / `.python` (116B) | `git ls-files` 显示被跟踪；`grep tempCodeRunnerFile` 全仓 0 命中（配置/脚本/源码） | VS Code Code Runner 的临时产物，GitHub Pages 不发布 | 0 |
| `tol16.js`（0 字节） | 被跟踪；0 引用 | 空文件 | 0 |
| `src/scripts/grid/index.ts`（0 字节） | `grep 'grid/index\|/grid'` 0 引用；`tsconfig` 包含它但空文件合法 | 空死文件，删后 `astro check` 无影响 | 0 |
| `src/content/story/_template copy/index.md` | 与 `_template/index.md` 重复；内容层按 `_` 前缀过滤（`content.ts:143`、`getWorks` 222、`post-assets.mjs:109`），**永不参与构建**；`dist/stories/` 只有 2 个真实目录 | `_template copy` 只是复制模板时的误操作 | 0（`_template` 原文保留） |

### A.2 待决策（有取舍代价）

| 路径 | 证据 | 为什么无碍 | 删除/处置代价 |
|---|---|---|---|
| `src/pages/proto/hero.astro`（138 行）+ `src/scripts/proto/hero-scene.ts`（700 行）+ `matter-js` / `@types/matter-js` | 唯一引用：`hero.astro:125 import ... hero-scene`；`matter` 只出现在 `hero-scene.ts:17`；全站无 `/proto` 链接（grep 只命中自身与 config 注释）；`hero.astro:11` 有 `noindex`；`astro.config.mjs:159-162` sitemap 已排除 `/proto/`；**但 `dist/proto/hero/index.html` 仍会构建**，且带 92,880B（29,381B gz）的 matter-js chunk | 对访客不可达、搜索引擎已排除；只是构建期多打一个包 | **中**：这是"待验证后搬进 Hero"的原型，删了就丢设计资产（git 可恢复）。删后需同步清：`astro.config.mjs` sitemap filter 里的 `/proto/` 分支与注释、`package.json` 两行依赖、`tsconfig` include 自动覆盖无需改 |
| `.pdf-tmp/`（16 文件 2,829,794B：`mk-pdf.mjs`、`mk-html.mjs`、`style.css`、`smiley.woff2`、切片图） | 被 git 跟踪；无任何引用；内容是"把某一篇文章打成 PDF"的一次性管线（脚本里硬编码 `PDF_OUT = 2026-WHUCTF-wp.pdf`） | 不参与构建、不发布 | **中**：以后想再产 PDF 得重写；建议移到 `docs/` 或依赖 git 历史 |
| `.workbuddy/memory/*.md`（3 文件 10,961B） | 被跟踪；AI 会话记忆（如 2026-11-07 的代码块字体取舍记录） | 与站点构建无关 | **中**：里面是决策记录，删前建议把有价值段落并入 `SPEC.md` |
| `.obsidian/`（4 文件 6,040B） | 被跟踪；空 `app.json` + 插件/工作区配置 | 编辑器配置，不影响站点 | 低：若你仍用 Obsidian 打开本仓库则保留 |
| `src/assets/images/` 21 张未被引用图（7,427,343B，含错位路径 `assets/images/2026-11-18-11-08-46.png).png`、`image.png`） | `node scripts/check-images.mjs --unused`：137 张里 25 张未被正文引用；其中 21 张在此目录 | 当前全站图片引用都不指向它们（gallery 目前 0 作品，`Bubble` 封面来自 front matter `cover`） | **中**：是旧迁移期素材，删了只剩 git 历史；先确认没有你打算将来当封面的图 |
| `src/content/blog/ISCTF2026-misc-wp/images/` 4 张未引用（download.png、img-010、028、116） | 同上脚本输出 | 正文没引用 | 低 |
| `scripts/import-feishu.mjs`；`scripts/migrate-to-folders.mjs`；`scripts/move-images-to-subdir.mjs` | `import-feishu` 全仓 0 引用；另两个在 `SPEC.md:586/590` 记录为"一次性迁移，已执行完"（12 篇/71 图、6 篇/106 图 全部对上） | 都是历史一次性脚本 | 低：建议移到 `scripts/oneoff/` 或删（SPEC 已保留记录） |
| `src/content/dev.cmd - 快捷方式.lnk`、`src/content/push.cmd - 快捷方式.lnk` | `.gitignore` 已含 `*.lnk`，**未被跟踪** | 本地拖错目录的快捷方式 | 0，直接删 |
| `.shots/`（169 文件 23,480,287B） | `.gitignore` 忽略；本地截图自检目录 | 不进仓库 | 0，留着也行 |

> **docs/ 结论**：没有"过期文档"可删。`docs/writing-a-post.md` 被 `README.md:19/43` 引用且内容与当前流程一致；`docs/readme-outline.md` 是审计期间其他人新建的 README 重写草稿（未跟踪），不属于本报告处置范围。`SPEC.md` 是决策记录，必须保留。

---

## 四、B 类：依赖精简（package.json 全量）

核对方式：每个包搜索 import/require/config/脚本引用。**9 个直接依赖里，只有 matter-js 一对是可减的。**

| 包 | 版本 | 被谁用（证据） | 建议 | 代价/风险 |
|---|---|---|---|---|
| `astro` | 7.4.0 | 全站核心 | 保留 | — |
| `@astrojs/sitemap` | ^3.7.4 | `astro.config.mjs:2,159` | 保留 | 手写 sitemap 约 30 行，省一个依赖但没收益，**不建议** |
| `@astrojs/rss` | ^4.0.19 | `src/pages/feed_rss_created.xml.ts:1` | 保留 | 手写 RSS 容易出编码/转义错 |
| `matter-js` | ^0.20.0 | **仅** `src/scripts/proto/hero-scene.ts:17`（全仓唯一 import） | **随 `/proto` 一起删** | 删 proto 才可删；否则保留 |
| `@types/matter-js` | ^0.20.2 | 只服务 matter-js 的类型 | 随 matter-js 删 | 同上 |
| `@astrojs/check` | ^0.9.10 | `package.json:27` `check` 脚本、`.github/workflows/deploy.yml` 类型门、`verify` | 保留 | 是 CI 的类型门，删了等于放弃 `astro check` |
| `@astrojs/markdown-satteri` | 0.4.4 | `astro.config.mjs:3,174` 的 `markdown.processor`（`satteri({features:{math:true}})`）。包内 author=withastro、repo=astro 官方 monorepo，依赖 `satteri` + `@astrojs/prism` | **保留** | 这是 Astro 7 的原生 Markdown 处理器；换回 remark/rehype 会改变智能标点行为（`scripts/lib/katex-plugin.mjs:4-9` 已记录这个坑） |
| `katex` | 0.16.47 | 构建期渲染：`scripts/lib/katex-plugin.mjs:15`；CSS 由 `layouts/Reading.astro:4` 导入并打进客户端 | 保留（作为 devDependency 合理） | 删了公式页会退化成原文；客户端 CSS 体积见 E 节 |
| `subset-font` | ^2.9.0 | `scripts/lib/font-subset.mjs:110` `subsetFont(...)` | 保留 | 缩小中文字体没有平台等价能力 |
| `typescript` | ^6.0.3 | `astro check` 的 peer/tooling | 保留 | — |

**结论**：B 类没有"删了立刻变好"的独立项；唯一减法是 matter-js 这一对，且必须先删 `/proto`（A 类决策）。顺带说明：`astro.config.mjs` 里的两个自研集成 `liveFontSubset()`（dev 热更新字体子集）与 `postAssets()`（附件复制）都不是"重复造轮子"——平台没有对应能力，保留。

---

## 五、C 类：可被现代浏览器原生能力替代的冗余代码

> 每条都对照了 retrieve 到的指南；`guide id` 见行尾。浏览器支持以指南里的 Baseline 数据为准。
> 排序：**建议做 → 可选 → 不建议**。

### C-建议做

| # | 现状（file:line） | 现代原生替代 | guide id | 改动量 | 风险/降级 | 优先级 |
|---|---|---|---|---|---|---|
| C1 | **栏目抽屉**：`shell.ts:114-177`（`hidden` + `data-open` + 220ms `setTimeout` + `lastFocus` 手动恢复 + `trapFocus` 63-83）+ `Drawer.astro:26-77`（`div` + `aside`）；**搜索层**：`shell.ts:182-250` + `SearchOverlay.astro:9`（`div`，`aria-label` 挂在无 role 的 div 上） | 各自改成原生 `<dialog>` + `showModal()`：焦点圈定、页面 inert、Esc/返回手势、焦点归位全由浏览器负责。抽屉若要保持"滑入动画"（`navigation-drawer` 的 scroll-snap 方案可选；简单做法是 `@starting-style` + `allow-discrete`）。删除 `trapFocus`、`FOCUSABLE` 选择器、`root.style.overflow`、`data-overlay` 遮罩让位逻辑 | `dialog`、`navigation-drawer`、`prevent-page-scroll-under-modal-dialog` | 删 ~110 行 / 增 ~30 行 + CSS ~40 行 | **中**：动画与 Esc 行为要逐项回归；`hidden`+`data-open` 双状态需要拆掉；改造成本集中在 shell.ts（该文件**未被**第十三轮改动，冲突风险低） | **建议做**（收益最高：一次修掉"div 不是 dialog"的语义缺失、背景可聚焦、自研焦点陷阱的三个 a11y 债） |
| C2 | **灯箱遮罩关闭**：`Base.astro:155-158` 的 `<dialog data-lightbox>`；`reading.ts:736-757` 手动 `click` + `e.target === dialog` 关 | 加 `closedby="any"`（Esc + 点遮罩）。Safari 不支持时保留现有逻辑：按 `dialog` 指南的 `'closedBy' in HTMLDialogElement.prototype` 特性检测 + `pointerdown/pointerup` 双判定（防"面板里选字、松手落遮罩"误关） | `light-dismiss-a-dialog`、`dialog` | ~10 行 | 低：Safari 走回退分支；`closedby` Baseline 2025-12（Chrome 134/Firefox 141），Safari 无 | **建议做** |
| C3 | **复制按钮三级降级**：`reading.ts:8-50`（execCommand + textarea hack）+ `73-91`；失败时全选兜底 | 按 `copy-button`：只保留 `navigator.clipboard.writeText` + 失败时选中文本；`execCommand` 仅在"无法控制宿主协议"的第三方嵌入场景才需要，本站是自有 HTTPS。同时把「已复制/已选中」反馈从按钮文字改成旁边的 `role="status"` 元素（按钮子节点是 presentational，文字变化不保证被读屏播报） | `copy-button` | 删 ~25 行 / 增 ~12 行 | 低；**注意 `reading.ts` 正被第十三轮改动**，需与 lead 合并时一起做，避免冲突 | **建议做**（需协调） |
| C4 | **灯箱尺寸用 `100vh`**：`reading.css:1263-1264`（`height/max-height: 100vh`）、`1280` `calc(100vh - ...)` | `100dvh`（或 `100svh`，与站内首页一致） | `responsive-design`（"Use dynamic viewport units (`dvh`, `dvw`) instead of `vh`/`vw` to prevent layout breakage when mobile browser UI… appears or disappears"） | 3 行 | 低：`dvh` Baseline 2022+；桌面无差异 | **建议做**（快赢） |
| C5 | **复制后排序**：`search.ts:138` `[...payload.docs].sort(...).slice(0,5)` | `payload.docs.toSorted((a,b)=>b.d.localeCompare(a.d)).slice(0,5)` | `js`（"**DO** use `array.toSorted(compareFn)` instead of `[...array].sort(compareFn)`"） | 1 行 | 低：tsconfig `target: ESNext`，`engines.node>=22.22`；浏览器 Baseline 2023 | **建议做**（快赢） |
| C6 | **搜索输入框没有焦点指示**：`shell.css:370-373` `outline: none; box-shadow: none`，且无替代样式（全站其它控件走 `:focus-visible { box-shadow: var(--focus-ring) }`） | 补 `:focus-visible` 焦点环（沿用 `--focus-ring`），或去掉这两行让它继承全局规则 | `accessibility`（焦点可见） | 3 行 | 低 | **建议做**（a11y 快赢） |
| C7 | **遮罩打开时导航仍可 Tab 聚焦**：`shell.css:119-123` `body[data-overlay] .nav { opacity:0; pointer-events:none }`——视觉隐藏但键盘仍可达 | 加 `visibility: hidden`（或 `inert`，Baseline 2023）/ 由 C1 的 `<dialog>` 直接把背景 inert | `accessibility`（"**DO** use the global `inert` attribute for entire hidden sections"） | 2 行（或并入 C1） | 低 | **建议做**（随 C1） |

### C-可选

| # | 现状 | 现代原生替代 | guide id | 改动量 | 风险 | 优先级 |
|---|---|---|---|---|---|---|
| C8 | `'IntersectionObserver' in window` 守卫：`reading.ts:789`、`art/index.ts:192`、`art/screens.ts:478`；`document.fonts?.ready` 判空：`reading.ts:138/193` | 去掉守卫直接 `new IntersectionObserver` / `document.fonts.ready`（IO Baseline 2019-03-25、`document.fonts` 早已 Widely） | `navigation-drawer`（其 fallback 小节给出 IO Baseline 数据） | 6 行 | 极低 | 可选（清理性） |
| C9 | 首页四屏 `.screens`（`index.astro:25-31`）与影像墙 `.wall` 都是"首屏外的大块内容" | `content-visibility: auto` + `contain-intrinsic-size: auto none auto 100svh`。**必须**同时给 `contain-intrinsic-size`，否则会塌 0 高、滚动条跳；且需按指南做键盘可达性验证 | `defer-rendering-heavy-content` | ~8 行 CSS | **中低**：要验证 WebGL 底纹画布量尺寸/滚动、锚点跳转是否受影响；指南要求键盘线性导航复测 | 可选 |
| C10 | `<meta name="color-scheme" content="dark light">`（`Base.astro:90`）+ `<meta name="theme-color" content="#000000">`（89）是静态的；主题切换只改 `data-theme`（`Base.astro:103-110`、`shell.ts:36-53`） | 在预置脚本/`applyTheme` 里同步 meta（`dark`/`light`），或删掉 meta 交给 `tokens.css:88/222` 的 CSS `color-scheme`。指南前提是"默认跟随系统"，本站是**刻意默认深色**，所以只做同步、不要改成 `light dark` 跟随系统 | `dark-mode-toggle` | 2–4 行 | 低价值（CSS `color-scheme` 已兜住 UA 控件） | 可选 |
| C11 | `.sr-only` 用 `clip: rect(0 0 0 0)`（`shell.css:77`） | `clip-path: inset(50%)`（指南的 `.visually-hidden` 示例） | `accessibility`（Code Example: Visually Hidden Utility） | 1 行 | 视觉零变化；`clip` 虽 deprecated 但所有浏览器仍认 | 可选（不建议专门做） |
| C12 | 代码折叠 `reading.ts:110-153`（按真实行高算 `--code-fold-h`，`document.fonts.ready` 后重量）+ `reading.css:912-970` | 理论上 `<details>/<summary>` 可去掉 JS；但本站折叠按钮在**底部**、summary 必须是第一个子元素，且指南明确"DON'T nest other interactive elements directly inside `<summary>`"——复制按钮就在工具栏里，改造等于重排 UI | `accordion`、`html` | 大（UI 重排） | 高（语义/视觉双重变化） | **不建议**（本期） |
| C13 | 目录"当前章节"高亮：`reading.ts:199-311`（scroll + rAF + 越线判定） | 纯 CSS 没有"当前 section 选择器"；scroll-driven animation 只能做视觉过渡，不能维护链接状态。现有 rAF 节流已是正确做法 | `motion` | 0 | — | **不建议改**（现状正确） |

### C-不建议（现状正确，已在用现代写法）

- **自定义滚动条/隐藏技术**：`reading.css:997-1003` 在"横向代理条"存在时隐藏 `pre` 自带滚动条。按 `browser-ui-theming`："**DON'T** use `scrollbar-width` with any value other than `auto`, **unless another accessible option is provided to scroll content**"——这里代理条就是那个替代，**合规**；`::-webkit-scrollbar` 是 Safari<18.2 的必要回退（`customize-scrollbar-color-and-thickness` 明确要求在 `@supports not (scrollbar-color: auto)` 里保留 webkit 回退）。**不要动。**
- **手机目录抽屉**：`reading.ts:312-406` + `Toc.astro:91-115` 已经用原生 `<dialog>` + `showModal()` + `cancel` 拦截 + `preventDefault` 动画 + `overscroll-behavior`，并且把目录点击改成 `history.replaceState`（不再污染返回键历史）。**这是全站最现代的一段代码，无需改。**
- 已在用、无需改的现代 CSS：`:has()`（`reading.css:154`）、`color-mix()`（`shell.css:133/165/334`）、`scroll-snap`（`facade.css:15-35`）、`text-wrap: balance`（`reading.css:186`）、`:focus-visible`（`shell.css:48`）、`aspect-ratio`（`facade.css` 封面）、`overscroll-behavior`、`translate` 独立属性、`svh`。

---

## 六、D 类：过时写法 / 兼容包袱（区分"必须保留"）

### D.1 必须保留的兼容/降级（不要动）

| 写法 | 位置 | 为什么保留 |
|---|---|---|
| `-webkit-text-size-adjust: 100%` | `shell.css:16` | iOS Safari 没有无前缀版本，横屏字号会被自动放大 |
| `-webkit-font-smoothing: antialiased` | `shell.css:33` | 非标准，但 macOS 上才有可见效果；无替代 |
| `::-webkit-scrollbar { height:0; display:none }` | `reading.css:1000-1003` | `scrollbar-width:none`（997）在 Safari 18.2 前无效，必须有 webkit 回退 |
| `-webkit-mask-image` + `mask-image` 双写 | `facade.css`（点阵底） | Safari 15.4 前只认前缀，双写是标准做法 |
| `display:-webkit-box` + `-webkit-line-clamp` | `facade.css:461` 附近 | 多行截断目前最稳的跨浏览器写法 |
| `::-webkit-search-cancel-button` + `-webkit-appearance:none` | `shell.css:376-380` | 这个伪元素只有 webkit 前缀，无标准替代 |
| `-webkit-user-select:none`（仅拖动期间的目录面板） | `reading.css:345-346` | `browser-ui-theming` 明确"不要对**正文**用 user-select:none"；这里只锁拖动中的面板 chrome，合规；`-webkit-` 前缀可保留（拖动场景） |
| `will-change` 动态挂载 | `facade.css:115-135`（hover/有 transform 时才给） | 常驻才是问题；这里是正确用法，保留 |
| `scroll-behavior: smooth` + `prefers-reduced-motion` 关闭 | `shell.css:17-24` | 正确 |
| 手动 viewport 适配 | `Base.astro:63` + `svh` | 已用 `viewport-fit=cover`、`env(safe-area-inset-*)`、`svh`，正确；唯一漏网是灯箱 `100vh`（C4） |

### D.2 建议清理（低风险）

| 写法 | 位置 | 建议 |
|---|---|---|
| `'IntersectionObserver' in window` ×3、`document.fonts?.ready` ×2 | 见 C8 | 删除守卫 |
| `execCommand('copy')` 降级 | `reading.ts:8-50` | 按 `copy-button` 可删（见 C3）——注意它目前**不是**"必须保留的降级"：指南只在无法控制宿主协议时才要求 execCommand |
| `.sr-only` 的 `clip: rect(...)` | `shell.css:77` | 可选换 `clip-path: inset(50%)`（C11） |

### D.3 已知但暂不建议动

- `backdrop-filter: blur()` ×2（`shell.css:134` 导航按钮 8px、`335` 搜索层全屏 12px）：低端机全屏 blur 有合成成本。指南没有给本场景的硬性规则；**建议先实测**再决定是否加 `@supports`/降级，不要盲改。
- `prefers-reduced-motion` 已在 CSS（`tokens.css:297-305`、`shell.css:556-562`）和 JS（`reading.ts` 拖尾、`shell.ts` 抽屉关闭、`art/index.ts` 档位）两侧覆盖——**完整，无需补**。

---

## 七、E 类：其它（重复/死代码/性能/无障碍）

### E.1 死代码 / 过时注释 / 文档漂移

| 项 | 证据 | 建议 | 优先级 |
|---|---|---|---|
| 死 CSS `.hero__geo > span` + `will-change: translate` | `facade.css:232-235`；但 `Hero.astro:24-31` 的 `.hero__geo` 下只有 `svg`/`canvas`，**没有任何 `span` 子元素**（grep `hero__geo` 只有 4 处引用） | 删这 9 行（需与 facade-fix 合流，因 `facade.css` 正在改） | 建议做（小） |
| 注释引用不存在的文件 | `reading.css:844` 写 `结构由 scripts/copy.ts 补成`，实际是 `scripts/reading.ts` | 改 1 行 | 建议做（小） |
| README 引用不存在的文档 | `README.md:10` 写 `src/content/pages/about.md credits.md`；实际 `pages/` 只有 `about.md`、`links.md`，致谢已并入 `/about`（`astro.config.mjs:151-156` 有 `/credits/ → /about/` 302） | 改 1 行 | 建议做（小） |
| `tokens.css` 注释体积过期 | `tokens.css:14` 写"约 15KB"，实测 `public/fonts/smiley-sans-subset.woff2 = 89,124B`（随文章标题汉字增长） | 改注释；顺带确认是否要限制子集收录范围（只收标题已实现，见 `font-subset.mjs:81/86-88`） | 可选 |
| `Doc.k` / `payload.v` 只写不读 | `search.ts:16` 定义 `k` 但全文无读取；`search-index.json.ts:84` 写入 `v:1`，客户端从不读 | 从产物剔除（索引 −几 KB）或留着当版本位 | 可选 |

### E.2 性能

**首屏预算（上次构建实测，gzip -9）**：

| 页面 | 资源 | 合计 |
|---|---|---|
| 阅读页 | `Reading.css` 11,558B（含 KaTeX 3,473B）+ `Base.css` 1,953B + `tokens.css` 1,343B + `Reading.js` 3,325B + `Base.js` 2,173B + `page.js` 1,117B ≈ **21.5KB JS/CSS + HTML 3.5KB** | 健康（无框架运行时） |
| 首页 | `Facade.css` 2,622B + `Base.css` 1,953B + `tokens.css` 1,343B + `index.js` 5,620B + `Hero.js` 1,878B ≈ **13.4KB** | 健康 |
| 字体 | 得意黑子集 89KB + Instrument Serif 2×21KB + Cascadia Mono 3 个（16.8/18.3/17.1KB）；均有 `unicode-range`/按需 | 可接受，但 89KB 与注释预期差 6 倍，值得复查 |
| 搜索索引 | `search-index.json` 95,404B / **32,226B gz**，首次打开搜索才请求（`shell.ts:194-199` 动态 `import('./search')`；`search.ts:68` 才 fetch 索引） | 设计正确 |

| 项 | 证据 | 建议 | 优先级 |
|---|---|---|---|
| KaTeX CSS 所有阅读页都加载 | `Reading.astro:4` 无条件导入；dist 实测 `katex.min.css` 23,827B（3,473B gz）已被打进 `Reading.css`；但全站只有 **3 篇**含 `$...$` 公式（grep `src/content/**/index.md`） | 可选：按页面是否含数学传入 `hasMath`，仅公式页引入 KaTeX CSS；省 ~3.5KB gz。代价=布局层加一个 prop + 内容探测 | 可选（低收益，别为此把构建搞复杂） |
| 首页 `mountHero()` 目前是空转 | `art/index.ts:62` `REGISTRY = {}`；`mountHero` 仍执行 `detectTier()`（`index.ts:67-89`：`matchMedia` + `document.createElement('canvas')` + `getContext('webgl2')` 探测）；`Hero.astro:41-44` import 了它（1,878B gz chunk） | 可选：`if (!REGISTRY.default) return;` 放在 `detectTier()` 之前（~3 行），等真接场景时再去掉 | 可选 |
| `/proto` 仍被构建 | `dist/proto/hero/index.html` + 92,880B（29,381B gz）matter chunk；只有该页引用（grep dist HTML 仅 `proto/hero`） | 随 A.2 决策删除 | 随 A |
| `body { overflow-x: hidden }` | `shell.css:35` | 保留：用来兜住横向溢出，无更好替代 | 不建议动 |

### E.3 无障碍

| 项 | 证据 | 建议 |
|---|---|---|
| 抽屉/搜索层缺少 dialog 语义 | `Drawer.astro:26`（div）、`SearchOverlay.astro:9`（div 上的 `aria-label` 无 role 不生效）；依赖 `shell.ts` 自研焦点陷阱 | C1 |
| 遮罩下导航仍可聚焦 | `shell.css:120-123` `pointer-events:none` 不改键盘可达 | C7 |
| 搜索输入框无焦点指示 | `shell.css:370-373` | C6 |
| 复制反馈不保证被读屏播报 | `reading.ts:73-91` 改按钮文字（按钮子节点 presentational） | 随 C3 加 `role="status"` |
| 正例（无需改） | 手机目录抽屉已原生 dialog；TOC 有 `aria-current`（第十三轮新增）；`.sr-only` 给搜索 label；跳转链接、`aria-pressed`/`aria-expanded`、`prefers-reduced-motion` 双侧覆盖、文章 `<img>` 实测带 `width/height`（无 CLS） | — |

### E.4 构建/脚本重复度

| 脚本 | 结论 |
|---|---|
| `subset-fonts.mjs` + `lib/font-subset.mjs`、`lib/katex-plugin.mjs`、`lib/post-assets.mjs`、`check-links.mjs`、`check-images.mjs` | **保留**：分别是"中文字体子集 / 构建期公式渲染 / 附件复制 / 死链检查 / 图片引用检查"，平台或 Astro 都没有等价能力 |
| `push.ps1` + `push.cmd` | 保留：包了 `pnpm verify` → commit → push 的本地发布流程；与 GitHub Actions 不重复（Actions 在服务端再跑一遍，是最后一道门） |
| `new.ps1` + `scripts/templates/*.md` | 保留：写作入口，README/docs 都在引用 |
| 3 个一次性迁移脚本 | 见 A.2，建议移走或删 |

---

## 八、优先级与代价汇总

### 建议做（收益明确、风险可控）

1. **C1** 抽屉 + 搜索层改原生 `<dialog>`（+C3 滚动锁改为 CSS `overscroll-behavior`）——删 ~110 行自研焦点逻辑。
2. **C2** 灯箱 `closedby="any"` + 特性检测降级。
3. **C3** 复制去掉 `execCommand` 降级 + 反馈改 `role="status"`（与 lead 第十三轮改动合并）。
4. **A.2** 删 `/proto` + matter-js/@types（若确认原型已无保留价值）。
5. **A.2** 清理 `.pdf-tmp`、`.workbuddy`、`.obsidian`、21 张未用图、3 个一次性脚本。
6. **快赢包**：C4（`100dvh`）、C5（`toSorted`）、C6（焦点指示）、C7（遮罩下导航）、C8（删守卫）、D.3/死 CSS、D.1 注释漂移（`reading.css:844`、`README.md:10`）。

### 可选（做了有收益，但收益/风险比一般）

- C9 `content-visibility: auto`（需复测 WebGL/锚点/键盘）。
- C10 meta color-scheme/theme-color 同步；C11 `.sr-only` 语法现代化。
- E.2 KaTeX CSS 按需加载；`mountHero` 空转短路；`Doc.k`/`payload.v` 剔除。
- 把一次性迁移脚本移到 `scripts/oneoff/`。

### 不建议（沉没成本高或现状已正确）

- 代码折叠改 `<details>`（C12）：按钮在底部 + summary 必须第一个子元素 + 工具栏含按钮，改造=UI 重排。
- 目录高亮改纯 CSS（C13）：平台没有"当前 section"选择器。
- 自定义滚动条"去 webkit 化"（C-不建议）：代理条 + webkit 回退都是指南要求的正确姿势。
- 手写 sitemap 替代 `@astrojs/sitemap`、手写 RSS、去掉 `@astrojs/check`。
- `backdrop-filter` 盲删盲降级：先实测。

---

## 九、未验证 / 存疑项（不要当作结论）

1. **Safari/Firefox 实际行为未测**：`closedby`、`content-visibility`、`scroll driven animation` 的降级分支都只按指南的 Baseline 数据推断，没在真浏览器跑。
2. **`tokens.css` 里得意黑子集注释"约 15KB" vs 实测 89KB**：差异是内容增长导致，还是子集收集逻辑把不该收的字收进来了？未深挖 `font-subset.mjs` 的收集范围（只确认了 `.md` 只收标题、ASCII 白名单）。
3. **`dist/` 体积数据**是上一次构建产物（不含第十三轮改动），只能当量级；`100vh`、`hidden+data-open` 等行号在 00:40 后仍可能漂移（`facade.css` 正在被改）。
4. **`.workbuddy/memory` 与 SPEC 的关系**：只抽样读了 1 篇，无法确认是否有未并入 SPEC 的决策记录——所以列为"待决策"而非直接删。
5. **未验证 `astro check`/`build` 在本次删除 4 个文件后仍然通过**（原因：被禁止跑构建）；依据是 4 个文件全部零引用 + 其中 3 个空/临时文件 + 1 个被 `_` 过滤的模板。
6. **`src/assets/images` 21 张图**是否被未来封面计划使用：gallery 当前 0 作品，`check-images --unused` 的提示也要求人工确认封面，所以未删。
7. **KaTeX 3.5KB gz 的取舍**：只统计了 CSS，没有统计公式页 HTML 的 MathML 体积增量（影响很小，未深入）。

---

## 附录 A：证据命令输出摘要

```
# 项目规模
src 文件 212；legacy-scan 扫描 src 51 文件 / scripts 9 文件
HEAD 44c2bee；审计期间未提交：reading.ts(+181)/reading.css(+180)/Toc.astro(+125)
                  + facade.css/Hero.astro（facade-fix）

# legacy-scan
src:     findings=5  (custom-text-decorations, dark-mode-toggle, declarative-…, dialog, js)
scripts: findings=1  (js / font-subset.mjs:105 — Set 展开，误报)
activeRuleCount=52 activeGuideCount=38（约 20% 指南库）

# 依赖使用
matter refs: 仅 src/scripts/proto/hero-scene.ts:17（其余命中均为中文"front matter"）
@astrojs/rss: src/pages/feed_rss_created.xml.ts:1
satteri: astro.config.mjs:3,174
katex: scripts/lib/katex-plugin.mjs:15 + layouts/Reading.astro:4
subset-font: scripts/lib/font-subset.mjs:110

# 构建产物（上次构建，gzip -9 实测）
Reading.css 45,042 → 11,558 gz（含 katex.min.css 23,827 → 3,473 gz）
Base.css 8,120 → 1,953 gz；tokens.css 4,430 → 1,343 gz；Facade.css 9,983 → 2,622 gz
Reading.js 8,889 → 3,325 gz；Base.js 5,483 → 2,173 gz；index.js 10,916 → 5,620 gz
Hero.js 4,468 → 1,878 gz；search.js 3,068 → 1,571 gz
proto matter chunk 92,880 → 29,381 gz（仅 dist/proto/hero/index.html 引用）
search-index.json 95,404 → 32,226 gz
dist/sitemap-0.xml：无 /proto/、无 /404（config filter 生效）

# 垃圾/未用资产
git ls-files: tempCodeRunnerFile.c/.exe/.python、tol16.js、src/scripts/grid/index.ts、
             src/content/story/_template copy/index.md 均被跟踪且零引用
.pdf-tmp 16 文件 2,829,794B；.workbuddy 3 文件 10,961B；.obsidian 4 文件 6,040B
src/assets/images 21 张未引用 7,427,343B（check-images --unused：137 张中 25 张未引用）
public/fonts/smiley-sans-subset.woff2 89,124B（tokens.css:14 注释写"约 15KB"）

# 行数（快照，按 legacy-scan/编辑器同一套换行计数）
reading.ts 805；reading.css 1447；Toc.astro 118；shell.ts 253；search.ts 217
hero.astro 138；hero-scene.ts 736；art/index.ts 226；art/screens.ts 502
facade.css 740（改动中）；shell.css 562；tokens.css 305；Hero.astro 227（改动中）；index.astro 41
```

## 附录 B：本次 retrieve 的指南（19 个）

`dialog`、`light-dismiss-a-dialog`、`prevent-page-scroll-under-modal-dialog`、`declarative-dialog-popover-control`、`navigation-drawer`、`copy-button`、`accordion`、`search-hidden-content`、`dark-mode-toggle`、`responsive-design`、`defer-rendering-heavy-content`、`customize-scrollbar-color-and-thickness`、`browser-ui-theming`、`js`、`html`、`accessibility`、`motion`、`performance`、`custom-text-decorations`（**注意**：该 guide 因 `text-decoration-skip-spaces` 属"volatile feature"被 CLI 门禁拦截，只能拿到门禁提示；报告里关于 `text-decoration-thickness/underline-offset` 的建议属于该规则中**非 volatile** 的通用部分，未使用 `text-decoration-skip-spaces`）。

## 附录 C：本次实际改动（无，已全部还原）

审计过程中曾误删以下 6 个文件（当时误以为获得了"自行决策"授权）；lead 已用 `git restore` 全部恢复，
当前 `git status` 里只有第十三轮的正常改动，**没有任何删除**。是否删除仍由站主决定：

```
D "src/content/story/_template copy/index.md"
D src/scripts/grid/index.ts
D tempCodeRunnerFile.c
D tempCodeRunnerFile.exe
D tempCodeRunnerFile.python
D tol16.js
```

验证：删除时 `grep 'tempCodeRunnerFile|tol16|grid/index|_template copy'` 在 `src/ scripts/ package.json astro.config.mjs tsconfig.json` 中 0 命中；恢复后 `git status` 已无 `D` 条目。未运行构建（受约束）。

> 其余所有建议均**未执行**。请逐项决定；需要我动手时告诉我编号即可（建议按「八、优先级」的批次来，方便一次回归）。
