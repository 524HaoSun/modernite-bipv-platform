import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  askDesignAssistant,
  askProjectAssistant,
  designAssistantInputSchema,
  projectAssistantInputSchema,
  projectCalculationInputSchema,
  runProjectCalculation,
} from "./estimate-service";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  projectStudy: router({
    run: publicProcedure
      .input(projectCalculationInputSchema)
      .mutation(({ input }) => runProjectCalculation(input)),
    ask: publicProcedure
      .input(projectAssistantInputSchema)
      .mutation(({ input }) => askProjectAssistant(input.caseId, input.question)),
    designHelp: publicProcedure
      .input(designAssistantInputSchema)
      .mutation(({ input }) => askDesignAssistant(input.question, input.stage)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
