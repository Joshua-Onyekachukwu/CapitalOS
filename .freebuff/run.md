# Capital-OS Dev Server

## Prerequisites
- Node.js 18+ installed
- `npm install` already run (node_modules present)

## Reproduce from a fresh checkout
1. Copy `.env.local` from the main checkout (contains placeholder Supabase keys — no real secrets)
2. Run `npm install`

## Start the dev server
```powershell
# From the project root:
powershell -NoProfile -Command "Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules\next\dist\bin\next','dev' -WorkingDirectory 'C:\Users\engrf\Joshua Dev\Capital OS' -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id"
```

- The default port is chosen by Next.js (currently **62447**).
- Logs go to `.freebuff/preview-7277189d-1966-44fc-b194-381cf3dfe6f4.log` (stdout) and `.freebuff/preview-7277189d-1966-44fc-b194-381cf3dfe6f4.log.err` (stderr).
- Confirm alive: `powershell -NoProfile -Command "Get-Process -Id <pid>"` or check `netstat -ano | findstr :62447`.

## Stop
Kill the node process by PID.
