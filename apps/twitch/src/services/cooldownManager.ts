const globalCooldowns = new Map<string, number>();
const userCooldowns = new Map<string, number>();

export function isOnCooldown(
  commandName: string,
  userId: string,
  globalCd: number,
  userCd: number
): { onCooldown: boolean; remainingSeconds: number } {
  const now = Date.now();

  // Check global cooldown
  if (globalCd > 0) {
    const globalKey = commandName;
    const globalExpiry = globalCooldowns.get(globalKey);
    if (globalExpiry && now < globalExpiry) {
      return {
        onCooldown: true,
        remainingSeconds: Math.ceil((globalExpiry - now) / 1000),
      };
    }
  }

  // Check per-user cooldown
  if (userCd > 0) {
    const userKey = `${commandName}:${userId}`;
    const userExpiry = userCooldowns.get(userKey);
    if (userExpiry && now < userExpiry) {
      return {
        onCooldown: true,
        remainingSeconds: Math.ceil((userExpiry - now) / 1000),
      };
    }
  }

  return { onCooldown: false, remainingSeconds: 0 };
}

export function recordUsage(
  commandName: string,
  userId: string,
  globalCd: number,
  userCd: number
): void {
  const now = Date.now();

  if (globalCd > 0) {
    globalCooldowns.set(commandName, now + globalCd * 1000);
  }

  if (userCd > 0) {
    userCooldowns.set(`${commandName}:${userId}`, now + userCd * 1000);
  }
}
