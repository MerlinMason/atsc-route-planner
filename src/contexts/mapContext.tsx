"use client";

import type { LatLng } from "leaflet";
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { calculateDistanceToSegment } from "~/lib/geometry";
import { api } from "~/trpc/react";
import type { RoutePoint } from "~/components/routePoints";

// Default route calculation options
const ROUTE_OPTIONS = {
	vehicle: "hike",
	elevation: true,
} as const;

type MapContextType = {
	// State
	routePoints: RoutePoint[];
	routeCoordinates: [number, number][];
	isCalculating: boolean;

	// Actions
	handleMapClick: (latlng: LatLng) => void;
	handleRouteClick: (latlng: LatLng) => void;
	handleRemovePoint: (index: number) => void;
	handleMovePoint: (
		index: number,
		newLatLng: { lat: number; lng: number },
	) => void;
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

	// Update points and recalculate route
	const updatePointsAndRoute = useCallback(
		(newPoints: RoutePoint[]) => {
			setRoutePoints(newPoints);
			
			if (newPoints.length >= 2) {
				calculateRoute.mutate({
					points: newPoints,
					...ROUTE_OPTIONS,
				});
			} else {
				setRouteCoordinates([]);
			}
		},
		[calculateRoute],
	);

	// Create a new route point
	const createRoutePoint = useCallback((latlng: LatLng, type: RoutePoint["type"]): RoutePoint => ({
		lat: latlng.lat,
		lng: latlng.lng,
		type,
	}), []);

	// Add a new end point, converting the previous end to waypoint if needed
	const addEndPoint = useCallback((newPoint: RoutePoint) => {
		if (routePoints.length <= 1) {
			return [...routePoints, newPoint];
		}
		
		// Convert existing end point to waypoint, add new end point
		return [
			...routePoints.map((point) =>
				point.type === "end" ? { ...point, type: "waypoint" as const } : point,
			),
			newPoint,
		];
	}, [routePoints]);

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
		[routePoints, createRoutePoint, findBestInsertionIndex, updatePointsAndRoute],
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

	const value: MapContextType = {
		// State
		routePoints,
		routeCoordinates,
		isCalculating: calculateRoute.isPending,

		// Actions
		handleMapClick,
		handleRouteClick,
		handleRemovePoint,
		handleMovePoint,
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
