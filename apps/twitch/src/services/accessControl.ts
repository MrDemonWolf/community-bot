import { ChatMessage } from "@twurple/chat";
import consola from "consola";

import { prisma } from "@community-bot/db";
import { TwitchAccessLevel } from "@community-bot/db";
import type { TwitchRegular } from "@community-bot/db";

const ACCESS_HIERARCHY: Record<TwitchAccessLevel, number> = {
  EVERYONE: 0,
  SUBSCRIBER: 1,
  REGULAR: 2,
  VIP: 3,
  MODERATOR: 4,
  BROADCASTER: 5,
};

let regularsSet = new Set<string>();

export async function loadRegulars(): Promise<void> {
  const regulars = await prisma.twitchRegular.findMany();
  regularsSet = new Set(regulars.map((r: TwitchRegular) => r.twitchUserId));

  consola.info({
    message: `[AccessControl] Loaded ${regularsSet.size} regulars`,
    badge: true,
    timestamp: new Date(),
  });
}

export function isRegular(twitchUserId: string): boolean {
  return regularsSet.has(twitchUserId);
}

export function getUserAccessLevel(msg: ChatMessage): TwitchAccessLevel {
  const info = msg.userInfo;

  if (info.isBroadcaster) return TwitchAccessLevel.BROADCASTER;
  if (info.isMod) return TwitchAccessLevel.MODERATOR;
  if (info.isVip) return TwitchAccessLevel.VIP;
  if (isRegular(info.userId)) return TwitchAccessLevel.REGULAR;
  if (info.isSubscriber || info.isFounder) return TwitchAccessLevel.SUBSCRIBER;

  return TwitchAccessLevel.EVERYONE;
}

export function meetsAccessLevel(
  userLevel: TwitchAccessLevel,
  requiredLevel: TwitchAccessLevel
): boolean {
  return ACCESS_HIERARCHY[userLevel] >= ACCESS_HIERARCHY[requiredLevel];
}
