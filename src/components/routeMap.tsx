"use client";

import type { LatLng } from "leaflet";
import { useCallback, useState } from "react";
import { MapContainer, Polyline, TileLayer, useMapEvents } from "react-leaflet";
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
				<RoutePoints routePoints={routePoints} />

				{routeCoordinates.length > 0 && (
					<Polyline
						positions={routeCoordinates}
						pathOptions={{
							color: "#ff6b00",
							weight: 7,
							opacity: 1,
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
