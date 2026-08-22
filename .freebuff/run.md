# Capital-OS Dev Server

## Prerequisites
- Node.js 18+ installed
- `npm install` already run (node_modules present)
- `.env.local` present (Supabase + Apollo keys)

## Reproduce from a fresh checkout
1. Copy `.env.local` from the main checkout (contains Supabase and Apollo keys)
2. Run `npm install`

## Start the dev server
```powershell
powershell -NoProfile -Command "Remove-Item -Recurse -Force '.next' -ErrorAction SilentlyContinue; (Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '.freebuff\preview-7277189d-1966-44fc-b194-381cf3dfe6f4.log' -RedirectStandardError '.freebuff\preview-7277189d-1966-44fc-b194-381cf3dfe6f4.log.err' -WorkingDirectory 'C:\Users\engrf\Joshua Dev\Capital OS' -WindowStyle Hidden -PassThru).Id"
```

- Default port: **3000** (may auto-select higher port if 3000 is occupied)
- Logs go to `.freebuff/preview-7277189d-*.log` and `.freebuff/preview-7277189d-*.log.err`
- Confirm alive: `netstat -ano | findstr :PORT` or `Get-Process -Id <pid>`

## Notes
- Next.js 16.3.2 with Turbopack
- Middleware file convention is deprecated (Next.js warns about this)
- If another next dev server is running, kill it first or it will auto-pick a different port

## Stop
Kill the node process by PID.
