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
import type { RoutePoint } from "~/components/routePoints";
import { calculateDistanceToSegment } from "~/lib/geometry";
import type { ElevationChartData } from "~/lib/graphhopper";
import { processElevationData } from "~/lib/graphhopper";
import { api } from "~/trpc/react";

// Default route calculation options
const ROUTE_OPTIONS = {
	vehicle: "hike",
	elevation: true,
} as const;

// Default map center (London)
const DEFAULT_MAP_CENTER: [number, number] = [51.5074, -0.1278];

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

	// Elevation data
	elevationData: ElevationChartData;
	elevationGain: number;
	elevationLoss: number;
	routeDistance: number;

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
	positionMap: () => void;
	loadRoute: (savedRouteId: number, routeData: RoutePoint[]) => void;
	duplicateRoute: (routeData: RoutePoint[]) => void;
};

const MapContext = createContext<MapContextType | null>(null);

type MapProviderProps = {
	children: ReactNode;
};

export const MapProvider = ({ children }: MapProviderProps) => {
	const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(
		[],
	);
	const [elevationData, setElevationData] = useState<ElevationChartData>([]);
	const [elevationGain, setElevationGain] = useState(0);
	const [elevationLoss, setElevationLoss] = useState(0);
	const [routeDistance, setRouteDistance] = useState(0);
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

	// Compute map center based on user location or fallback
	const mapCenter: [number, number] =
		userLocation.latitude && userLocation.longitude
			? [userLocation.latitude, userLocation.longitude]
			: DEFAULT_MAP_CENTER;

	// History management with reducer
	const [historyState, dispatchHistory] = useReducer(historyReducer, {
		entries: [],
		currentIndex: -1,
	});

	// Convert GraphHopper format [lng, lat, elevation] to Leaflet format [lat, lng]
	const convertCoordinates = useCallback(
		(coordinates: number[][]): [number, number][] =>
			coordinates.map((coord) => [coord[1] ?? 0, coord[0] ?? 0]),
		[],
	);

	// tRPC mutation for route calculation
	const calculateRoute = api.routePlanner.calculate.useMutation({
		onSuccess: (data) => {
			if (data.paths?.[0]?.points?.coordinates) {
				const rawCoordinates = data.paths[0].points.coordinates;
				const coords = convertCoordinates(rawCoordinates);
				setRouteCoordinates(coords);

				// Process elevation data and stats in one operation
				const { chartData, stats } = processElevationData(rawCoordinates);
				setElevationData(chartData);
				setElevationGain(stats.totalGain);
				setElevationLoss(stats.totalLoss);

				// Set route distance from API response
				setRouteDistance(data.paths[0]?.distance ?? 0);
			}
		},
		onError: (error) => {
			toast.error("Failed to calculate route", {
				description: error.message || "Please try again",
			});
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

	// Simple URL encoding/decoding utilities
	const encodeRouteToUrl = useCallback((points: RoutePoint[]): string => {
		try {
			return btoa(JSON.stringify(points));
		} catch {
			return "";
		}
	}, []);

	const decodeRouteFromUrl = useCallback(
		(encoded: string): RoutePoint[] | null => {
			try {
				return JSON.parse(atob(encoded)) as RoutePoint[];
			} catch {
				return null;
			}
		},
		[],
	);

	// Compute routePoints from URL (source of truth)
	const routePoints = useMemo(() => {
		const encoded = searchParams.get("route");
		return encoded ? (decodeRouteFromUrl(encoded) ?? []) : [];
	}, [searchParams, decodeRouteFromUrl]);

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
		[searchParams, encodeRouteToUrl, pathname, router],
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
				setRouteCoordinates([]);
				setElevationData([]);
				setElevationGain(0);
				setElevationLoss(0);
				setRouteDistance(0);
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
				setRouteCoordinates([]);
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
			vehicle: "hike",
			elevation: true,
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
	}, [
		routePoints,
		routeId,
		encodeRouteToUrl,
		pathname,
		copyToClipboard,
		clipboardState.error,
	]);

	// Load route function (for editing existing routes)
	const loadRoute = useCallback(
		(savedRouteId: number, routeData: RoutePoint[]) => {
			updateRouteInUrl(routeData, savedRouteId);
		},
		[updateRouteInUrl],
	);

	// Duplicate route function (creates new route from existing data)
	const duplicateRoute = useCallback(
		(routeData: RoutePoint[]) => {
			updateRouteInUrl(routeData, null);
		},
		[updateRouteInUrl],
	);

	// Clear route function
	const clearRoute = useCallback(() => {
		router.push("/");
	}, [router]);

	// Set map instance (called from components)
	const setMapInstance = useCallback((map: L.Map) => {
		mapInstanceRef.current = map;
	}, []);

	// Zoom functions
	const zoomIn = useCallback(() => {
		if (mapInstanceRef.current) {
			mapInstanceRef.current.zoomIn();
		}
	}, []);

	const zoomOut = useCallback(() => {
		if (mapInstanceRef.current) {
			mapInstanceRef.current.zoomOut();
		}
	}, []);

	// Map positioning logic
	const positionMap = useCallback(() => {
		if (!mapInstanceRef.current) return;

		const map = mapInstanceRef.current;

		// If route exists, fit to route bounds
		if (routePoints.length >= 2) {
			const coordinates: [number, number][] = routePoints.map((point) => [
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
	}, [routePoints, userLocation.latitude, userLocation.longitude]);

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

		// Elevation data
		elevationData,
		elevationGain,
		elevationLoss,
		routeDistance,

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
