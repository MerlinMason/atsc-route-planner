"use client";

import type { LatLng } from "leaflet";
import type * as L from "leaflet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import {
	useCopyToClipboard,
	useDebounce,
	useGeolocation,
	useMount,
} from "react-use";
import { toast } from "sonner";
import type { z } from "zod";
import type { RoutePoint } from "~/lib/graphhopper";
import { calculateDistanceToSegment } from "~/lib/geometry";
import type {
	ElevationChartData,
	RouteResponseSchema,
} from "~/lib/graphhopper";
import { processElevationData } from "~/lib/graphhopper";
import { decodeRouteFromUrl, encodeRouteToUrl } from "~/lib/route-encoding";
import { api } from "~/trpc/react";

// Route calculation options
const ROUTE_OPTIONS = {
	elevation: true,
};

// History management configuration
const HISTORY_LIMIT_LENGTH = 50;

// History entry for undo/redo functionality
type HistoryEntry = {
	routePoints: RoutePoint[];
	timestamp: number;
};

// History state
type HistoryState = {
	entries: HistoryEntry[];
	currentIndex: number;
};

// History actions
type HistoryAction =
	| { type: "ADD_ENTRY"; payload: RoutePoint[] }
	| { type: "UNDO" }
	| { type: "REDO" }
	| { type: "RESTORE"; payload: { entries: HistoryEntry[]; index: number } };

// History reducer for atomic state updates
function historyReducer(
	state: HistoryState,
	action: HistoryAction,
): HistoryState {
	switch (action.type) {
		case "ADD_ENTRY": {
			const newEntry: HistoryEntry = {
				routePoints: structuredClone(action.payload), // Modern deep clone
				timestamp: Date.now(),
			};

			// Remove any "future" entries if we're not at the latest point
			const newEntries = [
				...state.entries.slice(0, state.currentIndex + 1),
				newEntry,
			];

			// Apply length limit
			const limitedEntries =
				newEntries.length > HISTORY_LIMIT_LENGTH
					? newEntries.slice(-HISTORY_LIMIT_LENGTH)
					: newEntries;

			return {
				entries: limitedEntries,
				currentIndex: limitedEntries.length - 1,
			};
		}

		case "UNDO": {
			if (state.currentIndex <= 0) return state;
			return {
				...state,
				currentIndex: state.currentIndex - 1,
			};
		}

		case "REDO": {
			if (state.currentIndex >= state.entries.length - 1) return state;
			return {
				...state,
				currentIndex: state.currentIndex + 1,
			};
		}

		case "RESTORE": {
			return {
				entries: action.payload.entries,
				currentIndex: action.payload.index,
			};
		}

		default:
			return state;
	}
}

type MapContextType = {
	// State
	routePoints: RoutePoint[];
	routeCoordinates: [number, number][];
	isCalculating: boolean;
	isExporting: boolean;
	hasRoute: boolean;

	// Elevation data
	elevationData: ElevationChartData;
	elevationGain: number;
	elevationLoss: number;
	routeDistance: number;

	// Surface data
	surfaceData: Array<[number, number, string]>;

	// Location state
	userLocation: {
		latitude: number | null;
		longitude: number | null;
		error?: unknown;
		loading: boolean;
	};
	mapCenter: [number, number];

	// Current route state
	routeId: number | null;

	// Drawer state
	isDrawerOpen: boolean;

	// History state
	canUndo: boolean;
	canRedo: boolean;

	// Actions
	handleMapClick: (latlng: LatLng) => void;
	handleRouteClick: (latlng: LatLng) => void;
	handleRemovePoint: (index: number) => void;
	handleMovePoint: (
		index: number,
		newLatLng: { lat: number; lng: number },
	) => void;
	undo: () => void;
	redo: () => void;
	exportGpx: () => void;
	toggleDrawer: (open: boolean) => void;
	shareRoute: () => void;
	clearRoute: () => void;
	zoomIn: () => void;
	zoomOut: () => void;
	setMapInstance: (map: L.Map) => void;
	positionMap: (routeData: RoutePoint[]) => void;
	loadRoute: (savedRouteId: number, routeData: RoutePoint[]) => void;
	duplicateRoute: (routeData: RoutePoint[]) => void;
	setPointFromSearch: (
		latlng: { lat: number; lng: number },
		pointType: RoutePoint["type"],
		name?: string,
	) => void;
};

const MapContext = createContext<MapContextType | null>(null);

type MapProviderProps = {
	children: ReactNode;
};

// Type for the API response
type RouteApiResponse = z.infer<typeof RouteResponseSchema>;

export const MapProvider = ({ children }: MapProviderProps) => {
	// Store the complete API response
	const [routeApiData, setRouteApiData] = useState<RouteApiResponse | null>(
		null,
	);

	// Derived state from API data
	const apiCoordinates = routeApiData?.paths?.[0]?.points?.coordinates;
	const firstPath = routeApiData?.paths?.[0];

	const routeCoordinates: [number, number][] = apiCoordinates
		? apiCoordinates.map((coord) => [coord[1], coord[0]] as [number, number])
		: [];

	const elevationStats = apiCoordinates
		? processElevationData(apiCoordinates)
		: null;
	const elevationData: ElevationChartData = elevationStats?.chartData ?? [];
	const elevationGain = elevationStats?.stats.totalGain ?? 0;
	const elevationLoss = elevationStats?.stats.totalLoss ?? 0;
	const routeDistance = firstPath?.distance ?? 0;
	const surfaceData = firstPath?.details?.surface ?? [];
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [drawerDirty, setDrawerDirty] = useState(false);
	const ignoreMapClickRef = useRef(false);
	const mapInstanceRef = useRef<L.Map | null>(null);

	// Next.js router hooks for URL management
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Get user location using react-use
	const userLocation = useGeolocation();

	// Clipboard functionality
	const [clipboardState, copyToClipboard] = useCopyToClipboard();

	// Compute map center based on user location or fallback (London)
	const mapCenter: [number, number] =
		userLocation.latitude && userLocation.longitude
			? [userLocation.latitude, userLocation.longitude]
			: [51.5074, -0.1278];

	// History management with reducer
	const [historyState, dispatchHistory] = useReducer(historyReducer, {
		entries: [],
		currentIndex: -1,
	});

	// tRPC mutation for route calculation
	const calculateRoute = api.routePlanner.calculate.useMutation({
		onSuccess: (data) => {
			// Store the complete API response
			setRouteApiData(data);
		},
		onError: (error) => {
			toast.error("Failed to calculate route", {
				description: error.message || "Please try again",
			});
			// Clear route data on error
			setRouteApiData(null);
		},
	});

	// tRPC mutation for GPX export
	const exportGpxMutation = api.routePlanner.exportGpx.useMutation({
		onSuccess: (gpxData) => {
			// Create and download the GPX file
			const blob = new Blob([gpxData], { type: "application/gpx+xml" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = "route.gpx";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			// Show success message
			toast.success("Route exported successfully", {
				description: "Your GPX file has been downloaded",
			});
		},
		onError: (error) => {
			toast.error("Failed to export route", {
				description: error.message || "Please try again",
			});
		},
	});

	// Add entry to history - now much simpler!
	const addToHistory = useCallback((points: RoutePoint[]) => {
		dispatchHistory({ type: "ADD_ENTRY", payload: points });
	}, []);

	// Compute routePoints from URL (source of truth)
	const routePoints = useMemo(() => {
		const encoded = searchParams.get("route");
		return encoded ? (decodeRouteFromUrl(encoded) ?? []) : [];
	}, [searchParams]);

	// Get current routeId from URL (indicates editing existing route)
	const routeId = useMemo(() => {
		const id = searchParams.get("routeId");
		return id ? Number.parseInt(id, 10) : null;
	}, [searchParams]);

	// Helper to update route in URL
	const updateRouteInUrl = useCallback(
		(newPoints: RoutePoint[], newRouteId?: number | null) => {
			const params = new URLSearchParams(searchParams.toString());

			if (newPoints.length === 0) {
				params.delete("route");
				params.delete("routeId");
			} else {
				const encoded = encodeRouteToUrl(newPoints);
				if (encoded) {
					params.set("route", encoded);
				}

				// Handle routeId parameter
				if (newRouteId !== undefined) {
					if (newRouteId) {
						params.set("routeId", newRouteId.toString());
					} else {
						params.delete("routeId");
					}
				}
			}

			router.replace(`${pathname}?${params.toString()}`, { scroll: false });
		},
		[searchParams, pathname, router],
	);

	// Add initial state to history on mount
	useMount(() => {
		if (routePoints.length > 0) {
			addToHistory(routePoints);
		}
	});

	// Debounced route calculation using react-use
	useDebounce(
		() => {
			if (routePoints.length >= 2) {
				calculateRoute.mutate({
					points: routePoints,
					...ROUTE_OPTIONS,
				});
			} else {
				// Clear API data when no route
				setRouteApiData(null);
			}
		},
		200,
		[routePoints],
	);

	// Update points and recalculate route (with history tracking)
	const updatePointsAndRoute = useCallback(
		(newPoints: RoutePoint[], skipHistory = false) => {
			updateRouteInUrl(newPoints);

			// Add to history unless we're in the middle of undo/redo
			if (!skipHistory) {
				addToHistory(newPoints);
			}
		},
		[updateRouteInUrl, addToHistory],
	);

	// Create a new route point
	const createRoutePoint = useCallback(
		(latlng: LatLng, type: RoutePoint["type"]): RoutePoint => ({
			lat: latlng.lat,
			lng: latlng.lng,
			type,
		}),
		[],
	);

	// Add a new end point, converting the previous end to waypoint if needed
	const addEndPoint = useCallback(
		(newPoint: RoutePoint) => {
			if (routePoints.length <= 1) {
				return [...routePoints, newPoint];
			}

			// Convert existing end point to waypoint, add new end point
			return [
				...routePoints.map((point) =>
					point.type === "end"
						? { ...point, type: "waypoint" as const }
						: point,
				),
				newPoint,
			];
		},
		[routePoints],
	);

	// Find the best insertion point for a waypoint
	const findBestInsertionIndex = useCallback(
		(clickPoint: LatLng) => {
			let bestIndex = 1; // Insert after start by default
			let minDistance = Number.MAX_VALUE;

			for (let i = 0; i < routePoints.length - 1; i++) {
				const start = routePoints[i];
				const end = routePoints[i + 1];
				if (!start || !end) continue;

				const distance = calculateDistanceToSegment(
					clickPoint,
					{ lat: start.lat, lng: start.lng },
					{ lat: end.lat, lng: end.lng },
				);

				if (distance < minDistance) {
					minDistance = distance;
					bestIndex = i + 1;
				}
			}

			return bestIndex;
		},
		[routePoints],
	);

	// Handle map clicks to add start/waypoints/end points
	const handleMapClick = useCallback(
		(latlng: LatLng) => {
			if (ignoreMapClickRef.current) {
				return;
			}

			const pointType = routePoints.length === 0 ? "start" : "end";
			const newPoint = createRoutePoint(latlng, pointType);
			const updatedPoints = addEndPoint(newPoint);

			updatePointsAndRoute(updatedPoints);
		},
		[routePoints, createRoutePoint, addEndPoint, updatePointsAndRoute],
	);

	// Handle route line clicks to insert waypoints
	const handleRouteClick = useCallback(
		(latlng: LatLng) => {
			ignoreMapClickRef.current = true;

			// Reset the flag after a short delay to allow future map clicks
			setTimeout(() => {
				ignoreMapClickRef.current = false;
			}, 100);

			if (routePoints.length < 2) return; // Need at least start and end

			const newWaypoint = createRoutePoint(latlng, "waypoint");
			const bestIndex = findBestInsertionIndex(latlng);
			const updatedPoints = [
				...routePoints.slice(0, bestIndex),
				newWaypoint,
				...routePoints.slice(bestIndex),
			];

			updatePointsAndRoute(updatedPoints);
		},
		[
			routePoints,
			createRoutePoint,
			findBestInsertionIndex,
			updatePointsAndRoute,
		],
	);

	// Handle waypoint removal
	const handleRemovePoint = useCallback(
		(indexToRemove: number) => {
			if (routePoints.length <= 1) {
				// If only one point or fewer, clear everything
				updateRouteInUrl([]);
				setRouteApiData(null);
				return;
			}

			const removedPoint = routePoints[indexToRemove];
			const updatedPoints = routePoints.filter(
				(_, index) => index !== indexToRemove,
			);

			// Handle special cases for start/end point removal
			if (removedPoint?.type === "start" && updatedPoints.length > 0) {
				// If start is removed, make the first remaining point the new start
				const firstPoint = updatedPoints[0];
				if (firstPoint) {
					updatedPoints[0] = { ...firstPoint, type: "start" };
				}
			} else if (removedPoint?.type === "end" && updatedPoints.length > 0) {
				// If end is removed, make the last remaining point the new end
				const lastIndex = updatedPoints.length - 1;
				const lastPoint = updatedPoints[lastIndex];
				if (lastPoint) {
					updatedPoints[lastIndex] = { ...lastPoint, type: "end" };
				}
			}

			updatePointsAndRoute(updatedPoints);
		},
		[routePoints, updatePointsAndRoute, updateRouteInUrl],
	);

	// Handle waypoint movement (dragging)
	const handleMovePoint = useCallback(
		(index: number, newLatLng: { lat: number; lng: number }) => {
			const updatedPoints = routePoints.map((point, i) =>
				i === index
					? { ...point, lat: newLatLng.lat, lng: newLatLng.lng }
					: point,
			);

			updatePointsAndRoute(updatedPoints);
		},
		[routePoints, updatePointsAndRoute],
	);

	// History management
	const undo = useCallback(() => {
		const prevEntry = historyState.entries[historyState.currentIndex - 1];
		if (prevEntry) {
			dispatchHistory({ type: "UNDO" });
			// Update without adding to history (skipHistory = true)
			updatePointsAndRoute(prevEntry.routePoints, true);
		}
	}, [historyState, updatePointsAndRoute]);

	const redo = useCallback(() => {
		const nextEntry = historyState.entries[historyState.currentIndex + 1];
		if (nextEntry) {
			dispatchHistory({ type: "REDO" });
			// Update without adding to history (skipHistory = true)
			updatePointsAndRoute(nextEntry.routePoints, true);
		}
	}, [historyState, updatePointsAndRoute]);

	const canUndo = historyState.currentIndex > 0;
	const canRedo = historyState.currentIndex < historyState.entries.length - 1;

	// GPX export function
	const exportGpx = useCallback(() => {
		if (routePoints.length < 2) {
			toast.error("Cannot export route", {
				description: "Need at least 2 points to create a route",
			});
			return;
		}

		exportGpxMutation.mutate({
			points: routePoints,
			...ROUTE_OPTIONS,
		});
	}, [routePoints, exportGpxMutation]);

	// Drawer handlers
	const toggleDrawer = useCallback((open: boolean) => {
		setIsDrawerOpen(open);
		setDrawerDirty(true);
	}, []);

	// Share route function
	const shareRoute = useCallback(() => {
		if (routePoints.length < 2) {
			toast.error("Cannot share route", {
				description: "Need at least 2 points to create a shareable route",
			});
			return;
		}

		const encoded = encodeRouteToUrl(routePoints);
		if (!encoded) {
			toast.error("Failed to create shareable URL", {
				description: "Please try again",
			});
			return;
		}

		// Build URL with route data and optionally routeId
		const params = new URLSearchParams();
		params.set("route", encoded);
		if (routeId) {
			params.set("routeId", routeId.toString());
		}

		const url = `${window.location.origin}${pathname}?${params.toString()}`;
		copyToClipboard(url);

		if (clipboardState.error) {
			toast.error("Failed to copy URL", {
				description: "Please try again",
			});
		} else {
			toast.success("Route URL copied to clipboard", {
				description: "Share this link with others to show them your route",
			});
		}
	}, [routePoints, routeId, pathname, copyToClipboard, clipboardState.error]);

	// Map positioning logic
	const positionMap = useCallback(
		(routeData: RoutePoint[]) => {
			if (!mapInstanceRef.current) return;

			const map = mapInstanceRef.current;

			// If route exists, fit to route bounds
			if (routeData.length >= 2) {
				const coordinates: [number, number][] = routeData.map((point) => [
					point.lat,
					point.lng,
				]);
				map.fitBounds(coordinates, { padding: [20, 20] });
				return;
			}

			// Else if user location available, center on user
			if (userLocation.latitude && userLocation.longitude) {
				map.setView([userLocation.latitude, userLocation.longitude], 13);
				return;
			}

			// Else default location (London) - MapContainer already handles this via center prop
		},
		[userLocation.latitude, userLocation.longitude],
	);

	// Load route function (for editing existing routes)
	const loadRoute = useCallback(
		(savedRouteId: number, routeData: RoutePoint[]) => {
			updateRouteInUrl(routeData, savedRouteId);
			// Position map to show the loaded route immediately with the provided data
			setTimeout(() => {
				positionMap(routeData);
			}, 100);
			setDrawerDirty(false);
		},
		[updateRouteInUrl, positionMap],
	);

	// Duplicate route function (creates new route from existing data)
	const duplicateRoute = useCallback(
		(routeData: RoutePoint[]) => {
			updateRouteInUrl(routeData, null);
			// Position map to show the duplicated route immediately with the provided data
			setTimeout(() => {
				positionMap(routeData);
			}, 100);
			setDrawerDirty(false);
		},
		[updateRouteInUrl, positionMap],
	);

	// Clear route function
	const clearRoute = useCallback(() => {
		router.push("/");
		setDrawerDirty(false);
	}, [router]);

	// Set map instance (called from components)
	const setMapInstance = useCallback((map: L.Map) => {
		mapInstanceRef.current = map;
	}, []);

	// Zoom functions
	const zoomIn = useCallback(() => {
		mapInstanceRef.current?.zoomIn();
	}, []);

	const zoomOut = useCallback(() => {
		mapInstanceRef.current?.zoomOut();
	}, []);

	// Set point from search result
	const setPointFromSearch = useCallback(
		(
			latlng: { lat: number; lng: number },
			pointType: RoutePoint["type"],
			name?: string,
		) => {
			// Create a fake LatLng object for existing helper functions
			const fakeLatLng = { lat: latlng.lat, lng: latlng.lng } as LatLng;

			// Create the new point with name using existing helper
			const newPoint: RoutePoint = {
				...createRoutePoint(fakeLatLng, pointType),
				name,
			};

			let updatedPoints: RoutePoint[];

			if (pointType === "start") {
				// Replace existing start point or add as first point
				const existingStartIndex = routePoints.findIndex(
					(p) => p.type === "start",
				);
				if (existingStartIndex >= 0) {
					updatedPoints = [...routePoints];
					updatedPoints[existingStartIndex] = newPoint;
				} else {
					// No existing start, add at beginning
					updatedPoints = [newPoint, ...routePoints];
				}
			} else if (pointType === "end") {
				// Replace existing end point or add as last point
				const existingEndIndex = routePoints.findIndex((p) => p.type === "end");
				if (existingEndIndex >= 0) {
					updatedPoints = [...routePoints];
					updatedPoints[existingEndIndex] = newPoint;
				} else {
					// Convert current end to waypoint if exists, then add new end
					updatedPoints = addEndPoint(newPoint);
				}
			} else {
				// For checkpoints and waypoints, use same insertion logic
				if (routePoints.length < 2) {
					updatedPoints = addEndPoint(newPoint);
				} else {
					const bestIndex = findBestInsertionIndex(fakeLatLng);
					updatedPoints = [
						...routePoints.slice(0, bestIndex),
						newPoint,
						...routePoints.slice(bestIndex),
					];
				}
			}

			updatePointsAndRoute(updatedPoints);

			// Position map to show the entire route after adding the new point
			setTimeout(() => {
				positionMap(updatedPoints);
			}, 100);
		},
		[
			routePoints,
			createRoutePoint,
			addEndPoint,
			findBestInsertionIndex,
			updatePointsAndRoute,
			positionMap,
		],
	);

	// Initialize history with empty state
	useEffect(() => {
		if (historyState.entries.length === 0) {
			addToHistory([]);
		}
	}, [addToHistory, historyState.entries.length]);

	// Auto-open drawer when there are 2+ route points (only if user hasn't interacted with it)
	useEffect(() => {
		if (routePoints.length >= 2 && !isDrawerOpen && !drawerDirty) {
			setIsDrawerOpen(true);
		}
	}, [routePoints.length, isDrawerOpen, drawerDirty]);

	const value: MapContextType = {
		// State
		routePoints,
		routeCoordinates,
		isCalculating: calculateRoute.isPending,
		isExporting: exportGpxMutation.isPending,
		hasRoute: routePoints.length >= 2,

		// Elevation data
		elevationData,
		elevationGain,
		elevationLoss,
		routeDistance,

		// Surface data
		surfaceData,

		// Location state
		userLocation,
		mapCenter,

		// Current route state
		routeId,

		// Drawer state
		isDrawerOpen,

		// History state
		canUndo,
		canRedo,

		// Actions
		handleMapClick,
		handleRouteClick,
		handleRemovePoint,
		handleMovePoint,
		undo,
		redo,
		exportGpx,
		toggleDrawer,
		shareRoute,
		clearRoute,
		zoomIn,
		zoomOut,
		setMapInstance,
		positionMap,
		loadRoute,
		duplicateRoute,
		setPointFromSearch,
	};

	return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export const useMap = () => {
	const context = useContext(MapContext);
	if (!context) {
		throw new Error("useMap must be used within a MapProvider");
	}
	return context;
};
