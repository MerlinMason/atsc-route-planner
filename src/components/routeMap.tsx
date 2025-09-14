"use client";

import type { LatLng } from "leaflet";
import { useCallback, useRef, useState } from "react";
import { MapContainer, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import { calculateDistanceToSegment } from "~/lib/geometry";
import { api } from "~/trpc/react";
import { RoutePoints, type RoutePoint } from "./routePoints";

type MapProps = {
	className?: string;
};

// Component to handle map click events
function MapClickHandler({
	onMapClick,
}: { onMapClick: (latlng: LatLng) => void }) {
	useMapEvents({
		click: (e) => {
			onMapClick(e.latlng);
		},
	});
	return null;
}

export const RouteMap = ({ className = "" }: MapProps) => {
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

			setRoutePoints(updatedPoints);

			// Calculate route if we have both start and end points
			if (updatedPoints.length >= 2) {
				calculateRoute.mutate({
					points: updatedPoints,
					vehicle: "hike",
					elevation: true,
				});
			} else {
				setRouteCoordinates([]);
			}
		},
		[routePoints, calculateRoute],
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

			// Find the best position to insert the new waypoint
			const newWaypoint: RoutePoint = {
				lat: latlng.lat,
				lng: latlng.lng,
				type: "waypoint",
			};

			// Find the closest segment to insert the waypoint
			let bestIndex = 1; // Insert after start by default
			let minDistance = Number.MAX_VALUE;

			for (let i = 0; i < routePoints.length - 1; i++) {
				const start = routePoints[i];
				const end = routePoints[i + 1];
				if (!start || !end) continue;

				// Calculate distance from click point to line segment
				const distance = calculateDistanceToSegment(
					latlng,
					{ lat: start.lat, lng: start.lng },
					{ lat: end.lat, lng: end.lng }
				);

				if (distance < minDistance) {
					minDistance = distance;
					bestIndex = i + 1;
				}
			}

			// Insert the waypoint at the best position
			const updatedPoints = [
				...routePoints.slice(0, bestIndex),
				newWaypoint,
				...routePoints.slice(bestIndex),
			];

			setRoutePoints(updatedPoints);

			// Recalculate route
			calculateRoute.mutate({
				points: updatedPoints,
				vehicle: "hike",
				elevation: true,
			});
		},
		[routePoints, calculateRoute],
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

			const updatedPoints = routePoints.filter((_, index) => index !== indexToRemove);
			
			// Handle special cases for start/end point removal
			if (routePoints[indexToRemove]?.type === "start" && updatedPoints.length > 0) {
				// If start is removed, make the first remaining point the new start
				const firstPoint = updatedPoints[0];
				if (firstPoint) {
					updatedPoints[0] = { ...firstPoint, type: "start" };
				}
			} else if (routePoints[indexToRemove]?.type === "end" && updatedPoints.length > 0) {
				// If end is removed, make the last remaining point the new end
				const lastIndex = updatedPoints.length - 1;
				const lastPoint = updatedPoints[lastIndex];
				if (lastPoint) {
					updatedPoints[lastIndex] = { ...lastPoint, type: "end" };
				}
			}

			setRoutePoints(updatedPoints);

			// Recalculate route if we still have at least 2 points
			if (updatedPoints.length >= 2) {
				calculateRoute.mutate({
					points: updatedPoints,
					vehicle: "hike",
					elevation: true,
				});
			} else {
				setRouteCoordinates([]);
			}
		},
		[routePoints, calculateRoute],
	);

	return (
		<div className={`h-full w-full ${className}`}>
			<MapContainer
				center={[51.5074, -0.1278]} // London
				zoom={13}
				style={{ height: "100%", width: "100%" }}
				className="z-0"
			>
				<TileLayer
					attribution=""
					url="https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoib29sZXgiLCJhIjoiY2x2ajd2M2FvMGs4dTJpcDdudnhseHRtZSJ9.LPCZ7u7espUA0LkKtJCaEg"
					maxZoom={18}
					tileSize={512}
					zoomOffset={-1}
				/>

				<MapClickHandler onMapClick={handleMapClick} />
				<RoutePoints routePoints={routePoints} onRemovePoint={handleRemovePoint} />

				{routeCoordinates.length > 0 && (
					<Polyline
						positions={routeCoordinates}
						pathOptions={{
							color: "#ff6b00",
							weight: 7,
							opacity: 1,
						}}
						eventHandlers={{
							click: (e) => {
								handleRouteClick(e.latlng);
							},
						}}
					/>
				)}
			</MapContainer>

			{/* Loading indicator */}
			{calculateRoute.isPending && (
				<div className="absolute top-4 left-4 z-10 rounded-lg bg-black/80 px-4 py-2 text-white">
					Calculating route...
				</div>
			)}
		</div>
	);
};
