import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { ClientMessage, ServerMessage } from "@amber/shared";

/**
 * The whole Phase 0 in one component:
 *   - mount xterm.js into a div
 *   - open a WebSocket to the daemon (proxied via Vite in dev)
 *   - pipe pty output -> terminal, terminal keystrokes -> pty
 *   - keep pty cols/rows in sync with the rendered terminal (the TUI gotcha)
 *
 * The effect fully tears down on cleanup, so React.StrictMode's double-mount in
 * dev is harmless.
 */
export function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    const send = (msg: ClientMessage) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    const syncSize = () => {
      fit.fit();
      send({ type: "resize", cols: term.cols, rows: term.rows });
    };

    ws.onopen = () => syncSize();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage;
      if (msg.type === "output") term.write(msg.data);
      else if (msg.type === "exit")
        term.write(`\r\n\x1b[90m[process exited: ${msg.code}]\x1b[0m\r\n`);
    };

    const onData = term.onData((data) => send({ type: "input", data }));
    window.addEventListener("resize", syncSize);
    const raf = requestAnimationFrame(syncSize); // fit once layout settles

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncSize);
      onData.dispose();
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, padding: 4 }} />
  );
}
