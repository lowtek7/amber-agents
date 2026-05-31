import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { ServerMessage, SessionInfo } from "@amber/shared";
import { conn } from "./ws";

/**
 * Renders one session. Mounted with `key={session.id}` from App, so switching
 * sessions tears this down and builds a fresh terminal: on mount it attaches
 * (server replays a snapshot, then streams live output) and on unmount it
 * detaches. Keystrokes and size changes are sent back scoped to this session.
 */
export function TerminalView({ session }: { session: SessionInfo }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sid = session.id;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      theme: { background: "#1e1e1e" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const syncSize = () => {
      fit.fit();
      conn.send({ type: "resize", sessionId: sid, cols: term.cols, rows: term.rows });
    };

    const off = conn.onMessage((msg: ServerMessage) => {
      if (msg.type === "snapshot" && msg.sessionId === sid) {
        term.reset();
        term.write(msg.data);
      } else if (msg.type === "output" && msg.sessionId === sid) {
        term.write(msg.data);
      } else if (msg.type === "exit" && msg.sessionId === sid) {
        term.write(`\r\n\x1b[90m[exited ${msg.code}]\x1b[0m\r\n`);
      }
    });

    // size the session to our viewport first, then attach so the snapshot we
    // get back is serialized at the dimensions we're about to render at.
    syncSize();
    conn.send({ type: "attach", sessionId: sid });

    const onData = term.onData((data) =>
      conn.send({ type: "input", sessionId: sid, data }),
    );
    window.addEventListener("resize", syncSize);
    const raf = requestAnimationFrame(syncSize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncSize);
      onData.dispose();
      conn.send({ type: "detach", sessionId: sid });
      off();
      term.dispose();
    };
  }, [session.id]);

  return (
    <>
      <header
        style={{
          padding: "8px 12px",
          color: "#ddd",
          fontSize: 13,
          borderBottom: "1px solid #333",
          display: "flex",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <span>{session.title}</span>
        <span style={{ fontSize: 11, opacity: 0.45 }}>
          {session.state === "running" ? session.cwd : `exited (${session.exitCode ?? "?"})`}
        </span>
      </header>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, padding: 4 }} />
    </>
  );
}
