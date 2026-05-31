# amber-agents

Self-hosted control plane for remote CLI agents (Claude Code, Codex, …).
CLI-first, accessed from anywhere over a Tailscale tailnet.

## Status: Phase 0 — walking skeleton

One hardcoded terminal session, mirrored end-to-end:

```
shell/agent (PTY)  ──output──►  /ws  ──►  xterm.js (browser/phone)
        ▲                                       │
        └──────────────── input/resize ◄────────┘
```

Not yet: multiple sessions, scrollback replay on reconnect, state badges,
notifications, auth. Those are Phase 1+.

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

Open http://localhost:3000. A shell appears; type into it.

Point it at a real agent instead of a shell:

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
