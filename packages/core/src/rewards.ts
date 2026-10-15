export function redemptionStatus(status: string): "pending" | "fulfilled" | "canceled" {
  if (status.toUpperCase() === "FULFILLED") return "fulfilled";
  if (status.toUpperCase() === "CANCELED") return "canceled";
  return "pending";
}

export function rewardMessage(template: string, data: { login: string; input: string; title: string }): string {
  // User text is data: replace once so placeholders inside input cannot expand again.
  return template.replace(/\{(user|input|reward)\}/g, (_, key: string) => ({
    user: data.login, input: data.input, reward: data.title,
  })[key] ?? "").replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, 500);
}
