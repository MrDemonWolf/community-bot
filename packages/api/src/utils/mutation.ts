/**
 * Shared mutation effects helper.
 *
 * Consolidates the repeated pattern of publishing an EventBus event
 * and logging an audit entry after every tRPC mutation.
 */
import type { EventMap } from "@community-bot/events";
import { logAudit } from "./audit";

interface MutationContext {
  session: {
    user: { id: string; name: string; image?: string | null };
  };
}

interface MutationEffects<E extends keyof EventMap = keyof EventMap> {
  event?: { name: E; payload: EventMap[E] };
  audit: {
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Apply post-mutation side effects: publish an event and write an audit log entry.
 *
 * Usage:
 * ```ts
 * await applyMutationEffects(ctx, {
 *   event: { name: "counter:updated", payload: { counterName: name, channelId: botChannel.id } },
 *   audit: { action: "counter.create", resourceType: "TwitchCounter", resourceId: counter.id, metadata: { name } },
 * });
 * ```
 */
export async function applyMutationEffects<E extends keyof EventMap>(
  ctx: MutationContext,
  effects: MutationEffects<E>,
): Promise<void> {
  if (effects.event) {
    const { eventBus } = await import("../events");
    await eventBus.publish(effects.event.name, effects.event.payload);
  }

  await logAudit({
    userId: ctx.session.user.id,
    userName: ctx.session.user.name,
    userImage: ctx.session.user.image,
    ...effects.audit,
  });
}
