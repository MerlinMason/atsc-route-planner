import { useMemo, useState } from "react";
import { useDebounce } from "react-use";
import type { z } from "zod";
import type { GeocodeResponseSchema } from "~/lib/graphhopper";
import { api } from "~/trpc/react";

export type GeocodeHit = z.infer<typeof GeocodeResponseSchema>["hits"][number];

type UseGeocodingOptions = {
	debounceMs: number;
	limit: number;
	userLocation: { lat: number; lng: number } | undefined;
	routeStartPoint?: { lat: number; lng: number };
};

/**
 * Custom hook for debounced geocoding with search functionality
 * Uses tRPC's built-in caching, loading states, and error handling
 */
export const useGeocoding = (options: UseGeocodingOptions) => {
	const { debounceMs, limit, userLocation, routeStartPoint } = options;

	const [query, setQuery] = useState<string>("");
	const [debouncedQuery, setDebouncedQuery] = useState<string>("");

	// Debounced query using react-use
	useDebounce(
		() => {
			setDebouncedQuery(query);
		},
		debounceMs,
		[query],
	);

	// Prepare query input for tRPC
	const queryInput = useMemo(() => {
		const trimmedQuery = debouncedQuery.trim();
		if (!trimmedQuery) return null;

		return {
			query: trimmedQuery,
			limit,
			userLocation,
			routeStartPoint,
		};
	}, [debouncedQuery, limit, userLocation, routeStartPoint]);

	// Use tRPC query with enabled/disabled based on query
	const geocodeQuery = api.routePlanner.geocode.useQuery(
		queryInput ?? { query: "", limit, userLocation, routeStartPoint },
		{
			enabled: !!queryInput,
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 10 * 60 * 1000, // 10 minutes
		},
	);

	return {
		search: setQuery,
		results: geocodeQuery.data?.hits ?? [],
		isLoading: geocodeQuery.isLoading,
		error: geocodeQuery.error?.message ?? null,
		clearResults: () => {
			setQuery("");
		},
	};
};
