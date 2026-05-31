# amber-agents

Self-hosted control plane for remote CLI agents (Claude Code, Codex, …).
CLI-first, accessed from anywhere over a Tailscale tailnet.

## Status: Phase 1 — multi-session

Multiple PTY sessions, managed from one dashboard and multiplexed over a single
`/ws`:

```
session A (PTY) ─┐                           ┌─ sidebar: list + create + kill
session B (PTY) ─┼─ headless xterm (snapshot)┤
session C (PTY) ─┘        │                  └─ terminal: attach → snapshot → live
                          ▼
                  /ws  ◄────►  xterm.js (browser/phone)
```

- create / kill sessions from the sidebar (type a command, or leave blank for a shell)
- a client that connects late gets a **snapshot replay** (full screen, not just
  output-from-now) — switch sessions or reopen on your phone and history is there
- disconnecting never kills a session; the agent keeps running
- `GET /api/sessions` returns the session list as JSON

Not yet: state inference (generating / waiting-approval) badges, notifications,
auth, restart-survival (session-host process split). Those are Phase 2+.

## Layout

| Package | Purpose |
| --- | --- |
| `packages/daemon` | Node daemon: spawns the PTY, serves `/ws` (node-pty + ws) |
| `packages/web` | React + Vite + xterm.js dashboard |
| `packages/shared` | Wire-protocol types shared by both |

## Run (dev)

```bash
pnpm install
pnpm dev          # daemon on :3847, web on :3000 (both, via concurrently)
```

Open http://localhost:3000. One session is created for you; make more from the
sidebar — type a command like `claude` (blank = a shell), click ＋, and switch
between them. Set the daemon's default command/cwd with env vars:

```bash
AGENT_CMD=claude AGENT_CWD=~/some/project pnpm dev:daemon
# in another terminal:
pnpm dev:web
```

### From your phone (Tailscale)

The Vite dev server binds `0.0.0.0`, so on the tailnet just open
`http://<this-machine>:3000` from your phone. For HTTPS + auto cert:

```bash
tailscale serve 3000
```

## Phase 0 caveats (by design)

- All browsers share the **one** PTY (nice mirror, but last `resize` wins —
  single write-owner arbitration comes in Phase 1).
- No history replay: a client that connects late sees output only from now on.
