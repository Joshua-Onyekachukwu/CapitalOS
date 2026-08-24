# Capital OS — Preview Run Doc

## How to Reproduce Artifacts

1. Copy `.env.local` from the main checkout if not already present.
2. Install dependencies: `npm install` (in project root).

## How to Run the Server

```bash
cd "C:/Users/engrf/Joshua Dev/Capital OS"
PORT=3456 npx next dev -p 3456
```

- Port: **3456** (never use port 3000)
- Detach: run in background with `& disown` or use PowerShell `Start-Process`
- Build: `npm run build` (uses webpack)

## Port Policy

**Port 3000 is permanently retired.** All code, config, tests, and docs use port 3456.
Never start the dev server on port 3000 again.
