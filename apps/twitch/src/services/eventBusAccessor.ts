import type { EventBus } from "@community-bot/events";

let instance: EventBus | null = null;

export function setEventBus(bus: EventBus): void {
  instance = bus;
}

export function getEventBus(): EventBus {
  if (!instance) {
    throw new Error("EventBus not initialized. Call setEventBus() first.");
  }
  return instance;
}
