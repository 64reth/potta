import { DurableObject } from "cloudflare:workers";
import type { InferEnv, UnwrapConfig } from "cf/config";
import type configuration from "../cloudflare.config";
import {
  ROOM_PATTERN,
  type Command,
  type RoomData,
} from "../src/online/protocol";
import { commandRoom, roomView, RoomError } from "./room";
type ConfiguredBindings = InferEnv<
  UnwrapConfig<typeof configuration>["worker"]
>;
export type Env = Omit<ConfiguredBindings, "ROOMS"> & {
  ROOMS: DurableObjectNamespace<PottaRoom>;
};
export class PottaRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
    );
  }
  // Synchronous SQLite read/validate/write: no interleaving or acknowledged memory-only state.
  apply(code: string, hash: string, command: Command): Response {
    try {
      const row = this.ctx.storage.sql
        .exec<{ data: string }>("SELECT data FROM room WHERE id=1")
        .toArray()[0];
      const now = Date.now(),
        { room, player } = commandRoom(
          row ? JSON.parse(row.data) : null,
          hash,
          command,
          now,
        );
      this.ctx.storage.sql.exec(
        "INSERT INTO room(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        JSON.stringify(room),
      );
      return Response.json(roomView(room, player, code, now), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (error instanceof RoomError)
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
      throw error;
    }
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname === "/api/health")
      return Response.json({ service: "potta", build: "002" });
    const code = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})$/)?.[1];
    if (!code || !ROOM_PATTERN.test(code))
      return Response.json(
        { error: "Check the six-character room code." },
        { status: 404 },
      );
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    if (
      request.headers.get("Origin") &&
      request.headers.get("Origin") !== url.origin
    )
      return new Response("Origin denied", { status: 403 });
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return new Response("JSON required", { status: 415 });
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      return Response.json(
        { error: "Your player identity is missing." },
        { status: 401 },
      );
    // Bound streamed input before parsing, including chunked requests.
    const reader = request.body?.getReader();
    if (!reader) return new Response("Missing request", { status: 400 });
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) {
        await reader.cancel();
        return new Response("Request too large", { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    let command: Command;
    try {
      command = JSON.parse(text);
      if (
        !command ||
        !["create", "join", "sync", "action", "rematch"].includes(command.type)
      )
        throw Error();
    } catch {
      return Response.json({ error: "Please try again." }, { status: 400 });
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    const hash = Array.from(new Uint8Array(digest), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    try {
      return await env.ROOMS.getByName(code).apply(code, hash, command);
    } catch {
      console.error(JSON.stringify({ event: "room_unavailable", code }));
      return Response.json(
        { error: "Connection interrupted. We will reconnect." },
        { status: 503 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
