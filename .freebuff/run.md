# Capital-OS Dev Server

## Prerequisites
- Node.js 18+ installed
- `npm install` already run (node_modules present)

## Reproduce from a fresh checkout
1. Copy `.env.local` from the main checkout (contains placeholder Supabase keys — no real secrets)
2. Run `npm install`

## Start the dev server
```powershell
powershell -NoProfile -Command "Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules\next\dist\bin\next','dev','-p','3000' -WorkingDirectory '<project-root>' -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id"
```

- Default port: **3000**
- Logs go to `.freebuff/server-stdout.log` and `.freebuff/server-stderr.log` (if using -RedirectStandardOutput/Error)
- Confirm alive: `netstat -ano | findstr :3000` or check `Get-Process -Id <pid>`

## Stop
Kill the node process by PID.
