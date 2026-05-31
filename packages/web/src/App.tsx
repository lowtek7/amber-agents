import { useEffect, useRef, useState } from "react";
import type { ServerMessage, SessionInfo } from "@amber/shared";
import { conn, type ConnStatus } from "./ws";
import { Sidebar } from "./Sidebar";
import { TerminalView } from "./TerminalView";

export function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnStatus>(conn.status);
  // when the user creates a session, jump to it once it shows up in the list
  const wantNewest = useRef(false);

  useEffect(() => {
    const offMsg = conn.onMessage((msg: ServerMessage) => {
      if (msg.type === "sessions") setSessions(msg.sessions);
    });
    const offStatus = conn.onStatus(setStatus);
    conn.connect();
    return () => {
      offMsg();
      offStatus();
    };
  }, []);

  // keep a valid active selection as the list changes
  useEffect(() => {
    setActiveId((current) => {
      if (wantNewest.current && sessions.length > 0) {
        wantNewest.current = false;
        return sessions.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)).id;
      }
      if (current && sessions.some((s) => s.id === current)) return current;
      return sessions[0]?.id ?? null;
    });
  }, [sessions]);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        background: "#1e1e1e",
        color: "#ddd",
      }}
    >
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        status={status}
        onSelect={setActiveId}
        onCreate={(agent) => {
          wantNewest.current = true;
          conn.send({ type: "create", agent });
        }}
        onKill={(id) => conn.send({ type: "kill", sessionId: id })}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {active ? (
          <TerminalView key={active.id} session={active} />
        ) : (
          <div style={{ margin: "auto", opacity: 0.45, fontSize: 14 }}>
            세션이 없어요 — 왼쪽에서 새로 만드세요
          </div>
        )}
      </main>
    </div>
  );
}
