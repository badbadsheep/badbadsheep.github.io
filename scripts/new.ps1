<#
.SYNOPSIS
    新建一篇内容（博客 / 笔记 / 故事 / 影像），并在 VS Code 里打开。

.DESCRIPTION
    一个入口覆盖四类内容 —— 差别只是「放哪个目录 + 用哪个模板」：

      -Section blog      src/content/blog/<slug>.md
      -Section note      src/content/note/<slug>.md
      -Section story     src/content/story/<slug>.md
      -Section gallery   src/content/gallery/<slug>.md   （用 -Category / -Year / -Medium）

    新建的内容一律是草稿（draft: true）：本地能看，构建产物里没有。
    写完要发布：.\scripts\new.ps1 -Publish -Slug <slug>

.EXAMPLE
    .\scripts\new.ps1 "从零搭好本地写作环境" -Section note -Tags "环境配置,MkDocs"

.EXAMPLE
    .\scripts\new.ps1 "海报系列" -Section gallery -Category painting -Year 2026 -Medium 数字绘画

.EXAMPLE
    .\scripts\new.ps1 -Publish -Slug the-born-of-badbadblog
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Title,

    [ValidateSet('blog', 'note', 'story', 'gallery')]
    [string]$Section = 'blog',

    [string]$Tags = '',
    [string]$Slug,
    [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),

    # ── 以下仅 -Section gallery 用 ──
    [ValidateSet('painting', 'video', 'interactive', 'project')]
    [string]$Category = 'painting',
    [string]$Year = (Get-Date -Format 'yyyy'),
    [string]$Medium = '',
    [string]$Link = '',
    [string]$Summary = '',

    [switch]$Force,
    # 把草稿转成正式：draft: true → false
    [switch]$Publish,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = Split-Path -Parent $PSScriptRoot
$templates = Join-Path $PSScriptRoot 'templates'
$contentRoot = Join-Path $root 'src\content'

$targets = @{
    blog    = @{ Dir = 'blog';    Template = 'post.md';    Label = '博客' }
    note    = @{ Dir = 'note';    Template = 'page.md';    Label = '笔记' }
    story   = @{ Dir = 'story';   Template = 'page.md';    Label = '故事' }
    gallery = @{ Dir = 'gallery'; Template = 'gallery.md'; Label = '作品' }
}

# ── 草稿转正 ──────────────────────────────────────────────────────────────
if ($Publish) {
    if (-not $Slug) { throw '转正需要指定 -Slug（文件名，不含 .md）' }
    $hit = Get-ChildItem $contentRoot -Recurse -Filter "$Slug.md" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike '*\pages\*' } |
        Select-Object -First 1
    if (-not $hit) { throw "找不到：$Slug.md" }

    $text = [System.IO.File]::ReadAllText($hit.FullName, [System.Text.UTF8Encoding]::new($false))
    if ($text -notmatch '(?m)^draft:\s*true') {
        Write-Host "这篇本来就不是草稿，没动：$($hit.Name)" -ForegroundColor Yellow
        return
    }
    $text = $text -replace '(?m)^draft:\s*true', 'draft: false'
    [System.IO.File]::WriteAllText($hit.FullName, $text, [System.Text.UTF8Encoding]::new($false))
    Write-Host "`n已发布：$($hit.FullName.Replace($root, '.').Replace('\', '/'))" -ForegroundColor Green
    return
}

$target = $targets[$Section]

if (-not $Title) {
    $Title = (Read-Host '标题').Trim()
    if (-not $Title) { throw '标题不能为空。' }
}

# ── 文件名：ASCII 化；中文标题退化成时间戳 ─────────────────────────────
if (-not $Slug) {
    $Slug = ($Title.Normalize([Text.NormalizationForm]::FormKC) -replace '[^A-Za-z0-9\s-]', '') `
        -replace '[\s_]+', '-'
    $Slug = $Slug.Trim('-').ToLower()
    if (-not $Slug) {
        $Slug = ($Section + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        Write-Host "标题里没有可用作网址的字符，文件名用：$Slug" -ForegroundColor Yellow
        Write-Host '（想指定就用 -Slug my-post）' -ForegroundColor DarkGray
    }
}
$Slug = $Slug.Trim().ToLower()

$dir = Join-Path $contentRoot $target.Dir
$file = Join-Path $dir "$Slug.md"
$templateFile = Join-Path $templates $target.Template

if (-not (Test-Path $templateFile)) { throw "找不到模板：$templateFile" }
if ((Test-Path $file) -and -not $Force) {
    throw "文件已存在：$file`n想覆盖就加 -Force，或换一个 -Slug。"
}

# ── 占位替换 ─────────────────────────────────────────────────────────────
$tagValue = if ($Tags) {
    $list = $Tags -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    '[' + (($list | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ', ') + ']'
} else {
    '[]'
}

$text = [System.IO.File]::ReadAllText($templateFile, [System.Text.UTF8Encoding]::new($false))
$text = $text.Replace('__TITLE__', $Title).
    Replace('__DATE__', $Date).
    Replace('__TAGS__', $tagValue)

# 摘要：没写就把整行删掉（schema 里它是可选的，留空行只会碍眼）
if ($Summary) {
    $text = $text.Replace('__SUMMARY__', $Summary)
} else {
    $text = $text -replace '(?m)^summary: __SUMMARY__\r?\n', ''
}

if ($Section -eq 'gallery') {
    $text = $text.Replace('__CATEGORY__', $Category).Replace('__YEAR__', $Year)
    if ($Medium) {
        $text = $text.Replace('__MEDIUM__', $Medium)
    } else {
        $text = $text -replace '(?m)^medium: __MEDIUM__\r?\n', ''
    }
    if ($Link) {
        $text = $text -replace '(?m)^# link: __LINK__$', "link: $Link"
    } else {
        $text = $text -replace '(?m)^# link: __LINK__\r?\n', ''
    }
}

New-Item -ItemType Directory -Force -Path $dir | Out-Null
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

$rel = $file.Replace($root, '.').Replace('\', '/')
Write-Host "`n已创建 $($target.Label)：$rel" -ForegroundColor Green
Write-Host '这是草稿：pnpm dev 能看到（列表里带草稿标记），pnpm build 不会包含它。' -ForegroundColor DarkGray
Write-Host "写完发布：.\scripts\new.ps1 -Publish -Slug $Slug" -ForegroundColor DarkGray

if (-not $NoOpen) {
    $editor = Get-Command code -ErrorAction SilentlyContinue
    if (-not $editor) { $editor = Get-Command code-insiders -ErrorAction SilentlyContinue }
    if ($editor) { & $editor.Source -g "$file" }
    else { Write-Host "没找到 VS Code 的 code 命令，请手动打开：$file" -ForegroundColor Yellow }
}
