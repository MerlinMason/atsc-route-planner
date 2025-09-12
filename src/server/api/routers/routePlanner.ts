import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
	CalculateRouteSchema,
	GeocodeSchema,
	ReverseGeocodeSchema,
	RouteResponseSchema,
	GeocodeResponseSchema,
	callGraphHopperAPI,
	buildRouteUrl,
	buildGeocodeUrl,
	buildReverseGeocodeUrl,
	buildGpxUrl,
} from "~/lib/graphhopper";

export const routePlannerRouter = createTRPCRouter({
	calculate: publicProcedure
		.input(CalculateRouteSchema)
		.output(RouteResponseSchema)
		.mutation(async ({ input }) => {
			const { points, vehicle, elevation } = input;

			const url = buildRouteUrl(points, vehicle, elevation);
			console.log("GraphHopper API URL:", url);

			const data = await callGraphHopperAPI(url);
			console.log("GraphHopper API Response:", JSON.stringify(data, null, 2));

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
