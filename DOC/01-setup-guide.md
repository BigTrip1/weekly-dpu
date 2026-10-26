# Setup on another PC

Use this when the review is being copied onto a machine that does not have it yet. Day-to-day start and stop is in [00-start-and-stop.md](00-start-and-stop.md).

## What the PC needs

- Windows 10 or 11.
- Node.js 20 or newer, on the PATH.
- MongoDB Community Server, listening on `127.0.0.1:27017`. The database name is `weekly_dpu`. The API creates the collections on first start.
- The project folder, including `frontend`, `backend`, `package.json`, `start-dpu.bat`, and `stop-dpu.bat`.

Docker is optional. [docker-compose.yml](../docker-compose.yml) can start MongoDB 7 on port 27017 if this PC does not already have MongoDB. Do not start that compose file while a local MongoDB already owns port 27017.

## Install the dependencies

From the project folder, `npm install` on npm 11 has failed on this project with `Cannot read properties of undefined (reading 'spec')`. The install that worked was Bun 1.3:

```bat
bun install --cwd backend
bun install --cwd frontend
```

The frontend uses these packages, all installed by the same `bun install`: `tailwindcss` and `@tailwindcss/vite`, `radix-ui` (behind the shadcn/ui components), `recharts`, `motion`, `lucide-react`, `sonner`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`, and the font packages `@fontsource-variable/inter` and `@fontsource/barlow-condensed`. The fonts ship inside the build, so the page does not call out to the internet.

Add another shadcn component from the `frontend` folder with `bunx shadcn@latest add <name>`. `frontend/components.json` already points the CLI at `src/components/ui` and the `@/` alias.

If `npm install --prefix backend` and `npm install --prefix frontend` succeed on the new PC, that is fine. The scripts still run with `npm` and `npx` after the packages are present.

## First start

1. Start MongoDB and confirm port 27017 is open. `start-dpu.bat` does this for you.
2. Follow [00-start-and-stop.md](00-start-and-stop.md).
3. Open http://127.0.0.1:3124.
4. On a brand-new database the API seeds the comment rules and the known department map the first time it connects.

## Ports

| Port | Program |
| --- | --- |
| 27017 | MongoDB |
| 4213 | API |
| 3124 | Web page. Calls to `/api` are forwarded to port 4213 |

The page is only bound to `127.0.0.1` when started by the bat file or the manual Vite command in the start guide. It is not exposed on the network by those commands.

## Files worth knowing

- `backend/.env` is not required. `MONGO_URL` and `MONGO_DB` override the defaults if you set them in the environment. `PORT` overrides 4213.
- Uploaded workbooks are parsed from a temporary file and then deleted. They are not kept in `backend/uploads`.
- `samples/mock-faults-jan-2026-to-date.xlsx` is a fictional extract for an upload test. Read [02-upload-sop.md](02-upload-sop.md) before loading it into a database that already holds real faults.
