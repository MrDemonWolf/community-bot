import { protectedProcedure, router } from "../index";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return {
      user: ctx.session.user,
    };
  }),
});
