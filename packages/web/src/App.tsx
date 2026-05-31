import { useEffect, useRef, useState } from "react";
import type { ServerMessage, SessionInfo } from "@amber/shared";
import { conn, type ConnStatus } from "./ws";
import { Sidebar } from "./Sidebar";
import { TerminalView } from "./TerminalView";

/** true on narrow (phone) viewports */
function useIsMobile(): boolean {
  const query = "(max-width: 768px)";
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function App() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnStatus>(conn.status);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
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

  const selectSession = (id: string) => {
    setActiveId(id);
    if (isMobile) setDrawerOpen(false);
  };
  const createSession = (agent: string | undefined) => {
    wantNewest.current = true;
    conn.send({ type: "create", agent });
    if (isMobile) setDrawerOpen(false);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        background: "#1e1e1e",
        color: "#ddd",
        overflow: "hidden",
      }}
    >
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        status={status}
        onSelect={selectSession}
        onCreate={createSession}
        onKill={(id) => conn.send({ type: "kill", sessionId: id })}
        mobile={isMobile}
        open={!isMobile || drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 20 }}
        />
      )}

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {isMobile && (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderBottom: "1px solid #333",
            }}
          >
            <button
              aria-label="menu"
              onClick={() => setDrawerOpen(true)}
              style={{
                background: "transparent",
                border: "1px solid #333",
                borderRadius: 6,
                color: "#ddd",
                fontSize: 16,
                lineHeight: 1,
                padding: "5px 9px",
                cursor: "pointer",
              }}
            >
              ☰
            </button>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {active ? active.title : "amber-agents"}
            </div>
            {active && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flex: "0 0 auto",
                  background: active.state === "running" ? "#4ade80" : "#6b7280",
                }}
              />
            )}
          </header>
        )}

        {active ? (
          <TerminalView key={active.id} session={active} showHeader={!isMobile} />
        ) : (
          <div style={{ margin: "auto", opacity: 0.45, fontSize: 14, padding: 16, textAlign: "center" }}>
            세션이 없어요 — {isMobile ? "☰ 메뉴에서" : "왼쪽에서"} 새로 만드세요
          </div>
        )}
      </main>
    </div>
  );
}
