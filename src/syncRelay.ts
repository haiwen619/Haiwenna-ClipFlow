import { deriveRoomId, encryptPayload, decryptEnvelope } from "./mobileCrypto";

export const RELAY_WS_URL = "wss://haiwenna.me/clipflow/ws";

export interface RelaySyncOptions {
  deviceId: string;
  platform: "windows" | "android" | "ios" | "unknown";
  onTextReceived: (text: string, senderId: string) => void;
  onImageReceived?: (dataUrl: string, senderId: string) => void;
  onStatusChange?: (online: boolean) => void;
  onDeviceAnnounce?: (info: { deviceId: string; deviceName: string; platform: string }) => void;
}

export class RelaySyncClient {
  private ws: WebSocket | null = null;
  private sharedKey: string | null = null;
  private roomId: string | null = null;
  private pingTimer: any = null;
  private reconnectTimer: any = null;
  private isDestroyed = false;
  private lastReceivedTextHash: string = "";
  private lastReceivedImageHash: string = "";

  constructor(private opts: RelaySyncOptions) {}

  public async connect(sharedKey: string) {
    this.sharedKey = sharedKey;
    this.isDestroyed = false;
    this.roomId = await deriveRoomId(sharedKey);
    this.initSocket();
  }

  private initSocket() {
    if (this.isDestroyed || !this.roomId) return;
    this.cleanupSocket();

    try {
      const url = `${RELAY_WS_URL}?room=${encodeURIComponent(
        this.roomId
      )}&device=${encodeURIComponent(this.opts.deviceId)}&platform=${
        this.opts.platform
      }`;
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.opts.onStatusChange?.(true);
        this.startHeartbeat();
      };

      ws.onmessage = async (evt) => {
        if (this.ws !== ws) return;
        try {
          const raw = typeof evt.data === "string" ? evt.data : await (evt.data as Blob).text();
          if (raw === "pong") return;

          const msg = JSON.parse(raw);
          if (msg.type === "pong" || msg.type === "peers") return;

          if (msg.type === "device_announce") {
            if (msg.deviceId !== this.opts.deviceId) {
              this.opts.onDeviceAnnounce?.({
                deviceId: msg.deviceId,
                deviceName: msg.deviceName || "移动端设备",
                platform: msg.platform || "android",
              });
            }
            return;
          }

          // 提取加密信封
          const envelope = msg.envelope || (msg.ciphertext ? msg : null);
          if (!envelope || !this.sharedKey) return;

          // 排除自己发送的消息
          if (envelope.senderId === this.opts.deviceId) return;

          if (envelope.kind === "text" && envelope.nonce && envelope.ciphertext) {
            try {
              const text = await decryptEnvelope(
                this.sharedKey,
                envelope.nonce,
                envelope.ciphertext
              );
              if (text && text.trim() !== "") {
                // 简易防重，避免回环
                const hash = text.slice(0, 32) + "_" + text.length;
                if (hash === this.lastReceivedTextHash) {
                  return;
                }
                this.lastReceivedTextHash = hash;
                this.opts.onTextReceived(text, envelope.senderId || "remote");
              }
            } catch (decErr) {
              console.warn("[RelaySync] 解密远程数据失败:", decErr);
            }
          } else if (envelope.kind === "image" && envelope.nonce && envelope.ciphertext) {
            try {
              const dataUrl = await decryptEnvelope(
                this.sharedKey,
                envelope.nonce,
                envelope.ciphertext
              );
              if (dataUrl && dataUrl.startsWith("data:image/")) {
                const hash = dataUrl.slice(0, 64) + "_" + dataUrl.length;
                if (hash === this.lastReceivedImageHash) {
                  return;
                }
                this.lastReceivedImageHash = hash;
                this.opts.onImageReceived?.(dataUrl, envelope.senderId || "remote");
              }
            } catch (decErr) {
              console.warn("[RelaySync] 解密远程图片失败:", decErr);
            }
          }
        } catch {
          // 容错忽略非协议消息
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.opts.onStatusChange?.(false);
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        if (this.ws !== ws) return;
        this.opts.onStatusChange?.(false);
      };
    } catch (e) {
      console.warn("[RelaySync] 建立连接异常:", e);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {}
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    this.stopHeartbeat();
    if (this.isDestroyed || !this.sharedKey) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initSocket();
    }, 4000);
  }

  private cleanupSocket() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  public async sendText(text: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sharedKey || !this.roomId) {
      return false;
    }

    try {
      const { nonce, ciphertext } = await encryptPayload(this.sharedKey, text);
      const envelope = {
        version: 1,
        senderId: this.opts.deviceId,
        timestamp: Math.floor(Date.now() / 1000),
        seq: Date.now(),
        nonce,
        kind: "text",
        ciphertext,
      };

      const packet = JSON.stringify({
        type: "clip",
        room: this.roomId,
        deviceId: this.opts.deviceId,
        envelope,
      });

      this.ws.send(packet);
      return true;
    } catch (e) {
      console.warn("[RelaySync] 发送加密剪贴板失败:", e);
      return false;
    }
  }

  public async sendImage(dataUrl: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sharedKey || !this.roomId) {
      return false;
    }

    try {
      const { nonce, ciphertext } = await encryptPayload(this.sharedKey, dataUrl);
      const envelope = {
        version: 1,
        senderId: this.opts.deviceId,
        timestamp: Math.floor(Date.now() / 1000),
        seq: Date.now(),
        nonce,
        kind: "image",
        ciphertext,
      };

      const packet = JSON.stringify({
        type: "clip",
        room: this.roomId,
        deviceId: this.opts.deviceId,
        envelope,
      });

      this.ws.send(packet);
      return true;
    } catch (e) {
      console.warn("[RelaySync] 发送加密图片失败:", e);
      return false;
    }
  }

  public sendDeviceAnnounce(deviceName: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.roomId) {
      return false;
    }
    try {
      this.ws.send(
        JSON.stringify({
          type: "device_announce",
          room: this.roomId,
          deviceId: this.opts.deviceId,
          deviceName,
          platform: this.opts.platform,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  public disconnect() {
    this.isDestroyed = true;
    this.cleanupSocket();
    this.sharedKey = null;
    this.roomId = null;
  }
}
