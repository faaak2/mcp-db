<#
.SYNOPSIS
  Runs Ralph in a loop — up to N iterations, stopping early on COMPLETE or BLOCKED.
.PARAMETER Iterations
  Maximum number of iterations (default: 10).
#>
param(
    [int]$Iterations = 10
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

$prompt = @"
You are Ralph, an autonomous coding agent. Follow these steps exactly:

1. Read PRD.md to understand the full project plan.
2. Read progress.txt (create it if missing — start empty).
3. Pick the FIRST unchecked task (- [ ]) from the PRD that is NOT listed as done in progress.txt.
   If all tasks are done, output exactly RALPH_COMPLETE and stop.
4. Implement ONLY that one task. Follow the PRD instructions precisely.
5. Run the test/verification described in the PRD for that task. Fix issues until it passes.
6. Stage and commit your changes with a clear commit message describing what was done.
7. Append a line to progress.txt: "DONE: <task summary>" so the next iteration skips it.
8. Output exactly RALPH_TASK_DONE when finished.

Rules:
- ONE task per session. Do not continue to the next task.
- If a task is blocked or unclear, describe the blocker in progress.txt and output RALPH_BLOCKED.
- Never delete or rewrite progress.txt — only append.
"@

Write-Host "=== AFK Ralph: Up to $Iterations iterations ===" -ForegroundColor Cyan
Write-Host ""

for ($i = 1; $i -le $Iterations; $i++) {
    Clear-Host
    Write-Host "=== AFK Ralph: Iteration $i / $Iterations ===" -ForegroundColor Cyan
    Write-Host ""

    if (Test-Path "progress.txt") {
        Write-Host "--- Progress so far ---" -ForegroundColor DarkGray
        Get-Content "progress.txt" | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        Write-Host "---" -ForegroundColor DarkGray
    } else {
        Write-Host "  (no progress yet)" -ForegroundColor DarkGray
    }
    Write-Host ""

    $output = claude --print --dangerously-skip-permissions "$prompt" 2>&1
    $outputStr = $output | Out-String

    # Check for stop signals in the output
    if ($outputStr -match "RALPH_COMPLETE") {
        Write-Host ""
        Write-Host "=== PRD complete! Stopped after $i iteration(s). ===" -ForegroundColor Green
        Pop-Location
        exit 0
    }

    if ($outputStr -match "RALPH_BLOCKED") {
        Write-Host ""
        Write-Host "=== Task blocked. Stopped after $i iteration(s). Check progress.txt ===" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host ""
}

Write-Host "=== AFK Ralph: Reached max iterations ($Iterations). Check progress with: git log --oneline ===" -ForegroundColor Yellow

Pop-Location
exit 0
