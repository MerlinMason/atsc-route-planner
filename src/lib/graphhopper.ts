import { z } from "zod";
import { env } from "~/env";
import { calculateDistance } from "./geo-utils";

// GraphHopper API constants
export const GRAPHHOPPER_API_ROOT = "https://graphhopper.com/api/1";

// Input schemas
export const RoutePointSchema = z.object({
	lat: z.number(),
	lng: z.number(),
	type: z.enum(["start", "waypoint", "end", "checkpoint"]),
	name: z.string().optional(),
});

// Infer TypeScript type from Zod schema - single source of truth
export type RoutePoint = z.infer<typeof RoutePointSchema>;

export const CalculateRouteSchema = z.object({
	points: z.array(RoutePointSchema).min(2, "At least 2 points required"),
	elevation: z.boolean().default(true),
	vehicle: z.enum(["hike", "bike"]),
});

export const GeocodeSchema = z.object({
	query: z.string().min(1, "Query required"),
	limit: z.number().min(1).max(10).default(5),
});

export const ReverseGeocodeSchema = z.object({
	lat: z.number(),
	lng: z.number(),
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
	details: z.object({
		surface: z.array(z.tuple([z.number(), z.number(), z.string()])),
	}),
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
	elevation: boolean,
	vehicle: "hike" | "bike",
) {
	const pointParams = points.map((p) => `point=${p.lat},${p.lng}`).join("&");
	return `${GRAPHHOPPER_API_ROOT}/route?${pointParams}&vehicle=${vehicle}&details=surface&points_encoded=false&elevation=${elevation}&key=${env.GRAPHHOPPER_API_KEY}&type=json`;
}

export function buildGeocodeUrl(query: string, limit: number) {
	return `${GRAPHHOPPER_API_ROOT}/geocode?q=${encodeURIComponent(query)}&limit=${limit}&key=${env.GRAPHHOPPER_API_KEY}`;
}

export function buildReverseGeocodeUrl(lat: number, lng: number) {
	return `${GRAPHHOPPER_API_ROOT}/geocode?reverse=true&point=${lat},${lng}&key=${env.GRAPHHOPPER_API_KEY}`;
}

/**
 * Generates a GPX file from route coordinates
 * This creates a clean GPX with just the route track, no waypoints
 */
export function generateGpxFromCoordinates(
	coordinates: Array<[number, number, number]>, // [lng, lat, elevation]
	routeName = "Route",
): string {
	const trackPoints = coordinates
		.map(
			([lng, lat, elevation]) =>
				`      <trkpt lat="${lat}" lon="${lng}">
        <ele>${Math.round(elevation)}</ele>
      </trkpt>`,
		)
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="All Terrain Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <name>${routeName}</name>
    <desc>Route created with All Terrain Route Planner</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${routeName}</name>
    <type>ride</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

// Elevation processing types and utilities
export type ElevationChartData = Array<{
	distance: number;
	elevation: number;
}>;

export type ElevationStats = {
	totalGain: number;
	totalLoss: number;
};

/**
 * Processes route coordinates to create elevation chart data and calculate stats
 */
export function processElevationData(
	coordinates: Array<[number, number, number]>,
): { chartData: ElevationChartData; stats: ElevationStats } {
	if (coordinates.length === 0) {
		return {
			chartData: [],
			stats: { totalGain: 0, totalLoss: 0 },
		};
	}

	let cumulativeDistance = 0;
	let totalGain = 0;
	let totalLoss = 0;
	const chartData: ElevationChartData = [];

	coordinates.forEach((coord, index) => {
		const [lng, lat, elevation] = coord;

		// Calculate distance from previous point
		if (index > 0) {
			const prevCoord = coordinates[index - 1];
			if (prevCoord) {
				const [prevLng, prevLat, prevElevation] = prevCoord;
				cumulativeDistance += calculateDistance({
					from: { lat: prevLat, lng: prevLng },
					to: { lat, lng },
					unit: "km",
				});

				// Calculate elevation gain/loss
				const elevationDiff = elevation - prevElevation;
				if (elevationDiff > 0) {
					totalGain += elevationDiff;
				} else if (elevationDiff < 0) {
					totalLoss -= elevationDiff;
				}
			}
		}

		chartData.push({
			distance: cumulativeDistance,
			elevation: Math.round(elevation),
		});
	});

	return {
		chartData,
		stats: {
			totalGain: Math.round(totalGain),
			totalLoss: Math.round(totalLoss),
		},
	};
}
