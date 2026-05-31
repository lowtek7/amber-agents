/**
 * Wire protocol shared between daemon and web.
 *
 * Phase 1: multiple sessions multiplexed over a single /ws connection. Every
 * session-scoped message carries a `sessionId`. A client subscribes to a
 * session's live output with `attach` (which first replays a `snapshot`) and
 * stops with `detach`. The session list is pushed to all clients on every
 * change.
 */

export type SessionState = "running" | "exited";

export interface SessionInfo {
  id: string;
  title: string;
  /** the spawned command, e.g. "zsh" or "claude" */
  agent: string;
  cwd: string;
  state: SessionState;
  createdAt: number;
  exitCode?: number;
}

/** browser -> daemon */
export type ClientMessage =
  | { type: "create"; agent?: string; cwd?: string; title?: string }
  | { type: "attach"; sessionId: string }
  | { type: "detach"; sessionId: string }
  | { type: "input"; sessionId: string; data: string }
  | { type: "resize"; sessionId: string; cols: number; rows: number }
  | { type: "kill"; sessionId: string };

/** daemon -> browser */
export type ServerMessage =
  | { type: "sessions"; sessions: SessionInfo[] }
  | { type: "snapshot"; sessionId: string; data: string }
  | { type: "output"; sessionId: string; data: string }
  | { type: "exit"; sessionId: string; code: number };
