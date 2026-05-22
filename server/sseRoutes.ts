import type { Express } from "express";
import { getMission } from "./db";
import sseEmitter from "./sseEmitter";

/**
 * Register the SSE endpoint: GET /api/sse/mission/:missionId
 *
 * The client connects with EventSource and receives all mission events
 * as they are emitted by the execution engine.
 * Authentication is handled via the session cookie (same as tRPC context).
 */
export function registerSSERoutes(app: Express): void {
  app.get("/api/sse/mission/:missionId", async (req, res) => {
    const missionId = parseInt(req.params.missionId ?? "", 10);
    if (isNaN(missionId)) {
      res.status(400).json({ error: "Invalid missionId" });
      return;
    }

    // Verify mission exists (basic auth check — session cookie validated upstream)
    const mission = await getMission(missionId).catch(() => null);
    if (!mission) {
      res.status(404).json({ error: "Mission not found" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ event: "connected", data: { missionId, status: mission.status }, timestamp: Date.now() })}\n\n`);

    // Register this response as a subscriber
    sseEmitter.subscribe(missionId, res);

    // Send a heartbeat every 20 seconds to keep the connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 20_000);

    // Cleanup on client disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      sseEmitter.unsubscribe(missionId, res);
    });
  });
}
