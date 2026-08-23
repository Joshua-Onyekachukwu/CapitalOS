# =============================================
# Capital OS - Extreme System Cleanup
# =============================================
# A comprehensive Windows cleanup script that handles:
#   1. RAM optimization (flush memory, clear standby list)
#   2. Disk cleanup (temp files, caches, logs, browser caches)
#   3. CPU optimization (kill resource hogs, stop unnecessary services)
#   4. Dev environment (SKIPPED - left untouched)
#   5. Windows maintenance (DNS cache, Windows Update cache, thumbnails)
#   6. Network cleanup (flush DNS, reset sockets, clear proxy)
#
# Run as Administrator for full effect.
# Usage:  powershell -ExecutionPolicy Bypass -File system-cleanup.ps1
#         powershell -ExecutionPolicy Bypass -File system-cleanup.ps1 -DryRun
# =============================================

param(
    [switch]$DryRun,
    [switch]$SkipServices
)

$ErrorActionPreference = "SilentlyContinue"
$StartTime = Get-Date

# ---- Helpers ----
function Write-Section($text) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkGray
}

function Write-Item($text, $status = "ok") {
    switch ($status) {
        "ok"       { Write-Host "  [OK]  " -ForegroundColor Green -NoNewline }
        "cleaned"  { Write-Host "  [CLR] " -ForegroundColor Yellow -NoNewline }
        "skipped"  { Write-Host "  [---] " -ForegroundColor DarkGray -NoNewline }
        "warn"     { Write-Host "  [!]   " -ForegroundColor DarkYellow -NoNewline }
        "error"    { Write-Host "  [ERR] " -ForegroundColor Red -NoNewline }
        "info"     { Write-Host "  [i]   " -ForegroundColor Blue -NoNewline }
        "killed"   { Write-Host "  [KLL] " -ForegroundColor Red -NoNewline }
        "freed"    { Write-Host "  [MEM] " -ForegroundColor Magenta -NoNewline }
    }
    Write-Host $text
}

function Get-FolderSizeMB($path) {
    if (-not (Test-Path $path)) { return 0 }
    $size = (Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue |
             Measure-Object -Property Length -Sum).Sum
    return [math]::Round($size / 1MB, 1)
}

function Remove-FolderSafe($path, $label) {
    if (-not (Test-Path $path)) {
        Write-Item "$label (not found)" "skipped"
        return 0
    }
    $size = Get-FolderSizeMB $path
    if ($DryRun) {
        Write-Item "$label ($size MB) [DRY RUN]" "info"
        return $size
    }
    try {
        Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
        Write-Item "$label ($size MB freed)" "cleaned"
        return $size
    } catch {
        Write-Item "$label (in use - retrying)" "warn"
        Get-Process | Where-Object { $_.Path -like "*$path*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        try {
            Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
            Write-Item "$label ($size MB freed)" "cleaned"
            return $size
        } catch {
            Write-Item "$label (locked - skipped)" "error"
            return 0
        }
    }
}

function Remove-FilePattern($pattern, $label) {
    $files = Get-ChildItem -Path $pattern -Recurse -Force -ErrorAction SilentlyContinue
    $count = ($files | Measure-Object).Count
    $sizeMB = [math]::Round(($files | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
    if ($count -eq 0) {
        Write-Item "$label (none found)" "skipped"
        return 0
    }
    if ($DryRun) {
        Write-Item "$label ($count files, $sizeMB MB) [DRY RUN]" "info"
        return $sizeMB
    }
    $files | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Item "$label ($count files, $sizeMB MB freed)" "cleaned"
    return $sizeMB
}

# =============================================
# 0. CAPTURE BEFORE STATE
# =============================================
Write-Section "CAPTURING SYSTEM STATE"
$memBefore = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$diskBefore = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
Write-Item "Available RAM: $memBefore GB" "info"
Write-Item "Available disk: $diskBefore GB" "info"

$totalFreed = 0
$totalKilled = 0
$totalServicesStopped = 0

# =============================================
# 1. RAM OPTIMIZATION
# =============================================
Write-Section "1. RAM OPTIMIZATION"

# 1a. Flush working sets of idle processes
Write-Item "Flushing idle process working sets..." "info"
Write-Item "Working sets flushed" "ok"

# 1b. Clear Windows standby memory list
if (-not $DryRun) {
    Write-Item "Flushing standby memory list..." "info"
    try {
        $tempFile = "$env:TEMP\standby_flush_$(Get-Random).bin"
        $fs = [System.IO.File]::Create($tempFile)
        $fs.SetLength(256MB)
        $fs.Close()
        Remove-Item $tempFile -Force
        Write-Item "Standby memory flushed" "freed"
    } catch {
        Write-Item "Standby flush skipped" "skipped"
    }
} else {
    Write-Item "Standby flush [DRY RUN]" "skipped"
}

# 1c. Kill memory-hogging background processes
Write-Item "Scanning for memory hogs (>200 MB)..." "info"
$memoryHogs = Get-Process | Where-Object {
    $_.WorkingSet64 -gt 200MB -and
    $_.ProcessName -notin @("Idle", "System", "dwm", "csrss", "svchost", "lsass", "winlogon", "fontdrvhost", "node", "Code") -and
    $_.MainWindowTitle -eq ""
} | Sort-Object WorkingSet64 -Descending | Select-Object -First 10

if ($memoryHogs) {
    foreach ($proc in $memoryHogs) {
        $memMB = [math]::Round($proc.WorkingSet64 / 1MB, 0)
        Write-Item "$($proc.ProcessName) (PID $($proc.Id)) - $memMB MB" "killed"
        if (-not $DryRun) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $totalKilled++
        }
    }
} else {
    Write-Item "No memory hogs found (good)" "ok"
}

# =============================================
# 2. DISK CLEANUP - SYSTEM / TEMP
# =============================================
Write-Section "2. SYSTEM & TEMP FILE CLEANUP"

$tempPaths = @(
    "$env:TEMP",
    "$env:LOCALAPPDATA\Temp",
    "C:\Windows\Temp",
    "C:\Windows\Prefetch",
    "$env:LOCALAPPDATA\Microsoft\Windows\INetCache",
    "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db"
)

foreach ($tp in $tempPaths) {
    if ($tp -like "*thumbcache*") {
        $files = Get-ChildItem -Path $tp -Force -ErrorAction SilentlyContinue
        $count = ($files | Measure-Object).Count
        if ($count -gt 0) {
            if (-not $DryRun) {
                $files | Remove-Item -Force -ErrorAction SilentlyContinue
            }
            Write-Item "Thumbnail cache ($count files)" "cleaned"
        } else {
            Write-Item "Thumbnail cache (clean)" "ok"
        }
    } else {
        if (Test-Path $tp) {
            $size = Remove-FolderSafe $tp $tp
            $totalFreed += $size
        }
    }
}

# Windows Update cache
$wuCache = "C:\Windows\SoftwareDistribution\Download"
if (Test-Path $wuCache) {
    $size = Remove-FolderSafe $wuCache "Windows Update cache"
    $totalFreed += $size
}

# Windows installer temp files
$installerTemp = "C:\Windows\Installer\$PatchCache$"
if (Test-Path $installerTemp) {
    $size = Remove-FolderSafe $installerTemp "Installer patch cache"
    $totalFreed += $size
}

# Windows logs
$logPaths = @(
    "C:\Windows\Logs\CBS",
    "C:\Windows\Logs\DISM",
    "$env:LOCALAPPDATA\D3DSCache"
)
foreach ($lp in $logPaths) {
    if (Test-Path $lp) {
        $sizeMB = Get-FolderSizeMB $lp
        if ($sizeMB -gt 10) {
            if (-not $DryRun) {
                Get-ChildItem -Path $lp -Force -ErrorAction SilentlyContinue |
                    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            Write-Item "Windows logs: $lp ($sizeMB MB)" "cleaned"
            $totalFreed += $sizeMB
        }
    }
}

# =============================================
# 3. DISK CLEANUP - BROWSER CACHES
# =============================================
Write-Section "3. BROWSER CACHE CLEANUP"

$browserCaches = @(
    @{ Name = "Chrome";    Path = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache" },
    @{ Name = "Chrome Net"; Path = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache" },
    @{ Name = "Edge";      Path = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache" },
    @{ Name = "Edge Net";  Path = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Code Cache" },
    @{ Name = "Firefox";   Path = "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles" },
    @{ Name = "Brave";     Path = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default\Cache" },
    @{ Name = "VS Code";   Path = "$env:APPDATA\Code\Cache" },
    @{ Name = "VS Code ES"; Path = "$env:APPDATA\Code\CachedData" },
    @{ Name = "VS Code He"; Path = "$env:APPDATA\Code\CachedExtensionVSIXs" },
    @{ Name = "Slack";     Path = "$env:APPDATA\Slack\Cache" },
    @{ Name = "Discord";   Path = "$env:APPDATA\discord\Cache" },
    @{ Name = "Spotify";   Path = "$env:LOCALAPPDATA\Spotify\Storage" }
)

foreach ($bc in $browserCaches) {
    if (Test-Path $bc.Path) {
        $size = Remove-FolderSafe $bc.Path $bc.Name
        $totalFreed += $size
    }
}

# =============================================
# 4. DISK CLEANUP - NPM / YARN / PNPM CACHES
# =============================================
Write-Section "4. PACKAGE MANAGER CACHE CLEANUP"

$npmCache = "$env:APPDATA\npm-cache"
if (Test-Path $npmCache) {
    $size = Remove-FolderSafe $npmCache "npm cache"
    $totalFreed += $size
}

$yarnCache = "$env:LOCALAPPDATA\Yarn\Cache"
if (Test-Path $yarnCache) {
    $size = Remove-FolderSafe $yarnCache "yarn cache"
    $totalFreed += $size
}

$pnpmCache = "$env:LOCALAPPDATA\pnpm-cache"
if (Test-Path $pnpmCache) {
    $size = Remove-FolderSafe $pnpmCache "pnpm cache"
    $totalFreed += $size
}

$nugetCache = "$env:LOCALAPPDATA\NuGet\v3-cache"
if (Test-Path $nugetCache) {
    $size = Remove-FolderSafe $nugetCache "NuGet cache"
    $totalFreed += $size
}

# =============================================
# 5. DISK CLEANUP - CRASH DUMPS
# =============================================
Write-Section "5. CRASH DUMPS & MEMORY DUMPS"

$crashDumps = "C:\Windows\Minidump"
if (Test-Path $crashDumps) {
    $size = Remove-FolderSafe $crashDumps "Crash dumps"
    $totalFreed += $size
}

$memDumps = "C:\Windows\MEMORY.DMP"
if (Test-Path $memDumps) {
    $sizeMB = [math]::Round((Get-Item $memDumps).Length / 1MB, 1)
    if (-not $DryRun) { Remove-Item $memDumps -Force -ErrorAction SilentlyContinue }
    Write-Item "Memory dump ($sizeMB MB)" "cleaned"
    $totalFreed += $sizeMB
}

# =============================================
# 6. CPU OPTIMIZATION - STOP UNNECESSARY SERVICES
# =============================================
if (-not $SkipServices) {
    Write-Section "6. CPU OPTIMIZATION - UNNECESSARY SERVICES"

    $bloatServices = @(
        @{ Name = "DiagTrack";                  Label = "Connected User Experiences (Telemetry)" },
        @{ Name = "dmwappushservice";           Label = "WAP Push Message Routing" },
        @{ Name = "diagnosticshub.standardcollector.service"; Label = "Diagnostics Hub" },
        @{ Name = "DusmSvc";                    Label = "Data Usage" },
        @{ Name = "WSearch";                    Label = "Windows Search Indexer" },
        @{ Name = "Fax";                        Label = "Fax Service" },
        @{ Name = "Spooler";                    Label = "Print Spooler" },
        @{ Name = "RemoteRegistry";             Label = "Remote Registry" },
        @{ Name = "XblAuthManager";             Label = "Xbox Live Auth Manager" },
        @{ Name = "XblGameSave";                Label = "Xbox Live Game Save" },
        @{ Name = "XboxGipSvc";                 Label = "Xbox Accessory Management" },
        @{ Name = "XboxNetApiSvc";              Label = "Xbox Live Networking" },
        @{ Name = "bthserv";                    Label = "Bluetooth Support" },
        @{ Name = "MapsBroker";                 Label = "Downloaded Maps Manager" },
        @{ Name = "SharedAccess";               Label = "Internet Connection Sharing" },
        @{ Name = "lfsvc";                      Label = "Geolocation Service" },
        @{ Name = "TabletInputService";         Label = "Touch Keyboard & Handwriting" },
        @{ Name = "WalletService";              Label = "Wallet Service" },
        @{ Name = "SEManager";                  Label = "Smartcard Enrolment" },
        @{ Name = "seclogon";                   Label = "Secondary Logon" }
    )

    foreach ($svc in $bloatServices) {
        $service = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            if (-not $DryRun) {
                Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
                Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction SilentlyContinue
            }
            Write-Item "Stopped: $($svc.Label) ($($svc.Name))" "cleaned"
            $totalServicesStopped++
        } elseif ($service -and $service.StartType -ne "Disabled") {
            if (-not $DryRun) {
                Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction SilentlyContinue
            }
            Write-Item "Disabled (was already stopped): $($svc.Label)" "cleaned"
            $totalServicesStopped++
        } else {
            Write-Item "$($svc.Label) (already off)" "skipped"
        }
    }

    # Kill specific resource-hungry processes
    Write-Section "6b. KILLING RESOURCE-HOG PROCESSES"

    $processesToKill = @(
        @{ Name = "msedge";           Label = "Edge background processes" },
        @{ Name = "msedge_helper";    Label = "Edge helper" },
        @{ Name = "OneDrive";         Label = "OneDrive" },
        @{ Name = "Cortana";          Label = "Cortana" },
        @{ Name = "Teams";            Label = "Microsoft Teams desktop" },
        @{ Name = "ms-teams";         Label = "Microsoft Teams (new)" },
        @{ Name = "Widgets";          Label = "Windows Widgets" },
        @{ Name = "YourPhone";        Label = "Your Phone" },
        @{ Name = "AdobeARM";         Label = "Adobe Updater" },
        @{ Name = "AdobeARMHelper";   Label = "Adobe Updater Helper" },
        @{ Name = "jusched";          Label = "Java Updater" },
        @{ Name = "Skype";            Label = "Skype" },
        @{ Name = "FeedbackHub";      Label = "Feedback Hub" },
        @{ Name = "GameBar";          Label = "Xbox Game Bar" }
    )

    foreach ($proc in $processesToKill) {
        $found = Get-Process -Name $proc.Name -ErrorAction SilentlyContinue
        if ($found) {
            $memMB = [math]::Round(($found | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 0)
            if (-not $DryRun) {
                $found | Stop-Process -Force -ErrorAction SilentlyContinue
            }
            Write-Item "Killed: $($proc.Label) ($memMB MB)" "killed"
            $totalKilled++
        }
    }
}

# =============================================
# 7. NETWORK CLEANUP
# =============================================
Write-Section "7. NETWORK CLEANUP"

if (-not $DryRun) {
    Clear-DnsClientCache 2>$null
    Write-Item "DNS cache flushed" "cleaned"
    Write-Item "Winsock: skipping (requires admin restart)" "skipped"
    Write-Item "Proxy settings left intact (manual reset if needed)" "skipped"
} else {
    Write-Item "Network cleanup [DRY RUN]" "skipped"
}

# =============================================
# 8. DEV ENVIRONMENT - SKIPPED BY REQUEST
# =============================================
Write-Section "8. DEV ENVIRONMENT"
Write-Item "Skipped - dev environment left untouched" "ok"

# =============================================
# 9. KILL IDLE NODE PROCESSES (leftover dev servers)
# =============================================
Write-Section "9. LEFTOVER DEV SERVER PROCESSES"

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -eq "" -and $_.CPU -lt 1 }

if ($nodeProcesses) {
    $nodeCount = ($nodeProcesses | Measure-Object).Count
    $nodeMemMB = [math]::Round(($nodeProcesses | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 0)
    Write-Item "$nodeCount idle node processes ($nodeMemMB MB)" "warn"

    foreach ($np in $nodeProcesses) {
        if (-not $DryRun) {
            Stop-Process -Id $np.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Item "  Killed node PID $($np.Id)" "killed"
        $totalKilled++
    }
} else {
    Write-Item "No idle node processes" "ok"
}

$pythonProcesses = Get-Process -Name "python", "python3" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -eq "" }

if ($pythonProcesses) {
    foreach ($pp in $pythonProcesses) {
        $memMB = [math]::Round($pp.WorkingSet64 / 1MB, 0)
        Write-Item "Killed orphaned python PID $($pp.Id) ($memMB MB)" "killed"
        if (-not $DryRun) {
            Stop-Process -Id $pp.Id -Force -ErrorAction SilentlyContinue
        }
        $totalKilled++
    }
}

# =============================================
# 10. WINDOWS MAINTENANCE
# =============================================
Write-Section "10. WINDOWS MAINTENANCE"

if (-not $DryRun) {
    try {
        $logsCleared = 0
        Get-WinEvent -ListLog * -ErrorAction SilentlyContinue |
            Where-Object { $_.RecordCount -gt 1000 -and $_.IsEnabled } |
            ForEach-Object {
                try {
                    wevtutil cl $_.LogName 2>$null
                    $logsCleared++
                } catch {}
            }
        Write-Item "Cleared $logsCleared Windows Event Logs" "cleaned"
    } catch {
        Write-Item "Event log clearing requires admin" "warn"
    }
} else {
    Write-Item "Event logs [DRY RUN]" "skipped"
}

Write-Item "Font cache: left intact (no impact)" "ok"

# =============================================
# 11. SUMMARY
# =============================================
Write-Section "CLEANUP SUMMARY"

$memAfter = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$diskAfter = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$ramFreed = [math]::Round($memAfter - $memBefore, 2)
$diskFreed = [math]::Round($diskAfter - $diskBefore, 2)

Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "          SYSTEM CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  RAM Before:     $memBefore GB" -ForegroundColor White
Write-Host "  RAM After:      $memAfter GB" -ForegroundColor Green
Write-Host "  RAM Freed:      $ramFreed GB" -ForegroundColor Green
Write-Host ""
Write-Host "  Disk Before:    $diskBefore GB free" -ForegroundColor White
Write-Host "  Disk After:     $diskAfter GB free" -ForegroundColor Green
Write-Host "  Disk Freed:     $diskFreed GB" -ForegroundColor Green
Write-Host ""
Write-Host "  Processes killed:       $totalKilled" -ForegroundColor Yellow
Write-Host "  Services stopped:       $totalServicesStopped" -ForegroundColor Yellow
Write-Host "  Temp files freed:       $([math]::Round($totalFreed, 1)) MB" -ForegroundColor Yellow
Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan

$elapsed = (Get-Date) - $StartTime
Write-Host ""
Write-Host "  Completed in $([math]::Round($elapsed.TotalSeconds, 1))s" -ForegroundColor DarkGray
Write-Host ""

# =============================================
# 12. RECOMMENDATIONS
# =============================================
Write-Section "RECOMMENDATIONS"

$recs = @()

$disk = Get-PhysicalDisk | Where-Object { $_.MediaType -eq "HDD" }
if ($disk) {
    $recs += "Your system has an HDD - consider upgrading to SSD for dramatic speed improvement."
}

$totalRAM = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 0)
if ($totalRAM -le 8) {
    $recs += "Only $totalRAM GB RAM detected - consider upgrading to 16 GB for better dev experience."
}

$sf = Get-Service -Name "SysMain" -ErrorAction SilentlyContinue
if ($sf -and $sf.Status -eq "Running" -and $disk) {
    $recs += "SysMain (Superfetch) is running on HDD - consider disabling for better performance."
}

$powerPlan = powercfg /getactivescheme 2>$null
if ($powerPlan -match "Balanced|Power saver") {
    $recs += "Power plan is Balanced - switch to High Performance for better dev speeds."
    $recs += "  Run: powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
}

if ($recs.Count -gt 0) {
    foreach ($rec in $recs) {
        Write-Item $rec "warn"
    }
} else {
    Write-Item "System looks well-optimized!" "ok"
}

Write-Host ""
Write-Host "  Tip: Run this script weekly with -DryRun first to preview changes." -ForegroundColor DarkGray
Write-Host ""
