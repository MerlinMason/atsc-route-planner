import { z } from "zod";
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
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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
});
