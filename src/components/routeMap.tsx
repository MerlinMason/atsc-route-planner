"use client";

import { MapContainer, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import { MapProvider, useMap } from "~/contexts/mapContext";
import { RoutePoints } from "~/components/routePoints";
import { FloatingMenu } from "~/components/floatingMenu";
import { LoaderCircle } from "lucide-react";

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

const MapContent = ({ className }: { className: string }) => {
	const { routeCoordinates, handleRouteClick, isCalculating } = useMap();

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

				<MapClickHandler />
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
