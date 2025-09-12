"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";

// Initialize Leaflet icons client-side only
const initializeLeafletIcons = async () => {
	const L = await import("leaflet");
	// biome-ignore lint/performance/noDelete: Required for Leaflet icon fix
	// biome-ignore lint/suspicious/noExplicitAny: Leaflet types don't include _getIconUrl
	delete (L.default.Icon.Default.prototype as any)._getIconUrl;
	L.default.Icon.Default.mergeOptions({
		iconRetinaUrl:
			"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
		iconUrl:
			"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
		shadowUrl:
			"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
	});
};

type MapProps = {
	className?: string;
};

export const RouteMap = ({ className = "" }: MapProps) => {
	useEffect(() => {
		initializeLeafletIcons();
	}, []);

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
			</MapContainer>
		</div>
	);
};
