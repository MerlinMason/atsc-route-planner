import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import {
	CalculateRouteSchema,
	GeocodeResponseSchema,
	GeocodeSchema,
	ReverseGeocodeSchema,
	RouteResponseSchema,
	buildGeocodeUrl,
	buildGpxUrl,
	buildReverseGeocodeUrl,
	buildRouteUrl,
	callGraphHopperAPI,
} from "~/lib/graphhopper";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { routes } from "~/server/db/schema";

// Route point schema for saved routes
const RoutePointSchema = z.object({
	lat: z.number(),
	lng: z.number(),
	type: z.enum(["start", "waypoint", "end"]),
});

// Schema for saving a route (upsert - create or update)
const SaveRouteSchema = z.object({
	id: z.number().optional(), // If provided, update existing route
	title: z.string().min(1).max(255),
	routeData: z.array(RoutePointSchema),
	distance: z.number().positive(),
	elevationGain: z.number().min(0),
});

export const routePlannerRouter = createTRPCRouter({
	calculate: publicProcedure
		.input(CalculateRouteSchema)
		.output(RouteResponseSchema)
		.mutation(async ({ input }) => {
			const { points, vehicle, elevation } = input;

			const url = buildRouteUrl(points, vehicle, elevation);

			const data = await callGraphHopperAPI(url);

			// Validate and return the response
			try {
				return RouteResponseSchema.parse(data);
			} catch (error) {
				console.error("Schema validation error:", error);
				console.error("Raw API data:", data);
				throw error;
			}
		}),

	geocode: publicProcedure
		.input(GeocodeSchema)
		.output(GeocodeResponseSchema)
		.query(async ({ input }) => {
			const { query, limit } = input;

			const url = buildGeocodeUrl(query, limit);
			const data = await callGraphHopperAPI(url);

			return data;
		}),

	reverseGeocode: publicProcedure
		.input(ReverseGeocodeSchema)
		.output(GeocodeResponseSchema)
		.query(async ({ input }) => {
			const { lat, lng } = input;

			const url = buildReverseGeocodeUrl(lat, lng);
			const data = await callGraphHopperAPI(url);

			return data;
		}),

	exportGpx: publicProcedure
		.input(CalculateRouteSchema)
		.output(z.string()) // GPX file content as string
		.mutation(async ({ input }) => {
			const { points, vehicle } = input;

			const url = buildGpxUrl(points, vehicle);

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(
					`GraphHopper GPX export error: ${response.status} ${response.statusText}`,
				);
			}

			return response.text();
		}),

	// Save a route to the database (upsert - create or update)
	saveRoute: protectedProcedure
		.input(SaveRouteSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, title, routeData, distance, elevationGain } = input;

			if (id) {
				// Update existing route
				const [updatedRoute] = await ctx.db
					.update(routes)
					.set({
						title,
						routeData,
						distance,
						elevationGain,
						updatedAt: new Date(),
					})
					.where(eq(routes.id, id))
					.returning();

				if (!updatedRoute) {
					throw new Error("Route not found");
				}

				// Verify ownership
				if (updatedRoute.createdById !== ctx.session.user.id) {
					throw new Error("Unauthorized: You can only update your own routes");
				}

				return updatedRoute;
			}

			// Create new route
			const [savedRoute] = await ctx.db
				.insert(routes)
				.values({
					title,
					routeData,
					distance,
					elevationGain,
					createdById: ctx.session.user.id,
				})
				.returning();

			return savedRoute;
		}),

	// Get all routes for the current user
	getRoutes: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select()
			.from(routes)
			.where(eq(routes.createdById, ctx.session.user.id))
			.orderBy(desc(routes.createdAt));
	}),

	// Get a specific route by ID (must be owned by user)
	getRoute: protectedProcedure
		.input(z.object({ id: z.number() }))
		.query(async ({ ctx, input }) => {
			const [route] = await ctx.db
				.select()
				.from(routes)
				.where(eq(routes.id, input.id))
				.limit(1);

			if (!route) {
				throw new Error("Route not found");
			}

			if (route.createdById !== ctx.session.user.id) {
				throw new Error("Unauthorized");
			}

			return route;
		}),

	// Delete a route (must be owned by user)
	deleteRoute: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const [deletedRoute] = await ctx.db
				.delete(routes)
				.where(eq(routes.id, input.id))
				.returning();

			if (!deletedRoute) {
				throw new Error("Route not found");
			}

			if (deletedRoute.createdById !== ctx.session.user.id) {
				throw new Error("Unauthorized");
			}

			return { success: true };
		}),
});
