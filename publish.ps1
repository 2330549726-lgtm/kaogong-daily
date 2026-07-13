$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Publish Kaogong Daily"
Set-Location $PSScriptRoot

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($GitArgs -join ' ')"
    }
}

try {
    Write-Host "========================================"
    Write-Host "  Publish website to GitHub Pages"
    Write-Host "========================================"
    Write-Host

    Invoke-Git add -A
    & git diff --cached --quiet
    $diffExitCode = $LASTEXITCODE

    if ($diffExitCode -eq 0) {
        Write-Host "No local changes to publish."
        Read-Host "Press Enter to close"
        exit 0
    }
    if ($diffExitCode -ne 1) {
        throw "Unable to inspect staged changes."
    }

    Write-Host "[1/3] Creating a local commit..."
    Invoke-Git commit -m "Publish website update"

    Write-Host
    Write-Host "[2/3] Syncing remote daily updates..."
    Invoke-Git pull --rebase origin main

    Write-Host
    Write-Host "[3/3] Uploading to GitHub..."
    Invoke-Git push origin main

    Write-Host
    Write-Host "Publish complete. GitHub Pages normally updates in 1-3 minutes."
    Read-Host "Press Enter to close"
    exit 0
}
catch {
    Write-Host
    Write-Host "Publish stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Your files were not deleted. Keep this window open and check the message above."
    Read-Host "Press Enter to close"
    exit 1
}
