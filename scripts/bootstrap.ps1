Param(
  [string]$Workspace = (Get-Location).Path,
  [string]$Ref = "main"
)

$ErrorActionPreference = "Stop"

function Has-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function bootstrap-ai-native {
  Param(
    [string]$Workspace = (Get-Location).Path,
    [string]$Ref = "main"
  )

  if (Has-Command "vscode-bridge") {
    vscode-bridge doctor
    return
  }

  if (!(Has-Command "git")) { throw "Missing requirement: git" }
  if (!(Has-Command "code")) { throw "Missing requirement: VS Code CLI 'code' on PATH" }
  if (!(Has-Command "npm")) { throw "Missing requirement: npm (Node.js)" }

  $tmp = Join-Path $env:TEMP ("ai-native-bootstrap-" + [Guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null

  $repoDir = Join-Path $tmp "ai-native"
  git clone --depth 1 --branch $Ref https://github.com/Harkirat155/ai-native $repoDir | Out-Null

  Push-Location $repoDir
  try {
    npm install | Out-Null
    npm run -s build | Out-Null
    npm run -s package:vsix | Out-Null
    npm run -s package:controller:win | Out-Null

    .\scripts\install.ps1 -Workspace $Workspace
  } finally {
    Pop-Location
  }

  vscode-bridge doctor
}

bootstrap-ai-native -Workspace $Workspace -Ref $Ref

