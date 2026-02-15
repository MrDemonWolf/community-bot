import { prisma } from "@community-bot/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../index";

export const setupRouter = router({
  status: publicProcedure.query(async () => {
    const setupComplete = await prisma.systemConfig.findUnique({
      where: { key: "setupComplete" },
    });
    return { setupComplete: setupComplete?.value === "true" };
  }),

  complete: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const storedToken = await prisma.systemConfig.findUnique({
        where: { key: "setupToken" },
      });
      if (!storedToken || storedToken.value !== input.token) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid setup token.",
        });
      }

      const userId = ctx.session.user.id;

      await prisma.$transaction([
        prisma.systemConfig.upsert({
          where: { key: "broadcasterUserId" },
          create: { key: "broadcasterUserId", value: userId },
          update: { value: userId },
        }),
        prisma.systemConfig.upsert({
          where: { key: "setupComplete" },
          create: { key: "setupComplete", value: "true" },
          update: { value: "true" },
        }),
        prisma.systemConfig.delete({ where: { key: "setupToken" } }),
        prisma.user.update({
          where: { id: userId },
          data: { role: "ADMIN" },
        }),
      ]);

      return { success: true };
    }),
});
