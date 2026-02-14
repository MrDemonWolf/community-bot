import { Redis } from "ioredis";
import type { EventMap, EventName } from "./types";

export class EventBus {
  private pub: Redis;
  private sub: Redis;
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private prefix: string;

  constructor(redisUrl: string, opts?: { prefix?: string }) {
    this.prefix = opts?.prefix ?? "events";
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: null });

    this.sub.on("message", (channel: string, message: string) => {
      const eventName = channel.replace(`${this.prefix}:`, "");
      const fns = this.handlers.get(eventName);
      if (!fns) return;
      try {
        const payload = JSON.parse(message);
        for (const fn of fns) fn(payload);
      } catch {
        /* ignore malformed messages */
      }
    });
  }

  async publish<E extends EventName>(
    event: E,
    payload: EventMap[E]
  ): Promise<void> {
    await this.pub.publish(
      `${this.prefix}:${event}`,
      JSON.stringify(payload)
    );
  }

  async on<E extends EventName>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Promise<void> {
    const channel = `${this.prefix}:${event}`;
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
      await this.sub.subscribe(channel);
    }
    this.handlers.get(event)!.add(handler as (payload: unknown) => void);
  }

  async disconnect(): Promise<void> {
    await this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();
  }
}
