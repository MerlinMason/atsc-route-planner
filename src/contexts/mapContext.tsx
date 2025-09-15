"use client";

import type { LatLng } from "leaflet";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useDebounceCallback } from "usehooks-ts";
import { calculateDistanceToSegment } from "~/lib/geometry";
import { api } from "~/trpc/react";
import type { RoutePoint } from "~/components/routePoints";

// Default route calculation options
const ROUTE_OPTIONS = {
	vehicle: "hike",
	elevation: true,
} as const;

// History management configuration
const HISTORY_LIMIT_LENGTH = 50;

// History entry for undo/redo functionality
type HistoryEntry = {
	routePoints: RoutePoint[];
	timestamp: number;
};

type MapContextType = {
	// State
	routePoints: RoutePoint[];
	routeCoordinates: [number, number][];
	isCalculating: boolean;

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
};

const MapContext = createContext<MapContextType | null>(null);

type MapProviderProps = {
	children: ReactNode;
};

export const MapProvider = ({ children }: MapProviderProps) => {
	const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
	const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(
		[],
	);
	const ignoreMapClickRef = useRef(false);

	// History management
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);

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
				const coords = convertCoordinates(data.paths[0].points.coordinates);
				setRouteCoordinates(coords);
			}
		},
		onError: (error) => {
			console.error("Route calculation failed:", error);
		},
	});

	// Add entry to history
	const addToHistory = useCallback(
		(points: RoutePoint[]) => {
			const newEntry: HistoryEntry = {
				routePoints: JSON.parse(JSON.stringify(points)), // Deep clone
				timestamp: Date.now(),
			};

			setHistory((prev) => {
				// If we're not at the latest point in history, remove everything after current index
				const newHistory = prev.slice(0, historyIndex + 1);
				// Add new entry
				newHistory.push(newEntry);
				// Limit history to configured length
				if (newHistory.length > HISTORY_LIMIT_LENGTH) {
					newHistory.shift();
					setHistoryIndex((curr) => curr - 1); // Adjust index when we remove from beginning
				}
				return newHistory;
			});

			// Update history index to point to the newly added entry
			setHistoryIndex((prev) => {
				const newIndex = Math.min(prev + 1, HISTORY_LIMIT_LENGTH - 1); // Account for history limit
				return newIndex;
			});
		},
		[historyIndex],
	);

	// Debounced route calculation using usehooks-ts
	const debouncedCalculateRoute = useDebounceCallback(
		(points: RoutePoint[]) => {
			if (points.length >= 2) {
				calculateRoute.mutate({
					points: points,
					...ROUTE_OPTIONS,
				});
			} else {
				setRouteCoordinates([]);
			}
		},
		200,
	);

	// Update points and recalculate route (with history tracking)
	const updatePointsAndRoute = useCallback(
		(newPoints: RoutePoint[], skipHistory = false) => {
			setRoutePoints(newPoints);

			// Add to history unless we're in the middle of undo/redo
			if (!skipHistory) {
				addToHistory(newPoints);
			}

			// Use debounced route calculation
			debouncedCalculateRoute(newPoints);
		},
		[addToHistory, debouncedCalculateRoute],
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
				setRoutePoints([]);
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
		[routePoints, updatePointsAndRoute],
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

	// Undo functionality
	const undo = useCallback(() => {
		if (historyIndex > 0) {
			const newIndex = historyIndex - 1;
			const historyEntry = history[newIndex];
			if (historyEntry) {
				setHistoryIndex(newIndex);
				// Update without adding to history (skipHistory = true)
				updatePointsAndRoute(historyEntry.routePoints, true);
			}
		}
	}, [history, historyIndex, updatePointsAndRoute]);

	// Redo functionality
	const redo = useCallback(() => {
		if (historyIndex < history.length - 1) {
			const newIndex = historyIndex + 1;
			const historyEntry = history[newIndex];
			if (historyEntry) {
				setHistoryIndex(newIndex);
				// Update without adding to history (skipHistory = true)
				updatePointsAndRoute(historyEntry.routePoints, true);
			}
		}
	}, [history, historyIndex, updatePointsAndRoute]);

	// Calculate history state
	const canUndo = historyIndex > 0;
	const canRedo = historyIndex < history.length - 1;

	// Initialize history with empty state
	useEffect(() => {
		if (history.length === 0) {
			addToHistory([]);
		}
	}, [addToHistory, history.length]);


	const value: MapContextType = {
		// State
		routePoints,
		routeCoordinates,
		isCalculating: calculateRoute.isPending,

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
