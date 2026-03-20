# @community-bot/events

Type-safe Redis Pub/Sub event bus for real-time inter-service communication in the Community Bot monorepo. All three services (Discord bot, Twitch bot, Web dashboard) use it to publish and subscribe to events.

## Usage

```typescript
import { EventBus } from "@community-bot/events";

const eventBus = new EventBus(redisUrl);

// Publish
await eventBus.publish("command:updated", { commandId: "abc" });

// Subscribe
await eventBus.on("channel:join", (payload) => {
  console.log(`Joining ${payload.username}`);
});
```

## Architecture

The EventBus uses two separate Redis connections — one for publishing and one for subscribing. Redis requires this because a connection in "subscriber" mode can only receive messages, not send commands.

## Event Types

All event names and payloads are defined in `src/types.ts`. See the [CLAUDE.md](../../CLAUDE.md) Event Types table for the full list.

## License

See the monorepo root [LICENSE](../../LICENSE) file.
