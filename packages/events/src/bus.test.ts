import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture constructor calls and instances
const mockSubscribe = vi.fn();
const mockPublish = vi.fn();
const mockPing = vi.fn().mockResolvedValue("PONG");
const mockUnsubscribe = vi.fn();
const mockDisconnect = vi.fn();
let messageHandler: ((channel: string, message: string) => void) | undefined;

vi.mock("ioredis", () => {
  class MockRedis {
    private listeners: Record<string, ((...args: string[]) => void)[]> = {};

    constructor() {
      // No-op
    }

    on(event: string, handler: (...args: string[]) => void) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
      if (event === "message") {
        messageHandler = handler;
      }
      return this;
    }

    subscribe = mockSubscribe;
    publish = mockPublish;
    ping = mockPing;
    unsubscribe = mockUnsubscribe;
    disconnect = mockDisconnect;
  }

  return { Redis: MockRedis };
});

import { EventBus } from "./bus";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    messageHandler = undefined;
    bus = new EventBus("redis://localhost:6379");
  });

  describe("publish", () => {
    it("publishes a JSON-serialized message to the prefixed channel", async () => {
      await bus.publish("channel:join", {
        channelId: "123",
        username: "test_user",
      });

      expect(mockPublish).toHaveBeenCalledWith(
        "events:channel:join",
        JSON.stringify({ channelId: "123", username: "test_user" })
      );
    });

    it("uses custom prefix when provided", async () => {
      const customBus = new EventBus("redis://localhost:6379", {
        prefix: "custom",
      });
      await customBus.publish("stream:online", {
        channelId: "1",
        username: "u",
        title: "t",
        startedAt: "2024-01-01",
      });

      expect(mockPublish).toHaveBeenCalledWith(
        "custom:stream:online",
        expect.any(String)
      );
    });
  });

  describe("on (subscribe)", () => {
    it("subscribes to the prefixed Redis channel", async () => {
      const handler = vi.fn();
      await bus.on("command:created", handler);

      expect(mockSubscribe).toHaveBeenCalledWith("events:command:created");
    });

    it("only subscribes once for multiple handlers on the same event", async () => {
      await bus.on("command:created", vi.fn());
      await bus.on("command:created", vi.fn());

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it("dispatches messages to registered handlers", async () => {
      const handler = vi.fn();
      await bus.on("command:created", handler);

      // Simulate Redis message
      messageHandler?.("events:command:created", '{"commandId":"abc"}');

      expect(handler).toHaveBeenCalledWith({ commandId: "abc" });
    });

    it("dispatches to multiple handlers for the same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      await bus.on("command:created", handler1);
      await bus.on("command:created", handler2);

      messageHandler?.("events:command:created", '{"commandId":"abc"}');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("ignores messages for events without handlers", () => {
      // No handlers registered — should not throw
      messageHandler?.("events:unknown:event", '{"foo":"bar"}');
    });

    it("ignores malformed JSON messages", async () => {
      const handler = vi.fn();
      await bus.on("command:created", handler);

      // Should not throw
      messageHandler?.("events:command:created", "not-json{{{");

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("ping", () => {
    it("returns true when Redis responds with PONG", async () => {
      const result = await bus.ping();
      expect(result).toBe(true);
    });

    it("returns false when Redis throws", async () => {
      mockPing.mockRejectedValueOnce(new Error("Connection refused"));
      const result = await bus.ping();
      expect(result).toBe(false);
    });
  });

  describe("disconnect", () => {
    it("unsubscribes and disconnects both Redis clients", async () => {
      await bus.disconnect();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalledTimes(2); // pub + sub
    });
  });
});
