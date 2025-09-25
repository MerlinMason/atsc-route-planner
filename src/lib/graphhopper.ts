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
	userLocation: z
		.object({
			lat: z.number(),
			lng: z.number(),
		})
		.optional(),
	routeStartPoint: z
		.object({
			lat: z.number(),
			lng: z.number(),
		})
		.optional(),
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
			distanceToUser: z.number().optional(),
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

// Scoring weights for geocoding relevance
const SCORING_WEIGHTS = {
	COMPLETENESS: 0.5,
	PROXIMITY: 3,
} as const;

// Maximum distance in km to consider a result relevant
const MAX_RELEVANT_DISTANCE_KM = 1000; // covers any route in UK

type GeocodeHit = z.infer<typeof GeocodeResponseSchema>["hits"][number];

/**
 * Filters hits by distance from user location or route start point
 */
const filterByDistance = (
	hits: GeocodeHit[],
	userLocation?: { lat: number; lng: number },
	routeStartPoint?: { lat: number; lng: number },
): GeocodeHit[] => {
	const referencePoint = userLocation ?? routeStartPoint;
	if (!referencePoint) return hits;

	return hits.filter((hit) => {
		const distanceKm =
			calculateDistance({
				from: referencePoint,
				to: hit.point,
				unit: "m",
			}) / 1000;

		return distanceKm <= MAX_RELEVANT_DISTANCE_KM;
	});
};

/**
 * Calculates address completeness score (0-1) based on available fields
 */
const calculateCompleteness = (hit: GeocodeHit): number => {
	const fields = [hit.name, hit.country, hit.state, hit.city, hit.extent];
	return fields.filter(Boolean).length / fields.length;
};

/**
 * Calculates proximity score based on distance to user location
 */
const calculateProximityScore = (
	hit: GeocodeHit,
	userLocation: { lat: number; lng: number },
): number => {
	const distanceKm =
		calculateDistance({ from: userLocation, to: hit.point, unit: "m" }) / 1000;

	// Logarithmic decay: closer locations get higher scores
	return Math.max(0, 1 - Math.log10(distanceKm + 1) / 2);
};

/**
 * Normalizes location name for deduplication
 */
const normalizeName = (name: string): string =>
	name
		.toLowerCase()
		.replace(/^(the\s+|war memorial,?\s*)/i, "")
		.replace(/\s+(car park|town hall|building|entrance)$/i, "")
		.trim();

/**
 * Selects the best hit from a group of similar locations
 */
const selectBestHit = (hits: GeocodeHit[]): GeocodeHit => {
	const sorted = hits.sort((a, b) => {
		// Prefer shorter names (main entries)
		const nameScore = a.name.length - b.name.length;
		if (nameScore !== 0) return nameScore;

		// Prefer entries with extent data
		const extentScore = (b.extent ? 1 : 0) - (a.extent ? 1 : 0);
		return extentScore;
	});

	const best = sorted[0];
	if (!best) {
		throw new Error("selectBestHit called with empty array");
	}
	return best;
};

/**
 * Sorts hits by cycling route relevance
 */
function sortHitsForCycling(
	hits: GeocodeHit[],
	userLocation?: { lat: number; lng: number },
): GeocodeHit[] {
	if (!userLocation) {
		return hits.sort((a, b) => a.name.length - b.name.length);
	}

	return hits
		.map((hit) => {
			const completeness = calculateCompleteness(hit);
			const proximity = calculateProximityScore(hit, userLocation);
			const distanceToUser = calculateDistance({
				from: userLocation,
				to: hit.point,
				unit: "m",
			});

			const score =
				completeness * SCORING_WEIGHTS.COMPLETENESS +
				proximity * SCORING_WEIGHTS.PROXIMITY;

			return { ...hit, distanceToUser, _calculatedScore: score };
		})
		.sort((a, b) => b._calculatedScore - a._calculatedScore);
}

/**
 * Removes duplicate and similar locations
 */
function deduplicateHits(hits: GeocodeHit[]): GeocodeHit[] {
	// Remove exact duplicates
	const uniqueHits = hits.filter(
		(hit, index, array) =>
			array.findIndex(
				(h) =>
					h.point.lat === hit.point.lat &&
					h.point.lng === hit.point.lng &&
					h.name === hit.name,
			) === index,
	);

	// Group by normalized name and select best from each group
	const groups = new Map<string, GeocodeHit[]>();
	for (const hit of uniqueHits) {
		const key = normalizeName(hit.name);
		groups.set(key, [...(groups.get(key) ?? []), hit]);
	}

	return Array.from(groups.values())
		.map((group) => (group.length === 1 ? group[0] : selectBestHit(group)))
		.filter((hit): hit is GeocodeHit => hit !== undefined);
}

/**
 * Processes geocoding hits: filters by distance, sorts by cycling relevance, deduplicates, and applies limit
 */
export function processGeocodeHits(
	hits: GeocodeHit[],
	userLocation?: { lat: number; lng: number },
	routeStartPoint?: { lat: number; lng: number },
	limit = 5,
): GeocodeHit[] {
	// Filter out results that are too far away
	const filteredHits = filterByDistance(hits, userLocation, routeStartPoint);

	// Apply cycling-focused sorting (this will also add distance data)
	const sortedHits = sortHitsForCycling(filteredHits, userLocation);

	// Deduplicate similar results (preserving the sort order)
	const deduplicatedHits = deduplicateHits(sortedHits);

	// Apply limit and return top results
	return deduplicatedHits.slice(0, limit);
}
