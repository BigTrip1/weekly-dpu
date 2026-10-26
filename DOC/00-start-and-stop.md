# Start and stop

The review is two programs, plus MongoDB.

| Piece | Folder | Address | What you see |
| --- | --- | --- | --- |
| API | `backend` | http://127.0.0.1:4213 | Requests and upload summaries |
| Web page | `frontend` | http://127.0.0.1:3124 | The dashboard |
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

Wait until it prints `DPU API listening on http://127.0.0.1:4213`. The lines above that name the Windows account and the PC, and the lines below list the Network addresses of this PC.

Open a second terminal in the project folder.

```bat
cd frontend
npm run dev
```

For production, run `npm run build` and then `npm start` in `frontend`, and `npm start` in `backend`.

Wait until it prints the Local and Network URLs. Open http://127.0.0.1:3124 on this PC. People on the same network open the Network URL, for example http://192.168.1.20:3124. Windows may ask to allow Node.js through the firewall the first time. Allow it on private networks.

If the page only prints http://127.0.0.1:3124 or http://localhost:3124 and no Network line, the PC is running an old copy of the code. Run `git pull origin main`. `npm run dev` in `frontend` now starts on all network addresses on port 3124.

If other PCs cannot open the Network URL even though it is printed, Windows Firewall is blocking them. This is common when the PC network is set to Public. Double-click `allow-network.bat` once on the PC that runs the servers and accept the administrator prompt. It opens ports 3124 and 4213 to the local network only. `start-dpu.bat` prints a reminder when that rule is missing. If no Network line is printed at all, the PC has no active network connection, or the code is old: run `git pull origin main` and start again.

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

It asks whether to start in Dev or Production. Press D or P. To skip the question, double-click `start-dpu-dev.bat` or `start-dpu-prod.bat`, or run `start-dpu.bat dev` or `start-dpu.bat prod`.

| Mode | Page window runs | API window runs | Use it for |
| --- | --- | --- | --- |
| Dev | `npm run dev` in `frontend` (Vite with live reload) | `npm run dev` in `backend` | Editing the code |
| Production | `npm run build` first, then `npm start` in `frontend` (serves the built files from `frontend/dist`) | `npm start` in `backend` | Sharing the page with others. If the build fails nothing is started |

Both modes use port 3124 for the page and 4213 for the API, so stop one before starting the other. The script checks that `node` exists and that port 27017 accepts a connection. It then opens the two windows. Production does not reload on code changes. Run the script again after a `git pull`.

It does not start MongoDB and it does not use Docker.

## Stop

Close the two windows, or double-click `stop-dpu.bat`.

```bat
stop-dpu.bat
```

That stops whatever is listening on ports 4213 and 3124. MongoDB keeps running.

## What the API window shows

Each line is one request: time, method, path, status, and how long it took. After an upload the window also prints the file name and the counts for inserted rows, exact duplicates skipped, closures refreshed, excluded rows, and operational reviews.

The dashboard makes one extra read-only call, `/api/dashboard/trend`, so each dashboard load shows a `/api/dashboard` line and a `/api/dashboard/trend` line. The Analytics page logs lines starting `/api/analytics`.

Inspector names are not printed there. Open a fault on the dashboard to see who recorded it.
