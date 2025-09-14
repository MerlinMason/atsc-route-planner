import type { LatLng } from "leaflet";
import { useCallback, useRef, useState } from "react";
import { calculateDistanceToSegment } from "~/lib/geometry";
import { api } from "~/trpc/react";
import type { RoutePoint } from "~/components/routePoints";

// Default route calculation options
const ROUTE_OPTIONS = {
	vehicle: "hike",
	elevation: true,
} as const;

export const useMapActions = () => {
	const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
	const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(
		[],
	);
	const ignoreMapClickRef = useRef(false);

	// tRPC mutation for route calculation
	const calculateRoute = api.routePlanner.calculate.useMutation({
		onSuccess: (data) => {
			if (data.paths && data.paths.length > 0) {
				const path = data.paths[0];
				if (path?.points?.coordinates) {
					// Convert GraphHopper format [lng, lat, elevation] to Leaflet format [lat, lng]
					const coords: [number, number][] = path.points.coordinates.map(
						(coord) => [coord[1], coord[0]],
					);
					setRouteCoordinates(coords);
				}
			}
		},
		onError: (error) => {
			console.error("Route calculation failed:", error);
		},
	});

	// Helper function to recalculate route or clear coordinates
	const updateRoute = useCallback(
		(points: RoutePoint[]) => {
			if (points.length >= 2) {
				calculateRoute.mutate({
					points,
					...ROUTE_OPTIONS,
				});
			} else {
				setRouteCoordinates([]);
			}
		},
		[calculateRoute],
	);

	// Helper function to update points and recalculate route
	const updatePointsAndRoute = useCallback(
		(newPoints: RoutePoint[]) => {
			setRoutePoints(newPoints);
			updateRoute(newPoints);
		},
		[updateRoute],
	);

	// Helper function to find the best insertion point for a waypoint
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

			const newPoint: RoutePoint = {
				lat: latlng.lat,
				lng: latlng.lng,
				type: routePoints.length === 0 ? "start" : "end",
			};

			const updatedPoints =
				routePoints.length <= 1
					? [...routePoints, newPoint]
					: [
							...routePoints.map((point) =>
								point.type === "end"
									? { ...point, type: "waypoint" as const }
									: point,
							),
							newPoint,
						];

			updatePointsAndRoute(updatedPoints);
		},
		[routePoints, updatePointsAndRoute],
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

			const newWaypoint: RoutePoint = {
				lat: latlng.lat,
				lng: latlng.lng,
				type: "waypoint",
			};

			const bestIndex = findBestInsertionIndex(latlng);
			const updatedPoints = [
				...routePoints.slice(0, bestIndex),
				newWaypoint,
				...routePoints.slice(bestIndex),
			];

			updatePointsAndRoute(updatedPoints);
		},
		[routePoints, findBestInsertionIndex, updatePointsAndRoute],
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

	return {
		// State
		routePoints,
		routeCoordinates,

		// Actions
		handleMapClick,
		handleRouteClick,
		handleRemovePoint,

		// Loading state
		isCalculating: calculateRoute.isPending,
	};
};
