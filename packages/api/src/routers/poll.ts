import { prisma } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

async function getHelixHeaders(userId: string) {
  // Get the broadcaster's Twitch credential
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "twitch" },
  });

  if (!account) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No Twitch account linked.",
    });
  }

  const credential = await prisma.twitchCredential.findFirst({
    where: { userId: account.accountId },
  });

  if (!credential) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No Twitch credentials found.",
    });
  }

  return {
    headers: {
      Authorization: `Bearer ${credential.accessToken}`,
      "Client-Id": process.env.TWITCH_APPLICATION_CLIENT_ID ?? "",
      "Content-Type": "application/json",
    },
    broadcasterId: account.accountId,
  };
}

export const pollRouter = router({
  list: protectedProcedure.query(async ({ ctx }): Promise<Array<{ id: string; title: string; status: string; choices: { title: string; votes: number }[]; started_at: string; ended_at?: string }>> => {
    const { headers, broadcasterId } = await getHelixHeaders(ctx.session.user.id);

    const res = await fetch(
      `https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}&first=10`,
      { headers }
    );

    if (!res.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Helix API error: ${res.status}`,
      });
    }

    const data = await res.json();
    return data.data ?? [];
  }),

  create: moderatorProcedure
    .input(
      z.object({
        title: z.string().min(1).max(60),
        choices: z.array(z.string().min(1).max(25)).min(2).max(5),
        duration: z.number().min(15).max(1800).default(60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { headers, broadcasterId } = await getHelixHeaders(ctx.session.user.id);

      const res = await fetch("https://api.twitch.tv/helix/polls", {
        method: "POST",
        headers,
        body: JSON.stringify({
          broadcaster_id: broadcasterId,
          title: input.title,
          choices: input.choices.map((title) => ({ title })),
          duration: input.duration,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create poll: ${errText}`,
        });
      }

      const data = await res.json();
      return data.data?.[0] ?? null;
    }),

  end: moderatorProcedure
    .input(z.object({ id: z.string(), status: z.enum(["TERMINATED", "ARCHIVED"]).default("TERMINATED") }))
    .mutation(async ({ ctx, input }) => {
      const { headers, broadcasterId } = await getHelixHeaders(ctx.session.user.id);

      const res = await fetch("https://api.twitch.tv/helix/polls", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          broadcaster_id: broadcasterId,
          id: input.id,
          status: input.status,
        }),
      });

      if (!res.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to end poll: ${res.status}`,
        });
      }

      const data = await res.json();
      return data.data?.[0] ?? null;
    }),
});
