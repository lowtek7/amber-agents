/**
 * SessionManager — owns every PTY-backed agent session.
 *
 * Each session pairs a real process (node-pty) with a headless xterm terminal
 * that mirrors its output. The headless terminal is what lets a client that
 * connects late (e.g. your phone) get a `snapshot` and see the full screen,
 * instead of only output produced after it connected.
 */

import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import pty from "node-pty";
import type { IPty } from "node-pty";
// These xterm packages are CommonJS; Node's ESM loader can't see their named
// exports, so default-import + destructure for the values, and import the types
// separately.
import headlessPkg from "@xterm/headless";
import serializePkg from "@xterm/addon-serialize";
import type { Terminal as HeadlessTerminal } from "@xterm/headless";
import type { SerializeAddon as Serializer } from "@xterm/addon-serialize";
import type { SessionInfo } from "@amber/shared";

const { Terminal } = headlessPkg;
const { SerializeAddon } = serializePkg;

interface Session {
  info: SessionInfo;
  pty: IPty;
  term: HeadlessTerminal;
  serializer: Serializer;
}

export interface CreateOpts {
  agent?: string;
  cwd?: string;
  title?: string;
}

const DEFAULT_AGENT =
  process.env.AGENT_CMD?.trim() ||
  (process.platform === "win32" ? "powershell.exe" : process.env.SHELL ?? "zsh");
const DEFAULT_CWD = process.env.AGENT_CWD || process.env.HOME || process.cwd();

export interface SessionManagerHooks {
  /** live PTY output for one session, to be fanned out to subscribers */
  onOutput: (sessionId: string, data: string) => void;
  /** a session's process exited */
  onExit: (sessionId: string, code: number) => void;
  /** the session list changed (created / exited / removed) */
  onChange: () => void;
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  constructor(private hooks: SessionManagerHooks) {}

  list(): SessionInfo[] {
    return [...this.sessions.values()]
      .map((s) => s.info)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  create(opts: CreateOpts = {}): SessionInfo {
    const agent = opts.agent?.trim() || DEFAULT_AGENT;
    const cwd = opts.cwd || DEFAULT_CWD;
    const id = randomUUID().slice(0, 8);
    const cols = 80;
    const rows = 24;

    const p = pty.spawn(agent, [], {
      name: "xterm-color",
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
    });

    const term = new Terminal({ cols, rows, scrollback: 2000, allowProposedApi: true });
    const serializer = new SerializeAddon();
    term.loadAddon(serializer);

    const info: SessionInfo = {
      id,
      title: opts.title?.trim() || `${basename(agent)} · ${id}`,
      agent,
      cwd,
      state: "running",
      createdAt: Date.now(),
    };

    const session: Session = { info, pty: p, term, serializer };
    this.sessions.set(id, session);

    p.onData((data) => {
      term.write(data);
      this.hooks.onOutput(id, data);
    });
    p.onExit(({ exitCode }) => {
      info.state = "exited";
      info.exitCode = exitCode;
      this.hooks.onExit(id, exitCode);
      this.hooks.onChange();
    });

    this.hooks.onChange();
    return info;
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const s = this.sessions.get(id);
    if (!s) return;
    try {
      s.pty.resize(cols, rows);
      s.term.resize(cols, rows);
    } catch {
      /* size can briefly be invalid during layout; ignore */
    }
  }

  /** Serialized terminal state for replay on attach (escape sequences). */
  snapshot(id: string): string | null {
    const s = this.sessions.get(id);
    return s ? s.serializer.serialize() : null;
  }

  /** Kill a running session's process; remove an already-exited one. */
  kill(id: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    if (s.info.state === "running") {
      try {
        s.pty.kill();
      } catch {
        /* noop */
      }
    } else {
      this.dispose(id);
      this.hooks.onChange();
    }
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) {
      const s = this.sessions.get(id);
      try {
        s?.pty.kill();
      } catch {
        /* noop */
      }
      this.dispose(id);
    }
  }

  private dispose(id: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    try {
      s.term.dispose();
    } catch {
      /* noop */
    }
    this.sessions.delete(id);
  }
}
