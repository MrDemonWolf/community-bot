import { ChatMessage } from "@twurple/chat";

import { prisma } from "@community-bot/db";
import { logger } from "../utils/logger.js";
import { TwitchAccessLevel } from "@community-bot/db";
import { ACCESS_HIERARCHY } from "./accessControl.constants.js";

let regularsSet = new Set<string>();

export async function loadRegulars(): Promise<void> {
  const regulars = await prisma.regular.findMany({
    where: { twitchUserId: { not: null } },
  });
  regularsSet = new Set(
    regulars.map((r) => r.twitchUserId).filter((id): id is string => id !== null)
  );

  logger.info("AccessControl", `Loaded ${regularsSet.size} regulars`);
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

export { meetsAccessLevel } from "./accessControl.constants.js";
