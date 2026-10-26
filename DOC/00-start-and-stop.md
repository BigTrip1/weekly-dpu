# Start and stop

The review is two programs, plus MongoDB.

| Piece | Folder | Address | What you see |
| --- | --- | --- | --- |
| API | `backend` | http://127.0.0.1:4000 | Requests and upload summaries |
| Web page | `frontend` | http://127.0.0.1:5173 | The dashboard |
| MongoDB | installed separately | 127.0.0.1:27017 | Not started by these steps |

Leave the API window and the page window open while you use the review. Closing a window stops that half.

## Before either start

1. MongoDB is installed and listening on `127.0.0.1:27017`.
2. Node.js is on the PATH. In a terminal, `node -v` prints a version.
3. Dependencies are already installed. See [01-setup-guide.md](01-setup-guide.md) if this PC is new.

## Start by hand

Open the first terminal in the project folder.

```bat
cd backend
npx tsc && node dist/index.js
```

Wait until it prints `DPU API listening on http://127.0.0.1:4000`. The lines above that name the Windows account and the PC.

Open a second terminal in the project folder.

```bat
cd frontend
npx vite --host 127.0.0.1 --port 5173
```

Wait until it prints a local URL. Open http://127.0.0.1:5173.

From the project folder, the same two commands are:

```bat
npm run dev:backend
npm run dev:frontend
```

Run them in two terminals. `dev:backend` compiles the API and then starts it. `dev:frontend` starts the page.

## Start with the script

Double-click `start-dpu.bat` in the project folder, or run it from a terminal:

```bat
start-dpu.bat
```

The script checks that `node` exists and that port 27017 accepts a connection. It then opens two windows:

- **DPU API** compiles `backend` and runs `node dist/index.js`.
- **DPU Web** runs Vite from `frontend` on port 5173.

It does not start MongoDB and it does not use Docker.

## Stop

Close the two windows, or double-click `stop-dpu.bat`.

```bat
stop-dpu.bat
```

That stops whatever is listening on ports 4000 and 5173. MongoDB keeps running.

## What the API window shows

Each line is one request: time, method, path, status, and how long it took. After an upload the window also prints the file name and the counts for inserted rows, exact duplicates skipped, closures refreshed, excluded rows, and operational reviews.

The dashboard makes one extra read-only call, `/api/dashboard/trend`, so each dashboard load shows a `/api/dashboard` line and a `/api/dashboard/trend` line.

Inspector names are not printed there. Open a fault on the dashboard to see who recorded it.
