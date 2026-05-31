/**
 * agentd — Phase 1.
 *
 * Multiple PTY sessions multiplexed over one /ws connection.
 *
 *   create / kill        -> SessionManager spawns / terminates a PTY
 *   attach <id>          -> server replays a snapshot, then streams live output
 *   input / resize <id>  -> forwarded to that session's PTY
 *
 * The session list is pushed to every client on change. A disconnecting client
 * never kills sessions — that's the whole point (close your phone, the agent
 * keeps working). `GET /api/sessions` exposes the list for scripting.
 */

import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@amber/shared";
import { SessionManager } from "./session-manager.js";

const PORT = Number(process.env.PORT ?? 3847);
const HOST = process.env.HOST ?? "127.0.0.1";

/** ws -> set of sessionIds it is subscribed to */
const clients = new Map<WebSocket, Set<string>>();

function broadcast(msg: ServerMessage): void {
  const payload = JSON.stringify(msg);
  for (const ws of clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

function sendToSubscribers(sessionId: string, msg: ServerMessage): void {
  const payload = JSON.stringify(msg);
  for (const [ws, subs] of clients) {
    if (subs.has(sessionId) && ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

const manager = new SessionManager({
  onOutput: (sessionId, data) =>
    sendToSubscribers(sessionId, { type: "output", sessionId, data }),
  onExit: (sessionId, code) =>
    sendToSubscribers(sessionId, { type: "exit", sessionId, code }),
  onChange: () => broadcast({ type: "sessions", sessions: manager.list() }),
});

// Start with one ready-to-use session so the dashboard isn't empty on first load.
manager.create();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.url === "/api/sessions") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(manager.list()));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  clients.set(ws, new Set());
  ws.send(JSON.stringify({ type: "sessions", sessions: manager.list() } satisfies ServerMessage));

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const subs = clients.get(ws);
    switch (msg.type) {
      case "create":
        try {
          manager.create({ agent: msg.agent, cwd: msg.cwd, title: msg.title });
        } catch (e) {
          console.error("create failed:", (e as Error).message);
        }
        break;
      case "attach": {
        // Synchronous on purpose: serialize + send the snapshot, THEN subscribe.
        // No PTY 'data' event can interleave mid-handler (single-threaded), so
        // the client never misses bytes or double-renders them.
        const snap = manager.snapshot(msg.sessionId);
        if (snap != null) {
          ws.send(
            JSON.stringify({
              type: "snapshot",
              sessionId: msg.sessionId,
              data: snap,
            } satisfies ServerMessage),
          );
        }
        subs?.add(msg.sessionId);
        break;
      }
      case "detach":
        subs?.delete(msg.sessionId);
        break;
      case "input":
        manager.write(msg.sessionId, msg.data);
        break;
      case "resize":
        if (
          Number.isInteger(msg.cols) &&
          Number.isInteger(msg.rows) &&
          msg.cols > 0 &&
          msg.rows > 0
        ) {
          manager.resize(msg.sessionId, msg.cols, msg.rows);
        }
        break;
      case "kill":
        manager.kill(msg.sessionId);
        break;
    }
  });

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

httpServer.listen(PORT, HOST, () => {
  console.log(
    `agentd listening on http://${HOST}:${PORT}  ·  ws /ws  ·  GET /api/sessions`,
  );
});

function shutdown(): void {
  manager.disposeAll();
  httpServer.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
