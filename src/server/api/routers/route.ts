import { z } from "zod";
import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Input schemas
const RoutePointSchema = z.object({
	lat: z.number(),
	lng: z.number(),
	type: z.enum(["start", "waypoint", "end"]),
});

const CalculateRouteSchema = z.object({
	points: z.array(RoutePointSchema).min(2, "At least 2 points required"),
	vehicle: z.enum(["hike", "bike", "car"]).default("hike"),
	elevation: z.boolean().default(true),
});

const GeocodeSchema = z.object({
	query: z.string().min(1, "Query required"),
	limit: z.number().min(1).max(10).default(5),
});

const ReverseGeocodeSchema = z.object({
	lat: z.number(),
	lng: z.number(),
});

// Response types based on GraphHopper API
const RouteInstructionSchema = z.object({
	text: z.string(),
	distance: z.number(),
	interval: z.tuple([z.number(), z.number()]),
	time: z.number(),
	sign: z.number(),
	heading: z.number().optional(),
	street_name: z.string().optional(),
	street_ref: z.string().optional(),
	last_heading: z.number().optional(),
});

const RoutePathSchema = z.object({
	distance: z.number(),
	weight: z.number(),
	time: z.number(),
	transfers: z.number(),
	legs: z.array(z.any()), // Can be empty array
	points_encoded: z.boolean(),
	bbox: z.array(z.number()),
	points: z.object({
		type: z.string(), // "LineString"
		coordinates: z.array(z.tuple([z.number(), z.number(), z.number()])), // [lng, lat, elevation]
	}),
	instructions: z.array(RouteInstructionSchema),
	details: z.object({}).optional(),
	ascend: z.number().optional(),
	descend: z.number().optional(),
	snapped_waypoints: z
		.object({
			type: z.string(),
			coordinates: z.array(z.tuple([z.number(), z.number(), z.number()])),
		})
		.optional(),
});

const RouteResponseSchema = z.object({
	hints: z
		.object({
			"visited_nodes.sum": z.number(),
			"visited_nodes.average": z.number(),
		})
		.optional(),
	info: z.object({
		copyrights: z.array(z.string()),
		took: z.number(),
		road_data_timestamp: z.string().optional(),
	}),
	paths: z.array(RoutePathSchema),
});

// GraphHopper API helper functions
async function callGraphHopperAPI(url: string) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`GraphHopper API error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

function buildRouteUrl(
	points: Array<{ lat: number; lng: number }>,
	vehicle: string,
	elevation: boolean,
) {
	const pointParams = points.map((p) => `point=${p.lat},${p.lng}`).join("&");
	return `https://graphhopper.com/api/1/route?${pointParams}&vehicle=${vehicle}&points_encoded=false&elevation=${elevation}&key=${env.GRAPHHOPPER_API_KEY}&type=json`;
}

function buildGeocodeUrl(query: string, limit: number) {
	return `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&limit=${limit}&key=${env.GRAPHHOPPER_API_KEY}`;
}

function buildReverseGeocodeUrl(lat: number, lng: number) {
	return `https://graphhopper.com/api/1/geocode?reverse=true&point=${lat},${lng}&key=${env.GRAPHHOPPER_API_KEY}`;
}

export const routeRouter = createTRPCRouter({
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
		.output(
			z.object({
				hits: z.array(
					z.object({
						name: z.string(),
						country: z.string().optional(),
						state: z.string().optional(),
						city: z.string().optional(),
						point: z.object({
							lat: z.number(),
							lng: z.number(),
						}),
						extent: z.array(z.number()).optional(),
					}),
				),
			}),
		)
		.query(async ({ input }) => {
			const { query, limit } = input;

			const url = buildGeocodeUrl(query, limit);
			const data = await callGraphHopperAPI(url);

			return data;
		}),

	reverseGeocode: publicProcedure
		.input(ReverseGeocodeSchema)
		.output(
			z.object({
				hits: z.array(
					z.object({
						name: z.string(),
						country: z.string().optional(),
						state: z.string().optional(),
						city: z.string().optional(),
						point: z.object({
							lat: z.number(),
							lng: z.number(),
						}),
					}),
				),
			}),
		)
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

			// Build URL for GPX export
			const pointParams = points
				.map((p) => `point=${p.lat},${p.lng}`)
				.join("&");
			const url = `https://graphhopper.com/api/1/route?${pointParams}&vehicle=${vehicle}&key=${env.GRAPHHOPPER_API_KEY}&type=gpx`;

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(
					`GraphHopper GPX export error: ${response.status} ${response.statusText}`,
				);
			}

			return response.text();
		}),
});
