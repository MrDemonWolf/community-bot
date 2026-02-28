/**
 * Pre-start script: logs the setup URL if first-time setup hasn't been completed.
 * Runs before the Next.js server starts in the Docker entrypoint.
 */
import { PrismaClient } from "../packages/db/prisma/generated/index.js";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

try {
  const complete = await prisma.systemConfig.findUnique({
    where: { key: "setupComplete" },
  });
  if (complete?.value === "true") {
    process.exit(0);
  }

  let token = await prisma.systemConfig.findUnique({
    where: { key: "setupToken" },
  });

  if (!token) {
    const newToken = randomBytes(32).toString("hex");
    token = await prisma.systemConfig.upsert({
      where: { key: "setupToken" },
      create: { key: "setupToken", value: newToken },
      update: { value: newToken },
    });
  }

  const baseUrl = process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/setup/${token.value}`;
  console.log("");
  console.log("SETUP REQUIRED - Open this URL to complete first-time setup:");
  console.log("");
  console.log(url);
  console.log("");
} catch (err) {
  console.warn("Setup token check failed (DB may not be ready):", err.message);
} finally {
  await prisma.$disconnect();
}
