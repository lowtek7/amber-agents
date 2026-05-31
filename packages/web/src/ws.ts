import type { ClientMessage, ServerMessage } from "@amber/shared";

export type ConnStatus = "connecting" | "open" | "closed";

type MsgListener = (msg: ServerMessage) => void;
type StatusListener = (status: ConnStatus) => void;

/**
 * One shared WebSocket for the whole app. Components subscribe to messages and
 * send commands through this singleton; it auto-reconnects with a fixed delay
 * so closing a laptop lid / dropping off the tailnet recovers on its own.
 */
class Connection {
  private ws: WebSocket | null = null;
  private msgListeners = new Set<MsgListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectTimer: number | null = null;
  status: ConnStatus = "closed";

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    this.setStatus("connecting");
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => this.setStatus("open");
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      for (const l of this.msgListeners) l(msg);
    };
    ws.onclose = () => {
      this.setStatus("closed");
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(l: MsgListener): () => void {
    this.msgListeners.add(l);
    return () => this.msgListeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    l(this.status);
    return () => this.statusListeners.delete(l);
  }

  private setStatus(status: ConnStatus): void {
    this.status = status;
    for (const l of this.statusListeners) l(status);
  }
}

export const conn = new Connection();
