"use client";

import type { LatLng } from "leaflet";
import { useCallback, useEffect, useState } from "react";
import {
	MapContainer,
	Marker,
	Polyline,
	TileLayer,
	useMapEvents,
} from "react-leaflet";
import { api } from "~/trpc/react";

const createCustomIcons = async () => {
	const L = await import("leaflet");

	// Create proper Leaflet icon objects using L.icon
	const startIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
				<circle cx="10" cy="10" r="10" fill="white" stroke="none" style="filter: drop-shadow(0 5px 4px rgba(0,0,0,0.2))"/>
				<svg x="3" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
					<line x1="4" x2="4" y1="22" y2="15"/>
				</svg>
			</svg>
		`)}`,
		iconSize: [20, 20],
		iconAnchor: [10, 20],
		popupAnchor: [0, -20],
	});

	const endIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
				<circle cx="10" cy="10" r="10" fill="white" stroke="none" style="filter: drop-shadow(0 5px 4px rgba(0,0,0,0.2))"/>
				<svg x="3" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
					<path d="m9 10 2 2 4-4"/>
				</svg>
			</svg>
		`)}`,
		iconSize: [20, 20],
		iconAnchor: [10, 20],
		popupAnchor: [0, -20],
	});

	const createWaypointIcon = (number: number) =>
		new L.Icon({
			iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
				<circle cx="8" cy="8" r="8" fill="#ff6b00" stroke="none" style="filter: drop-shadow(0 5px 5px rgba(0,0,0,0.2))"/>
				<text x="8" y="12" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="system-ui">${number}</text>
			</svg>
		`)}`,
			iconSize: [16, 16],
			iconAnchor: [8, 16],
			popupAnchor: [0, -16],
		});

	return { startIcon, endIcon, createWaypointIcon };
};

type RoutePoint = {
	lat: number;
	lng: number;
	type: "start" | "waypoint" | "end";
};

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
	const [customIcons, setCustomIcons] = useState<{
		startIcon: any;
		endIcon: any;
		createWaypointIcon: (number: number) => any;
	} | null>(null);

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

	useEffect(() => {
		createCustomIcons().then(setCustomIcons);
	}, []);

	// Handle map clicks to add start/end points
	const handleMapClick = useCallback(
		(latlng: LatLng) => {
			const newPoint: RoutePoint = {
				lat: latlng.lat,
				lng: latlng.lng,
				type: routePoints.length === 0 ? "start" : "end",
			};

			let updatedPoints: RoutePoint[];

			if (routePoints.length === 0) {
				// First click: add start point
				updatedPoints = [newPoint];
			} else if (routePoints.length === 1) {
				// Second click: add end point and calculate route
				updatedPoints = [...routePoints, newPoint];
			} else if (routePoints[0]) {
				// Subsequent clicks: replace end point
				updatedPoints = [routePoints[0], { ...newPoint, type: "end" }];
			} else {
				// Fallback: start over if no start point exists
				updatedPoints = [{ ...newPoint, type: "start" }];
			}

			setRoutePoints(updatedPoints);

			// Calculate route if we have both start and end points
			if (updatedPoints.length >= 2) {
				calculateRoute.mutate({
					points: updatedPoints,
					vehicle: "hike",
					elevation: true,
				});
			} else {
				// Clear route if we don't have enough points
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

				{/* Map click handler */}
				<MapClickHandler onMapClick={handleMapClick} />

				{/* Render markers for start/end points */}
				{customIcons &&
					routePoints.map((point, index) => {
						let icon: any;
						if (point.type === "start") {
							icon = customIcons.startIcon;
						} else if (point.type === "end") {
							icon = customIcons.endIcon;
						} else {
							// For waypoints, use numbered icons
							icon = customIcons.createWaypointIcon(index);
						}

						return (
							<Marker
								key={`${point.type}-${index}`}
								position={[point.lat, point.lng]}
								icon={icon}
							/>
						);
					})}

				{/* Render route polyline */}
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
