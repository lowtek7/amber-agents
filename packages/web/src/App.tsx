import { TerminalView } from "./TerminalView";

export function App() {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          color: "#ddd",
          fontSize: 13,
          borderBottom: "1px solid #333",
        }}
      >
        amber-agents · phase 0 · session 1
      </header>
      <TerminalView />
    </div>
  );
}
