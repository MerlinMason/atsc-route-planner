import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "react-use";
import { calculateDistance } from "~/lib/geo-utils";
import { api } from "~/trpc/react";

export type GeocodeHit = {
	name: string;
	country?: string;
	state?: string;
	city?: string;
	point: {
		lat: number;
		lng: number;
	};
	extent?: number[];
	distanceToUser?: number;
};

export type GeocodeResult = {
	hits: GeocodeHit[];
};

type UseGeocodingOptions = {
	debounceMs?: number;
	limit?: number;
	userLocation?: { lat: number; lng: number };
};

type UseGeocodingReturn = {
	search: (query: string) => void;
	results: GeocodeHit[];
	isLoading: boolean;
	error: string | null;
	clearResults: () => void;
};

/**
 * Adds distance calculation to hits for display purposes
 */
const addDistanceToHits = (
	hits: GeocodeHit[],
	userLocation?: { lat: number; lng: number },
): GeocodeHit[] => {
	if (!userLocation) return hits;

	return hits.map((hit) => ({
		...hit,
		_distanceToUser: calculateDistance({
			from: userLocation,
			to: hit.point,
			unit: "m",
		}),
	}));
};

/**
 * Deduplicates hits by grouping similar names and keeping the best one from each group
 */
const deduplicateHits = (hits: GeocodeHit[]): GeocodeHit[] => {
	// First, remove exact duplicates (same lat/lng/name)
	const exactlyUnique = new Map<string, GeocodeHit>();
	for (const hit of hits) {
		const exactKey = `${hit.point.lat}-${hit.point.lng}-${hit.name}`;
		if (!exactlyUnique.has(exactKey)) {
			exactlyUnique.set(exactKey, hit);
		}
	}

	// Group by normalized name for semantic deduplication
	const nameGroups = new Map<string, GeocodeHit[]>();
	for (const hit of exactlyUnique.values()) {
		// Normalize name for grouping: lowercase, remove common suffixes/prefixes
		const normalizedName = hit.name
			.toLowerCase()
			.replace(/^(the\s+|war memorial,?\s*)/i, "") // Remove "The " and "War Memorial, " prefixes
			.replace(/\s+(car park|town hall|building|entrance)$/i, "") // Remove common suffixes
			.trim();

		if (!nameGroups.has(normalizedName)) {
			nameGroups.set(normalizedName, []);
		}
		const group = nameGroups.get(normalizedName);
		if (group) {
			group.push(hit);
		}
	}

	// For each group, pick the "best" representative
	const deduplicated: GeocodeHit[] = [];
	for (const group of nameGroups.values()) {
		if (group.length === 1) {
			// Single item, just keep it
			const item = group[0];
			if (item) {
				deduplicated.push(item);
			}
		} else {
			// Multiple items with similar names - pick the best one
			// Prefer: 1) Shortest name (main entry), 2) Has extent (more detailed), 3) First one
			const best = group.sort((a, b) => {
				// Prefer shorter names (usually the main entry)
				const nameScore = a.name.length - b.name.length;
				if (nameScore !== 0) return nameScore;

				// Prefer entries with extent (more detailed geographic data)
				const extentScore = (b.extent ? 1 : 0) - (a.extent ? 1 : 0);
				if (extentScore !== 0) return extentScore;

				// Otherwise keep original order
				return 0;
			})[0];

			if (best) {
				deduplicated.push(best);
			}
		}
	}

	return deduplicated;
};

/**
 * Processes geocoding hits: deduplicates and adds distance info
 */
const processHits = (
	hits: GeocodeHit[],
	userLocation?: { lat: number; lng: number },
): GeocodeHit[] => {
	// Deduplicate similar results
	const deduplicatedHits = deduplicateHits(hits);

	// Add distance information for display
	return addDistanceToHits(deduplicatedHits, userLocation);
};

/**
 * Custom hook for debounced geocoding with search functionality
 * Includes result caching and deduplication
 */
export const useGeocoding = (
	options: UseGeocodingOptions = {},
): UseGeocodingReturn => {
	const { debounceMs = 300, limit = 5, userLocation } = options;

	const [query, setQuery] = useState<string>("");
	const [results, setResults] = useState<GeocodeHit[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Cache for search results
	const cacheRef = useRef<Map<string, GeocodeHit[]>>(new Map());
	// Current query ref to handle race conditions
	const currentQueryRef = useRef<string>("");

	// tRPC utils for manual geocoding calls
	const utils = api.useUtils();

	// Debounced query using react-use
	const [debouncedQuery, setDebouncedQuery] = useState<string>("");
	useDebounce(
		() => {
			setDebouncedQuery(query);
		},
		debounceMs,
		[query],
	);

	/**
	 * Updates state only if the query is still current (race condition protection)
	 */
	const updateStateIfCurrent = useCallback(
		(
			queryToCheck: string,
			updates: {
				results?: GeocodeHit[];
				isLoading?: boolean;
				error?: string | null;
			},
		) => {
			if (currentQueryRef.current === queryToCheck) {
				if (updates.results !== undefined) setResults(updates.results);
				if (updates.isLoading !== undefined) setIsLoading(updates.isLoading);
				if (updates.error !== undefined) setError(updates.error);
			}
		},
		[],
	);

	/**
	 * Performs the actual geocoding search
	 */
	const performSearch = useCallback(
		async (searchQuery: string) => {
			const trimmedQuery = searchQuery.trim();

			// Check cache first
			const cachedResults = cacheRef.current.get(trimmedQuery);
			if (cachedResults) {
				const processedResults = processHits(cachedResults, userLocation);
				updateStateIfCurrent(trimmedQuery, { results: processedResults });
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const response = await utils.routePlanner.geocode.fetch({
					query: trimmedQuery,
					limit,
				});

				if (response?.hits) {
					// Cache the raw results
					cacheRef.current.set(trimmedQuery, response.hits);

					// Process results and update state
					const processedResults = processHits(response.hits, userLocation);
					updateStateIfCurrent(trimmedQuery, {
						results: processedResults,
						isLoading: false,
					});
				} else {
					updateStateIfCurrent(trimmedQuery, {
						results: [],
						isLoading: false,
					});
				}
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Geocoding failed";
				updateStateIfCurrent(trimmedQuery, {
					error: errorMessage,
					results: [],
					isLoading: false,
				});
			}
		},
		[utils, limit, updateStateIfCurrent, userLocation],
	);

	// Trigger search when debounced query changes
	useEffect(() => {
		const trimmedQuery = debouncedQuery.trim();
		currentQueryRef.current = debouncedQuery;

		if (!trimmedQuery) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			return;
		}

		performSearch(debouncedQuery);
	}, [debouncedQuery, performSearch]);

	/**
	 * Search function - updates query state and triggers debounced search
	 */
	const search = useCallback((searchQuery: string) => {
		setQuery(searchQuery);

		// If query is empty, clear results immediately
		if (!searchQuery.trim()) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			currentQueryRef.current = "";
			return;
		}

		// Set loading state immediately for responsive UI
		setIsLoading(true);
		setError(null);
	}, []);

	/**
	 * Clears search results and error state
	 */
	const clearResults = useCallback(() => {
		setQuery("");
		setResults([]);
		setError(null);
		setIsLoading(false);
		currentQueryRef.current = "";
	}, []);

	return {
		search,
		results,
		isLoading,
		error,
		clearResults,
	};
};
