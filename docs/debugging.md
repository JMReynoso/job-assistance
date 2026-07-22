# Debugging the API from VS Code

This guide shows how to pause the running API on any line, look at what the code
is actually doing, and step through it — all from inside VS Code. No prior
debugger experience assumed.

If you've only ever debugged with `console.log`, this is the upgrade: instead of
sprinkling print statements and re-running, you set a **breakpoint** and the app
freezes right there so you can poke around.

---

## What "debugging" means here, in plain terms

1. You click next to a line number to drop a **breakpoint** (a red dot).
2. You start the API with the debugger attached.
3. When a request reaches that line, the app **pauses**.
4. While it's paused you can hover over any variable to see its value, run little
   expressions, and step forward one line at a time.
5. You press play to let it keep going.

That's it. The app isn't broken while paused — it's just waiting for you.

---

## Before you start (one-time)

1. **Install dependencies** (if you haven't):
   ```bash
   cd api
   npm install
   ```
2. **Start the database.** The API connects to Postgres and runs migrations the
   moment it boots, so the database has to be up first, or the app exits before
   you can debug anything. From the repo root:
   ```bash
   docker compose -f infra/docker-compose.dev.yml up postgres
   ```
   (That starts *only* Postgres. Leave it running in its own terminal.)
3. Make sure `api/.env` exists (copy `api/.env.example` if not) and points at that
   database.

---

## The quick way (one click)

1. Open the **Run and Debug** panel: click the ▷ bug icon in the left sidebar, or
   press `Ctrl+Shift+D`.
2. At the top there's a dropdown of configurations. Pick **"Debug API"**.
3. Press the green play button (or hit `F5`).
   - VS Code compiles the app, starts it under the debugger, and streams the logs
     into the integrated terminal. When you see it listening on port **4001**,
     it's ready.
4. **Set a breakpoint.** Open a file you want to inspect — say
   [company-research.service.ts](../api/src/entities/companyResearch/company-research.service.ts)
   — and click in the empty space just left of a line number. A red dot appears.
5. **Trigger that code.** Hit the endpoint that runs it. Easiest is the built-in
   Swagger UI at <http://localhost:4001/> — find the route, click "Try it out",
   "Execute". (Or use `curl`, or the frontend.)
6. VS Code jumps to the front and the line with the red dot is now highlighted —
   the app is paused there. 🎉

---

## What you can do while it's paused

| You want to… | How |
| --- | --- |
| See a variable's value | Hover your mouse over it, or look at the **Variables** panel on the left. |
| Try an expression (e.g. `dto.companyName`) | Type it into the **Debug Console** at the bottom and press Enter. |
| Run the next line | **Step Over** — `F10`. |
| Go *into* a function call on this line | **Step Into** — `F11`. |
| Finish the current function and come back out | **Step Out** — `Shift+F11`. |
| Let the app keep running until the next breakpoint | **Continue** — `F5`. |
| Stop debugging | **Stop** — `Shift+F5`. |

The floating toolbar at the top of the window has buttons for all of these if you
prefer clicking to key combos.

---

## Watch mode: it restarts when you save

"Debug API" runs in **watch mode** — save a `.ts` file and the app recompiles and
restarts on its own. Your breakpoints stay put; the debugger re-attaches
automatically. So the normal loop is: set a breakpoint → change code → save →
trigger the endpoint again.

---

## Debugging the API inside Docker (full stack)

The "quick way" above runs the API **on your host** and expects only Postgres in
Docker. If instead you run the **whole stack** in Docker
(`docker compose -f infra/docker-compose.dev.yml up`), use this flow — otherwise
you'll have two copies of the API fighting over port `4001`, and your requests
hit the container (no debugger) while VS Code is attached to nothing.

1. **Start the stack** (from the repo root):
   ```bash
   docker compose -f infra/docker-compose.dev.yml up
   ```
   The `api` service already runs under the Node inspector on `0.0.0.0:9229`,
   published to your host. (Don't also run "Debug API" — that's the host copy and
   it will collide on port 4001.)
2. In **Run and Debug** (`Ctrl+Shift+D`), pick **"Debug API: attach (Docker)"**
   and press `F5`. VS Code connects to the debugger inside the container.
3. Set a breakpoint in any `src/**/*.ts` and hit the endpoint (Swagger at
   <http://localhost:4001/>). Execution pauses on your line. 🎉

Save a `.ts` file and watch mode recompiles/restarts the container process; the
debugger re-attaches on its own (`restart: true`).

---

## The other configurations

You usually only need "Debug API" (host) or "Debug API: attach (Docker)", but the
dropdown has more:

- **Debug API: attach** — for when you *already* started the app yourself on the
  host with `npm run start:debug` in a terminal. This just hooks the debugger
  onto that running process (it listens on port `9229`) instead of starting a new
  one.
- **Debug API: attach (Docker)** — attach to the API running **inside** the
  Docker container (see the section above).
- **Debug API: current Jest test** — debug a **test** instead of the live app.
  Open the `*.spec.ts` file you want, set your breakpoints, make sure this config
  is selected, and press `F5`. It runs just that test file, paused wherever you
  asked.

---

## When a breakpoint won't hit

- **The dot is a hollow grey circle, not red.** The code with the breakpoint
  isn't loaded/running yet. Make sure the app actually started (check the
  terminal) and that you're hitting the route that reaches that line.
- **The app exited immediately.** Almost always the database isn't running — go
  back to [Before you start](#before-you-start-one-time) and launch Postgres.
- **"Port 9229 is already in use."** An old debug session is still alive. Stop it
  (`Shift+F5`), or close the leftover terminal, and try again.
- **Nothing pauses at all.** Confirm the request is really reaching the API
  (watch the log lines appear in the terminal when you call the endpoint).

---

## Where the settings live

All of this is driven by [`.vscode/launch.json`](../.vscode/launch.json) at the
repo root. You don't normally need to touch it — it's committed so the whole team
shares the same setup — but that's the file to edit if you want to add a new
configuration.
