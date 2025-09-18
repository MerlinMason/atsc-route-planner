import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	CalculateRouteSchema,
	GeocodeResponseSchema,
	GeocodeSchema,
	ReverseGeocodeSchema,
	RoutePointSchema,
	RouteResponseSchema,
	buildGeocodeUrl,
	buildGpxUrl,
	buildReverseGeocodeUrl,
	buildRouteUrl,
	callGraphHopperAPI,
} from "~/lib/graphhopper";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import { routes } from "~/server/db/schema";

// Schema for saving a route (upsert - create or update)
const SaveRouteSchema = z.object({
	id: z.number().optional(), // If provided, update existing route
	title: z.string().min(1).max(255),
	routeData: z.array(RoutePointSchema),
	distance: z.number().positive(),
	elevationGain: z.number().min(0),
});

// Schema for route ID operations
const RouteIdSchema = z.object({ id: z.number() });

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
				// Update existing route (with ownership check in WHERE clause)
				const [updatedRoute] = await ctx.db
					.update(routes)
					.set({
						title,
						routeData,
						distance,
						elevationGain,
						updatedAt: new Date(),
					})
					.where(
						and(eq(routes.id, id), eq(routes.createdById, ctx.session.user.id)),
					)
					.returning();

				if (!updatedRoute) {
					throw new Error(
						"Route not found or you don't have permission to update it",
					);
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
		.input(RouteIdSchema)
		.query(async ({ ctx, input }) => {
			const [route] = await ctx.db
				.select()
				.from(routes)
				.where(
					and(
						eq(routes.id, input.id),
						eq(routes.createdById, ctx.session.user.id),
					),
				)
				.limit(1);

			if (!route) {
				throw new Error(
					"Route not found or you don't have permission to view it",
				);
			}

			return route;
		}),

	// Delete a route (must be owned by user)
	deleteRoute: protectedProcedure
		.input(RouteIdSchema)
		.mutation(async ({ ctx, input }) => {
			const [deletedRoute] = await ctx.db
				.delete(routes)
				.where(
					and(
						eq(routes.id, input.id),
						eq(routes.createdById, ctx.session.user.id),
					),
				)
				.returning();

			if (!deletedRoute) {
				throw new Error(
					"Route not found or you don't have permission to delete it",
				);
			}

			return { success: true };
		}),
});
