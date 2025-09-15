"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import {
	MapContainer,
	Polyline,
	TileLayer,
	useMap as useLeafletMap,
	useMapEvents,
} from "react-leaflet";
import { ElevationDrawer } from "~/components/elevationDrawer";
import { FloatingMenu } from "~/components/floatingMenu";
import { RoutePoints } from "~/components/routePoints";
import { MapProvider, useMap } from "~/contexts/mapContext";

type MapProps = {
	className?: string;
	session?: {
		user?: {
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	} | null;
};

export const RouteMap = ({ className = "", session }: MapProps) => {
	return (
		<MapProvider>
			<MapContent className={className} />
			<FloatingMenu session={session ?? null} />
			<ElevationDrawer />
		</MapProvider>
	);
};

// Component to handle map click events
const MapClickHandler = () => {
	const { handleMapClick } = useMap();

	useMapEvents({
		click: (e) => {
			handleMapClick(e.latlng);
		},
	});
	return null;
};

// Component to handle updating map view when user location is detected
const LocationHandler = () => {
	const map = useLeafletMap();
	const { userLocation } = useMap();

	useEffect(() => {
		if (
			userLocation.latitude &&
			userLocation.longitude &&
			!userLocation.loading
		) {
			// Move map to user location
			map.setView([userLocation.latitude, userLocation.longitude], 13);
		}
	}, [
		userLocation.latitude,
		userLocation.longitude,
		userLocation.loading,
		map,
	]);

	return null;
};

const MapContent = ({ className }: { className: string }) => {
	const { routeCoordinates, handleRouteClick, isCalculating, mapCenter } =
		useMap();

	return (
		<div className={`h-full w-full ${className}`}>
			<MapContainer
				center={mapCenter}
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

				<MapClickHandler />
				<LocationHandler />
				<RoutePoints />

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
			{isCalculating && (
				<div className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-lg bg-black/80 px-4 py-2 text-white">
					<LoaderCircle size={16} className="animate-spin" />
					Calculating route...
				</div>
			)}
		</div>
	);
};
