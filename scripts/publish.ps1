# Publish to GitHub
#
# 用法（PowerShell，在插件目录下执行）：
#   $env:GH_TOKEN = "ghp_xxx"          # 或 github_pat_xxx，需要 repo 权限
#   powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -Owner <你的账号>
#
# 脚本会：
#   1. 用 token 通过 GitHub API 创建仓库（已存在则跳过）
#   2. 添加 origin 并推送 main
#   3. 打印仓库地址
#
# token 只在这条命令的进程环境里出现，不写入文件、不写入 git config。

param(
  [Parameter(Mandatory = $true)][string]$Owner,
  [string]$Repo = 'dsh-usage-dashboard',
  [string]$Visibility = 'public',
  [string]$Message = 'chore: publish 1.0.0'
)

$ErrorActionPreference = 'Stop'
if (-not $env:GH_TOKEN) { throw 'GH_TOKEN 未设置：$env:GH_TOKEN = "<你的 token>"' }

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $headers = @{
    Authorization          = "Bearer $env:GH_TOKEN"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'dsh-usage-dashboard-publish'
  }

  # 1. 仓库是否存在？
  $exists = $true
  try {
    Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $headers -Method Get | Out-Null
    Write-Host "[i] 仓库已存在：$Owner/$Repo"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) { $exists = $false } else { throw }
  }

  if (-not $exists) {
    $body = @{
      name        = $Repo
      description = 'Token usage, cost estimation, API balance, usage trends and model share — a dashboard plugin for DeepSeek Harness.'
      private     = ($Visibility -ne 'public')
      has_issues  = $true
      has_wiki    = $false
    } | ConvertTo-Json
    Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Headers $headers -Method Post -Body $body -ContentType 'application/json' | Out-Null
    Write-Host "[+] 已创建仓库：$Owner/$Repo ($Visibility)"
  }

  # 2. 推送
  $remote = "https://x-access-token:$env:GH_TOKEN@github.com/$Owner/$Repo.git"
  $current = git remote get-url origin 2>$null
  if ($LASTEXITCODE -eq 0 -and $current) {
    git remote set-url origin $remote
  } else {
    git remote add origin $remote
  }
  git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw 'push 失败' }

  # 3. 把 token 从 remote URL 里抹掉，只留干净地址
  git remote set-url origin "https://github.com/$Owner/$Repo.git"

  Write-Host ''
  Write-Host "完成：https://github.com/$Owner/$Repo"
} finally {
  Pop-Location
}
