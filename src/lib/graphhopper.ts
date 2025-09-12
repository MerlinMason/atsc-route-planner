import { z } from "zod";
import { env } from "~/env";

// GraphHopper API constants
export const GRAPHHOPPER_API_ROOT = "https://graphhopper.com/api/1";

// Input schemas
export const RoutePointSchema = z.object({
	lat: z.number(),
	lng: z.number(),
	type: z.enum(["start", "waypoint", "end"]),
});

export const CalculateRouteSchema = z.object({
	points: z.array(RoutePointSchema).min(2, "At least 2 points required"),
	vehicle: z.enum(["hike", "bike", "car"]).default("hike"),
	elevation: z.boolean().default(true),
});

export const GeocodeSchema = z.object({
	query: z.string().min(1, "Query required"),
	limit: z.number().min(1).max(10).default(5),
});

export const ReverseGeocodeSchema = z.object({
	lat: z.number(),
	lng: z.number(),
});

// Response types based on GraphHopper API
export const RouteInstructionSchema = z.object({
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

export const RoutePathSchema = z.object({
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

export const RouteResponseSchema = z.object({
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

export const GeocodeResponseSchema = z.object({
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
});

// GraphHopper API helper functions
export async function callGraphHopperAPI(url: string) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`GraphHopper API error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

export function buildRouteUrl(
	points: Array<{ lat: number; lng: number }>,
	vehicle: string,
	elevation: boolean,
) {
	const pointParams = points.map((p) => `point=${p.lat},${p.lng}`).join("&");
	return `${GRAPHHOPPER_API_ROOT}/route?${pointParams}&vehicle=${vehicle}&points_encoded=false&elevation=${elevation}&key=${env.GRAPHHOPPER_API_KEY}&type=json`;
}

export function buildGeocodeUrl(query: string, limit: number) {
	return `${GRAPHHOPPER_API_ROOT}/geocode?q=${encodeURIComponent(query)}&limit=${limit}&key=${env.GRAPHHOPPER_API_KEY}`;
}

export function buildReverseGeocodeUrl(lat: number, lng: number) {
	return `${GRAPHHOPPER_API_ROOT}/geocode?reverse=true&point=${lat},${lng}&key=${env.GRAPHHOPPER_API_KEY}`;
}

export function buildGpxUrl(
	points: Array<{ lat: number; lng: number }>,
	vehicle: string,
) {
	const pointParams = points.map((p) => `point=${p.lat},${p.lng}`).join("&");
	return `${GRAPHHOPPER_API_ROOT}/route?${pointParams}&vehicle=${vehicle}&key=${env.GRAPHHOPPER_API_KEY}&type=gpx`;
}