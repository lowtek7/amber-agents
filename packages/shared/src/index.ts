/**
 * Wire protocol shared between daemon and web.
 *
 * Phase 0: a single hardcoded session. There is no sessionId yet — the daemon
 * owns exactly one PTY and every connected client mirrors it. When we move to
 * multi-session (Phase 1), these message types grow a `sessionId` field.
 */

/** daemon -> browser */
export type ServerMessage =
  | { type: "output"; data: string }
  | { type: "exit"; code: number };

/** browser -> daemon */
export type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };
