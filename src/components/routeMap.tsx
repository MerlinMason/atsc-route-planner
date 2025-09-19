"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import {
	MapContainer,
	TileLayer,
	useMap as useLeafletMap,
	useMapEvents,
} from "react-leaflet";
import { ColoredRoute } from "~/components/coloredRoute";
import { ElevationDrawer } from "~/components/elevationDrawer";
import { FloatingMenu } from "~/components/floatingMenu";
import { RoutePoints } from "~/components/routePoints";
import { UserLocationMarker } from "~/components/userLocationMarker";
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

// Component to handle initial map positioning and setup
const LocationHandler = () => {
	const map = useLeafletMap();
	const { userLocation, setMapInstance, routePoints, positionMap } = useMap();
	const hasPositionedRef = useRef(false);

	// Set map instance in context on mount
	useEffect(() => {
		setMapInstance(map);
	}, [map, setMapInstance]);

	// Reset positioning state when route is cleared
	useEffect(() => {
		if (routePoints.length === 0) {
			hasPositionedRef.current = false;
		}
	}, [routePoints.length]);

	// Determine initial map position once when geolocation completes
	useEffect(() => {
		// Only run this once
		if (hasPositionedRef.current) {
			return;
		}

		// Wait for geolocation to finish loading
		if (userLocation.loading) {
			return;
		}

		// Mark as positioned to prevent re-running
		hasPositionedRef.current = true;

		// Use the positioning logic from context
		positionMap(routePoints);
	}, [userLocation.loading, positionMap, routePoints]);

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
				zoomControl={false}
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
				<UserLocationMarker />

				{routeCoordinates.length > 0 && (
					<ColoredRoute
						routeCoordinates={routeCoordinates}
						onRouteClick={handleRouteClick}
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
