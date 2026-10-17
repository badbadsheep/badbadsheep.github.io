#Requires -Version 5.1
<#
.SYNOPSIS
    一键推送：自检 → 提交 → 推送到 GitHub。

.DESCRIPTION
    按顺序做四件事，任何一步失败就停下，绝不把没通过自检的东西推上去：

      1. 检查 git / 仓库 / 分支 / 提交身份 / 远程地址，缺的能补就补
      2. pnpm verify（字体子集 → 图片引用 → 类型 → 构建 → 死链）
      3. 把改动提交成一个 commit
      4. git push；被远程抢先时自动 rebase 后重试一次

.PARAMETER Message
    提交信息。不给就用「更新：yyyy-MM-dd HH:mm」。

.PARAMETER SkipVerify
    跳过第 2 步的自检。只建议在改错别字、改文档时用。

.PARAMETER Force
    远程仓库和本地没有共同祖先时（拿老仓库当远程），允许用本地历史覆盖远程 main。
    走的是 --force-with-lease，远程万一又变了会拒绝，不会盖掉别人的新提交。

.PARAMETER RemoteUrl
    首次推送时直接指定远程地址，跳过交互提问。

.EXAMPLE
    .\push.cmd
.EXAMPLE
    .\push.cmd "内容：新增《C 语言基础》"
.EXAMPLE
    .\push.cmd -SkipVerify
.NOTES
    这个文件必须存成 UTF-8 with BOM。去掉 BOM 后 Windows PowerShell 会按 GBK 读，
    中文串把引号截断，整个脚本解析失败（和 scripts/new.ps1 同一个坑）。
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Message,

    [switch]$SkipVerify,

    [switch]$Force,

    [string]$RemoteUrl
)

$ErrorActionPreference = 'Stop'

# 控制台按 UTF-8 输出；否则在 936 代码页的控制台里，中文全是乱码
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$DefaultRemote = 'https://github.com/badbadsheep/badbadsheep.github.io.git'

function Write-Section([string]$Number, [string]$Text) {
    Write-Host ''
    Write-Host "[$Number] $Text" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
    Write-Host "    OK  $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
    Write-Host "    !!  $Text" -ForegroundColor Yellow
}

function Write-Bad([string]$Text) {
    Write-Host "    XX  $Text" -ForegroundColor Red
}

function Stop-Task([string]$Text) {
    Write-Host ''
    Write-Host "  失败：$Text" -ForegroundColor Red
    Write-Host '  没有提交、也没有推送。修好上面的问题再跑一次。' -ForegroundColor Red
    Write-Host ''
    exit 1
}

# ---------------------------------------------------------------- 1. 环境

Write-Section '1/4' '检查环境'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-Task '找不到 git。装 Git for Windows 后重开这个窗口。'
}
Write-Ok ('git ' + (git --version))

if (-not (Test-Path -LiteralPath (Join-Path $Root '.git'))) {
    git init -b main --quiet
    if ($LASTEXITCODE -ne 0) { git init --quiet }
    Write-Ok '这不是一个 git 仓库，已初始化（分支 main）'
}

$branch = (git symbolic-ref --short HEAD 2>$null)
# 全新仓库还没有任何提交时，rev-parse --abbrev-ref HEAD 返回的是字面量 "HEAD"，
# 只有 symbolic-ref 能拿到还没出生的分支名（main）。少了这层兜底，第一次发布会卡在这里。
if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
}
if ($branch -ne 'main') {
    Stop-Task "当前分支是 $branch，不是 main。先 git checkout main 再发布。"
}
Write-Ok '分支 main'

$who = (git config user.name)
$mail = (git config user.email)
if ([string]::IsNullOrWhiteSpace($who) -or [string]::IsNullOrWhiteSpace($mail)) {
    Stop-Task @'
提交身份没配。先跑这两行（换成你自己的：
  git config --global user.name  "你的名字"
  git config --global user.email "你的邮箱"
'@
}
Write-Ok "提交身份 $who <$mail>"

$remotes = @(git remote)
if ($remotes -notcontains 'origin') {
    $url = $RemoteUrl
    if ([string]::IsNullOrWhiteSpace($url)) {
        Write-Host ''
        Write-Host '    这个仓库还没有远程地址。' -ForegroundColor Yellow
        $answer = Read-Host "    远程地址（直接回车用 $DefaultRemote）"
        if ([string]::IsNullOrWhiteSpace($answer)) { $url = $DefaultRemote } else { $url = $answer.Trim() }
    }
    git remote add origin $url
    if ($LASTEXITCODE -ne 0) { Stop-Task '添加远程地址失败。' }
    Write-Ok "已添加远程 origin $url"
} else {
    Write-Ok ('远程 ' + (git remote get-url origin))
}

# ---------------------------------------------------------------- 2. 自检

if ($SkipVerify) {
    Write-Section '2/4' '自检'
    Write-Warn '已跳过（-SkipVerify）'
} else {
    Write-Section '2/4' '自检：字体 → 图片 → 类型 → 构建 → 死链'
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Stop-Task '找不到 pnpm。先装 pnpm（npm i -g pnpm）再跑。'
    }
    & pnpm verify
    if ($LASTEXITCODE -ne 0) {
        Stop-Task 'pnpm verify 没过。上面那一步的报错就是原因。'
    }
    Write-Ok '自检全过'
}

# ---------------------------------------------------------------- 3. 提交

Write-Section '3/4' '提交'

$changes = @(git status --porcelain)
if ($changes.Count -eq 0) {
    Write-Ok '工作区干净，没有要提交的改动'
} else {
    git add -A
    if ($LASTEXITCODE -ne 0) { Stop-Task 'git add 失败。' }

    # 进仓库前先看一眼体量：5 MB 以上的文件基本都不该在这里
    $staged = @(git diff --cached --name-only)
    $big = @()
    foreach ($file in $staged) {
        if (Test-Path -LiteralPath $file) {
            $length = (Get-Item -LiteralPath $file).Length
            if ($length -gt 5MB) { $big += ('{0} （{1:N1} MB）' -f $file, ($length / 1MB)) }
        }
    }
    if ($big.Count -gt 0) {
        Write-Warn '这几个文件超过 5 MB，确认要进仓库：'
        foreach ($item in $big) { Write-Warn "  $item" }
    }

    if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = '更新：' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
    }
    git commit --quiet -m $Message
    if ($LASTEXITCODE -ne 0) { Stop-Task 'git commit 失败。' }
    Write-Ok ('已提交 ' + $staged.Count + ' 个文件：' + $Message)
}

# ---------------------------------------------------------------- 4. 推送

Write-Section '4/4' '推送'

# 上一次的 rebase / merge 没收尾时，不要在上面继续叠操作
foreach ($state in '.git\rebase-merge', '.git\rebase-apply', '.git\MERGE_HEAD') {
    if (Test-Path -LiteralPath (Join-Path $Root $state)) {
        Write-Bad '这个仓库里还有一次没做完的 rebase / merge。'
        Write-Bad '  看现场：git status'
        Write-Bad '  放弃它：git rebase --abort   （或 git merge --abort）'
        Stop-Task '先把上次的冲突处理完。'
    }
}

# 远程已有 main 时，先看两边是不是同一个祖先。
# 不是的话（最典型：把老仓库当成了远程）绝对不能 rebase ——
# 那会把本地每个提交逐个叠到无关历史上，每个都撞冲突，仓库直接卡死。
git fetch --quiet origin main 2>$null
$remoteLine = [string](git ls-remote --heads origin main 2>$null)
$hasRemoteBranch = -not [string]::IsNullOrWhiteSpace($remoteLine)

$unrelated = $false
if ($hasRemoteBranch) {
    git merge-base main origin/main 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { $unrelated = $true }
}

if ($unrelated -and -not $Force) {
    Write-Bad '远程的 main 和本地没有共同祖先 —— 这个地址上放的是一个无关的旧仓库。'
    Write-Bad ''
    Write-Bad '  三种走法，选一个：'
    Write-Bad '  1) 旧仓库不要了，用新站覆盖它（旧内容本地还留着）：'
    Write-Bad '       push.cmd -Force'
    Write-Bad '  2) 换一个空仓库（GitHub 上新建，别勾 README）：'
    Write-Bad '       git remote set-url origin <新地址>'
    Write-Bad '  3) 两个历史都留着（旧文件会残留在仓库里，得手动删）：'
    Write-Bad '       git pull --allow-unrelated-histories origin main'
    Stop-Task '远程历史与本地无关，已停下，什么都没推。'
}

if ($unrelated) {
    Write-Warn '远程历史与本地无关：按 -Force 用本地覆盖远程 main'
    git push --force-with-lease -u origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Bad '覆盖失败。如果提示 stale info，说明远程刚又被改过，重跑一次即可。'
        Stop-Task '推送失败。'
    }
} else {
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        # 远程有新的提交（同一祖先）：同步一次再推，冲突就交给人工
        Write-Warn '推送被拒绝，先和远程同步（pull --rebase）再试一次'
        git pull --rebase origin main
        if ($LASTEXITCODE -ne 0) {
            Write-Bad '同步失败，是有冲突需要手动解决：'
            Write-Bad '  git status  →  改完冲突文件  →  git add <文件>  →  git rebase --continue'
            Write-Bad '  想放弃这次同步：git rebase --abort'
            Write-Bad '  （如果这时候看到 "The batch file cannot be found"，是 rebase 把 push.cmd'
            Write-Bad '    自己切走了，不影响任何东西，按上面的命令处理冲突就行。）'
            Stop-Task 'rebase 没完成。'
        }
        git push -u origin main
        if ($LASTEXITCODE -ne 0) {
            Write-Bad '还是推不上去。把上面 git 的原文发我，或对照 README 第十节 10.5 的报错表。'
            Stop-Task '推送失败。'
        }
    }
}

# ---------------------------------------------------------------- 收尾

$head = (git log -1 --format='%h %s')
$origin = (git remote get-url origin)

Write-Host ''
Write-Host '  推送完成' -ForegroundColor Green
Write-Host "    提交  $head"
Write-Host "    远程  $origin"

if ($origin -match 'github\.com[:/](?<slug>[^/]+)/(?<repo>[^/]+?)(?:\.git)?$') {
    $slug = ($Matches['slug'] + '/' + $Matches['repo'])
    Write-Host "    动作  https://github.com/$slug/actions"
}

Write-Host ''
Write-Host '  站点没出现？Settings → Pages → Source 选 GitHub Actions（只需设一次）。'
Write-Host '  线上评论区空白？Settings → Secrets and variables → Actions → Variables'
Write-Host '    建 PUBLIC_GISCUS_REPO / _REPO_ID / PUBLIC_GISCUS_CATEGORY / _CATEGORY_ID 四项。'
Write-Host ''

exit 0
