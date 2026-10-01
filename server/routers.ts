import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getBuildingFootprint, getNearbyBuildings } from "./building-service";
import { getBuildingProfile, getGroundElevation } from "./building-profile-service";
import { getGoogleSolarReference } from "./google-solar-service";
import { loadProject, PROJECT_ID, saveProject } from "./project-share-service";
import { getSolarHeatmap } from "./solar-heatmap-service";
import { ENV } from "./_core/env";
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

  site: router({
    solarInsights: publicProcedure
      .input(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }))
      .query(({ input }) => getGoogleSolarReference(input.lat, input.lng)),
    buildingFootprint: publicProcedure
      .input(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }))
      .query(({ input }) => getBuildingFootprint(input.lat, input.lng)),
    nearbyBuildings: publicProcedure
      .input(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }))
      .query(({ input }) => getNearbyBuildings(input.lat, input.lng)),
    solarHeatmap: publicProcedure
      .input(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }))
      .query(({ input }) => getSolarHeatmap(input.lat, input.lng)),
    buildingProfile: publicProcedure
      .input(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), market: z.enum(["GB", "EU", "CA", "JP"]) }))
      .query(({ input }) => getBuildingProfile(input.lat, input.lng, input.market)),
    groundElevation: publicProcedure
      .input(z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }))
      .query(async ({ input }) => ({ elevationM: (await getGroundElevation(input.lat, input.lng)) ?? null })),
    // The Maps key is a browser key restricted to the preview origins and Maps JS / Map Tiles.
    publicConfig: publicProcedure.query(() => ({ googleMapsApiKey: ENV.googleMapsBrowserKey || null })),
  }),

  sharedProject: router({
    save: publicProcedure
      .input(z.object({ language: z.string().max(10), payload: z.object({ study: z.record(z.string(), z.unknown()), context: z.record(z.string(), z.unknown()).nullable() }) }))
      .mutation(({ input }) => {
        if (JSON.stringify(input.payload).length > 1_500_000) throw new Error("Project is too large to share");
        return saveProject(input.payload, input.language);
      }),
    get: publicProcedure
      .input(z.object({ id: z.string().regex(PROJECT_ID) }))
      .query(async ({ input }) => {
        const payload = await loadProject(input.id);
        if (!payload) throw new Error("Project not found");
        return payload as { study: Record<string, unknown>; context: Record<string, unknown> | null };
      }),
  }),
  projectStudy: router({
    run: publicProcedure
      .input(projectCalculationInputSchema)
      .mutation(({ input }) => runProjectCalculation(input)),
    ask: publicProcedure
      .input(projectAssistantInputSchema)
      .mutation(({ input }) => askProjectAssistant(input.caseId, input.question, input.language)),
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
