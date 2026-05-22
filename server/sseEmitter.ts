import { EventEmitter } from "events";
import type { Response } from "express";

/**
 * Global SSE event bus.
 * The mission execution engine emits events here;
 * the /api/sse/:missionId endpoint subscribes and streams them to the browser.
 */
class SSEEmitter extends EventEmitter {
  private clients: Map<number, Set<Response>> = new Map();

  subscribe(missionId: number, res: Response): void {
    if (!this.clients.has(missionId)) {
      this.clients.set(missionId, new Set());
    }
    this.clients.get(missionId)!.add(res);
  }

  unsubscribe(missionId: number, res: Response): void {
    this.clients.get(missionId)?.delete(res);
    if (this.clients.get(missionId)?.size === 0) {
      this.clients.delete(missionId);
    }
  }

  emit(event: string, missionId: number, data: unknown): boolean {
    const payload = JSON.stringify({ event, data, timestamp: Date.now() });
    const clients = this.clients.get(missionId);
    if (clients) {
      for (const res of Array.from(clients)) {
        try {
          res.write(`data: ${payload}\n\n`);
        } catch {
          // client disconnected
          this.unsubscribe(missionId, res);
        }
      }
    }
    // Also emit on the EventEmitter for internal listeners
    return super.emit(event, missionId, data);
  }

  broadcast(missionId: number, type: string, payload: Record<string, unknown>): void {
    this.emit("mission_event", missionId, { type, ...payload });
  }

  clientCount(missionId: number): number {
    return this.clients.get(missionId)?.size ?? 0;
  }
}

export const sseEmitter = new SSEEmitter();
export default sseEmitter;
