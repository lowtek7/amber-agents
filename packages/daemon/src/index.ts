/**
 * agentd — Phase 0 walking skeleton.
 *
 * One hardcoded PTY session, streamed to every connected browser over a single
 * /ws WebSocket. Proves the riskiest path end-to-end:
 *
 *   shell (PTY)  ──output──►  ws  ──►  xterm.js
 *        ▲                                  │
 *        └──────────── input/resize ◄───────┘
 *
 * Not in Phase 0 (intentionally): multiple sessions, scrollback replay on
 * reconnect, write-ownership between clients, auth. Those land in Phase 1+.
 */

import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import pty from "node-pty";
import type { ClientMessage, ServerMessage } from "@amber/shared";

const PORT = Number(process.env.PORT ?? 3847);
const HOST = process.env.HOST ?? "127.0.0.1";

// Phase 0: swap this for `claude` / `codex` via AGENT_CMD once the plumbing is
// proven with a plain shell.
const AGENT_CMD =
  process.env.AGENT_CMD ??
  (process.platform === "win32" ? "powershell.exe" : process.env.SHELL ?? "zsh");
const CWD = process.env.AGENT_CWD ?? process.env.HOME ?? process.cwd();

const term = pty.spawn(AGENT_CMD, [], {
  name: "xterm-color",
  cols: 80,
  rows: 24,
  cwd: CWD,
  env: process.env as Record<string, string>,
});

const clients = new Set<WebSocket>();

function broadcast(msg: ServerMessage): void {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

term.onData((data) => broadcast({ type: "output", data }));
term.onExit(({ exitCode }) => broadcast({ type: "exit", code: exitCode }));

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  clients.add(ws);

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.type) {
      case "input":
        term.write(msg.data);
        break;
      case "resize":
        // Phase 0 caveat: with multiple viewers the last resize wins. Single
        // write-owner arbitration is a Phase 1+ concern.
        if (Number.isInteger(msg.cols) && Number.isInteger(msg.rows)) {
          term.resize(msg.cols, msg.rows);
        }
        break;
    }
  });

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

httpServer.listen(PORT, HOST, () => {
  console.log(
    `agentd listening on http://${HOST}:${PORT}  ·  ws path /ws  ·  cmd "${AGENT_CMD}" in ${CWD}`,
  );
});

function shutdown(): void {
  try {
    term.kill();
  } catch {
    /* noop */
  }
  httpServer.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
