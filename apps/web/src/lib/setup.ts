import { prisma } from "@community-bot/db";
import { randomBytes } from "crypto";

export async function ensureSetupToken() {
  const setupComplete = await prisma.systemConfig.findUnique({
    where: { key: "setupComplete" },
  });
  if (setupComplete?.value === "true") return;

  // Check if token already exists
  const existing = await prisma.systemConfig.findUnique({
    where: { key: "setupToken" },
  });
  if (existing) return;

  const token = randomBytes(32).toString("hex");
  await prisma.systemConfig.upsert({
    where: { key: "setupToken" },
    create: { key: "setupToken", value: token },
    update: { value: token },
  });

  const url = `${process.env.BETTER_AUTH_URL ?? "http://localhost:3001"}/setup/${token}`;
  console.log("");
  console.log("SETUP REQUIRED - Open this URL to complete first-time setup:");
  console.log("");
  console.log(url);
  console.log("");
}

export async function getBroadcasterUserId(): Promise<string | null> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "broadcasterUserId" },
  });
  return config?.value ?? null;
}

export async function isSetupComplete(): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "setupComplete" },
  });
  return config?.value === "true";
}
