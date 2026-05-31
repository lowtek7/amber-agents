import { useState, type CSSProperties } from "react";
import type { SessionInfo } from "@amber/shared";
import type { ConnStatus } from "./ws";

interface SidebarProps {
  sessions: SessionInfo[];
  activeId: string | null;
  status: ConnStatus;
  onSelect: (id: string) => void;
  onCreate: (agent: string | undefined) => void;
  onKill: (id: string) => void;
  /** phone layout: render as a slide-in drawer */
  mobile: boolean;
  /** whether the drawer is shown (always true on desktop) */
  open: boolean;
  /** close the drawer (mobile only) */
  onClose: () => void;
}

const STATUS_COLOR: Record<ConnStatus, string> = {
  open: "#4ade80",
  connecting: "#fbbf24",
  closed: "#f87171",
};

export function Sidebar({
  sessions,
  activeId,
  status,
  onSelect,
  onCreate,
  onKill,
  mobile,
  open,
  onClose,
}: SidebarProps) {
  const [cmd, setCmd] = useState("");

  const base: CSSProperties = {
    width: 250,
    flex: "0 0 auto",
    borderRight: "1px solid #333",
    display: "flex",
    flexDirection: "column",
    background: "#181818",
  };
  const mobileStyle: CSSProperties = mobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "78vw",
        maxWidth: 300,
        zIndex: 30,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.2s ease",
        boxShadow: open ? "0 0 24px rgba(0,0,0,0.5)" : "none",
      }
    : {};

  return (
    <aside style={{ ...base, ...mobileStyle }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #333",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>
            amber-agents <span style={{ opacity: 0.4 }}>· phase 1</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: STATUS_COLOR[status] }}>
            ● {status}
          </div>
        </div>
        {mobile && (
          <button
            aria-label="close menu"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(cmd.trim() || undefined);
          setCmd("");
        }}
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 12px",
          borderBottom: "1px solid #333",
        }}
      >
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="command (빈칸이면 셸)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            background: "#111",
            color: "#ddd",
            border: "1px solid #333",
            borderRadius: 4,
            padding: "7px 8px",
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          title="새 세션"
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 4,
            padding: "0 12px",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ＋
        </button>
      </form>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {sessions.length === 0 && (
          <div style={{ padding: 12, opacity: 0.4, fontSize: 12 }}>세션 없음</div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              background: s.id === activeId ? "#2a2d2e" : "transparent",
              borderBottom: "1px solid #232323",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              title={s.state}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flex: "0 0 auto",
                background: s.state === "running" ? "#4ade80" : "#6b7280",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.45,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.cwd}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onKill(s.id);
              }}
              title={s.state === "running" ? "종료" : "제거"}
              style={{
                background: "transparent",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: 15,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
