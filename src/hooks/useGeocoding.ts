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
	// Extended properties for relevance sorting
	_calculatedScore?: number;
	_distanceToUser?: number;
	_distanceToStart?: number;
};

export type GeocodeResult = {
	hits: GeocodeHit[];
};

type UseGeocodingOptions = {
	debounceMs?: number;
	limit?: number;
	userLocation?: { lat: number; lng: number };
	startLocation?: { lat: number; lng: number };
};

type UseGeocodingReturn = {
	search: (query: string) => void;
	results: GeocodeHit[];
	isLoading: boolean;
	error: string | null;
	clearResults: () => void;
};

// Scoring constants
const SCORING = {
	COMPLETENESS_WEIGHT: 0.5,
	USER_PROXIMITY_WEIGHT: 3,
	START_PROXIMITY_WEIGHT: 2,
	USER_DISTANCE_DIVISOR: 2,
	START_DISTANCE_DIVISOR: 3,
} as const;

/**
 * Calculates how complete an address is (0-1 score)
 */
const calculateAddressCompleteness = (hit: GeocodeHit): number => {
	const fields = [hit.name, hit.city, hit.state, hit.country];
	const fieldsPresent = fields.filter(Boolean).length;
	return fieldsPresent / fields.length;
};

/**
 * Calculates logarithmic distance factor for scoring
 */
const calculateDistanceFactor = (
	distanceInMeters: number,
	divisor: number,
): number => {
	return Math.max(0, 1 - Math.log10(distanceInMeters / 1000 + 1) / divisor);
};

/**
 * Adds distance-based scoring to a hit
 */
const addDistanceScoring = (
	hit: GeocodeHit,
	referenceLocation: { lat: number; lng: number },
	weight: number,
	divisor: number,
	distanceProperty: "_distanceToUser" | "_distanceToStart",
): number => {
	const distance = calculateDistance({
		from: referenceLocation,
		to: hit.point,
		unit: "m",
	});

	// Store distance for potential display
	hit[distanceProperty] = distance;

	// Calculate and return score contribution
	const distanceFactor = calculateDistanceFactor(distance, divisor);
	return distanceFactor * weight;
};

/**
 * Calculates relevance score for a single geocoding hit
 */
const calculateHitScore = (
	hit: GeocodeHit,
	userLocation?: { lat: number; lng: number },
	startLocation?: { lat: number; lng: number },
): number => {
	let score = 0;

	// Address completeness score
	const completeness = calculateAddressCompleteness(hit);
	score += completeness * SCORING.COMPLETENESS_WEIGHT;

	// User proximity scoring
	if (userLocation) {
		score += addDistanceScoring(
			hit,
			userLocation,
			SCORING.USER_PROXIMITY_WEIGHT,
			SCORING.USER_DISTANCE_DIVISOR,
			"_distanceToUser",
		);
	}

	// Start point proximity scoring (for route planning)
	if (startLocation) {
		score += addDistanceScoring(
			hit,
			startLocation,
			SCORING.START_PROXIMITY_WEIGHT,
			SCORING.START_DISTANCE_DIVISOR,
			"_distanceToStart",
		);
	}

	return score;
};

/**
 * Sorts geocoding hits based on relevance for cycling routes
 */
const sortHitsByRelevance = (
	hits: GeocodeHit[],
	userLocation?: { lat: number; lng: number },
	startLocation?: { lat: number; lng: number },
): GeocodeHit[] => {
	const sortedHits = hits.map((hit) => ({ ...hit })); // Create copies to avoid mutation

	// Calculate scores for all hits
	for (const hit of sortedHits) {
		hit._calculatedScore = calculateHitScore(hit, userLocation, startLocation);
	}

	// Sort by calculated score (highest first)
	return sortedHits.sort(
		(a, b) => (b._calculatedScore ?? 0) - (a._calculatedScore ?? 0),
	);
};

/**
 * Custom hook for debounced geocoding with search functionality
 * Includes result caching and relevance sorting algorithm
 */
export const useGeocoding = (
	options: UseGeocodingOptions = {},
): UseGeocodingReturn => {
	const { debounceMs = 300, limit = 5, userLocation, startLocation } = options;

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

			if (!trimmedQuery) {
				setResults([]);
				setError(null);
				return;
			}

			// Check cache first
			const cachedResults = cacheRef.current.get(trimmedQuery);
			if (cachedResults) {
				const sortedResults = sortHitsByRelevance(
					cachedResults,
					userLocation,
					startLocation,
				);
				updateStateIfCurrent(trimmedQuery, { results: sortedResults });
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

					// Apply relevance sorting and update results
					const sortedResults = sortHitsByRelevance(
						response.hits,
						userLocation,
						startLocation,
					);
					updateStateIfCurrent(trimmedQuery, {
						results: sortedResults,
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
		[utils, limit, userLocation, startLocation, updateStateIfCurrent],
	);

	// Trigger search when debounced query changes
	useEffect(() => {
		currentQueryRef.current = debouncedQuery;
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
