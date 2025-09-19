// Surface type definitions and utilities

export type SurfaceSegment = {
	startDistance: number;
	endDistance: number;
	surface: string;
	formattedSurface: string;
	color: string;
};

// Surface categories with their display names and colors
const SURFACE_CATEGORIES = {
	road: {
		displayName: "Road",
		color: "#0ea5e9",
		surfaces: ["asphalt", "concrete", "paved"],
	},
	path: {
		displayName: "Path",
		color: "#84cc16",
		surfaces: ["path", "track", "wood", "cobblestone", "metal"],
	},
	dirt: {
		displayName: "Off-Road",
		color: "#b45309",
		surfaces: [
			"dirt",
			"grass",
			"unpaved",
			"gravel",
			"light_gravel",
			"fine_gravel",
			"sand",
			"rock",
		],
	},
	unknown: {
		displayName: "Unknown",
		color: "#9ca3af",
		surfaces: ["unknown", "missing"],
	},
} as const;

// Create reverse lookup map for surface to category
const SURFACE_TO_CATEGORY = Object.entries(SURFACE_CATEGORIES).reduce(
	(acc, [categoryKey, category]) => {
		for (const surface of category.surfaces) {
			acc[surface] = categoryKey as keyof typeof SURFACE_CATEGORIES;
		}
		return acc;
	},
	{} as Record<string, keyof typeof SURFACE_CATEGORIES>,
);

/**
 * Format surface name from API format to display format
 * Uses surface categories for consistent grouping
 */
export function formatSurfaceName(surface: string): string {
	const category = SURFACE_TO_CATEGORY[surface.toLowerCase()];
	if (category) {
		return SURFACE_CATEGORIES[category].displayName;
	}

	// Fallback for unknown surfaces
	return surface
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Get color for a surface type
 */
export function getSurfaceColor(surface: string): string {
	const category = SURFACE_TO_CATEGORY[surface.toLowerCase()];
	if (category) {
		return SURFACE_CATEGORIES[category].color;
	}

	// Fallback for unknown surfaces
	return SURFACE_CATEGORIES.unknown.color;
}

/**
 * Process raw surface data from API into usable segments
 * Input: [[0, 3, 'dirt'], [3, 4, 'concrete']], totalDistanceKm
 * Output: SurfaceSegment objects with formatted names and colors
 * Note: Treats surface data as proportional segments across the total route distance
 */
export function processSurfaceData(
	surfaceData: Array<[number, number, string]>,
	totalDistanceKm: number,
): SurfaceSegment[] {
	if (surfaceData.length === 0) return [];

	// Find the range of the surface data to calculate proportions
	const distanceValues = surfaceData.flatMap(([start, end, _surface]) => [
		start,
		end,
	]);
	const minValue = Math.min(...distanceValues);
	const maxValue = Math.max(...distanceValues);
	const range = maxValue - minValue;

	if (range === 0) return [];

	// Map surface indices proportionally across the total distance
	return surfaceData.map(([startIndex, endIndex, surface]) => ({
		startDistance: ((startIndex - minValue) / range) * totalDistanceKm,
		endDistance: ((endIndex - minValue) / range) * totalDistanceKm,
		surface,
		formattedSurface: formatSurfaceName(surface),
		color: getSurfaceColor(surface),
	}));
}

/**
 * Find the surface type at a specific distance along the route
 */
export function getSurfaceAtDistance(
	surfaceSegments: SurfaceSegment[],
	distance: number,
): SurfaceSegment | null {
	return (
		surfaceSegments.find(
			(segment) =>
				distance >= segment.startDistance && distance <= segment.endDistance,
		) ?? null
	);
}

/**
 * Get all unique surface types in the route that have meaningful distance coverage
 * Deduplicates based on formatted surface name (e.g., multiple road types show as single "Road" entry)
 * Filters out surfaces with negligible distance (< 0.01km = 10m)
 */
export function getUniqueSurfaces(
	surfaceSegments: SurfaceSegment[],
): SurfaceSegment[] {
	const uniqueSurfaces = new Map<string, SurfaceSegment>();
	const minDistance = 0.01; // 10 meters minimum

	for (const segment of surfaceSegments) {
		const distance = segment.endDistance - segment.startDistance;

		// Only include surfaces that cover meaningful distance
		if (
			distance >= minDistance &&
			!uniqueSurfaces.has(segment.formattedSurface)
		) {
			uniqueSurfaces.set(segment.formattedSurface, segment);
		}
	}

	return Array.from(uniqueSurfaces.values());
}
