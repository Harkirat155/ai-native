Param(
  [string]$Workspace = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Write-Usage {
  Write-Host "Usage: .\\scripts\\install.ps1 [-Workspace <path>]"
}

function Get-CodeCommand {
  $cmd = Get-Command code -ErrorAction SilentlyContinue
  if ($null -ne $cmd) { return $cmd.Source }
  return $null
}

$code = Get-CodeCommand
if ($null -eq $code) {
  Write-Error @"
VS Code CLI 'code' was not found.

Install VS Code:
  https://code.visualstudio.com/download

Then enable the CLI (Command Palette):
  'Shell Command: Install ''code'' command in PATH'
"@
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Vsix = Join-Path $Root "dist\\vscode-bridge.vsix"
if (!(Test-Path $Vsix)) {
  throw "Missing VSIX: $Vsix"
}

$BinSrc = Join-Path $Root "dist\\vscode-bridge-win-x64.exe"
if (!(Test-Path $BinSrc)) {
  throw "Missing controller binary: $BinSrc. Build it with: npm run package:controller:win"
}

$InstallDir = Join-Path $env:LOCALAPPDATA "AI-Native\\bin"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$InstallBin = Join-Path $InstallDir "vscode-bridge.exe"
Copy-Item -Force $BinSrc $InstallBin

Write-Host "Installing extension VSIX…"
& $code --install-extension $Vsix --force | Out-Null

$VscodeDir = Join-Path $Workspace ".vscode"
New-Item -ItemType Directory -Force -Path $VscodeDir | Out-Null
$Settings = Join-Path $VscodeDir "settings.json"

$obj = @{}
if (Test-Path $Settings) {
  try { $obj = Get-Content $Settings -Raw | ConvertFrom-Json } catch { $obj = @{} }
}
$obj | Add-Member -Force -NotePropertyName "bridge.enabled" -NotePropertyValue $true
$obj | Add-Member -Force -NotePropertyName "bridge.pairing.exportTokenPath" -NotePropertyValue ".vscode/bridge.token"
$obj | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $Settings

Write-Host ""
Write-Host "Done."
Write-Host "1) Add controller to PATH: $InstallDir"
Write-Host "2) Open workspace: code `"$Workspace`""
Write-Host "3) Reload window once, then run: vscode-bridge doctor"

