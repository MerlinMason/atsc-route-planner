import { useEffect, useState } from "react";

export type MapIcon = Awaited<
	ReturnType<typeof createCustomIcons>
>["startIcon"];

type CustomIcons = {
	startIcon: MapIcon;
	endIcon: MapIcon;
	userLocationIcon: MapIcon;
	waypointIcon: MapIcon;
	checkpointIcon: MapIcon;
};

const createCustomIcons = async () => {
	const L = await import("leaflet");

	// Common circle background for consistency
	const createCircleBackground = (size = 14, fill = "#000") =>
		`<circle cx="14" cy="14" r="${size}" fill="${fill}" />`;

	// Create proper Leaflet icon objects using L.icon
	const startIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
				${createCircleBackground()}
				<svg x="5" y="5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
					<line x1="4" x2="4" y1="22" y2="15"/>
				</svg>
			</svg>
		`)}`,
		iconSize: [28, 28],
		iconAnchor: [14, 28],
		popupAnchor: [0, -28],
	});

	const endIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
				${createCircleBackground()}
				<svg x="5" y="5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
					<path d="m9 10 2 2 4-4"/>
				</svg>
			</svg>
		`)}`,
		iconSize: [28, 28],
		iconAnchor: [14, 28],
		popupAnchor: [0, -28],
	});

	const userLocationIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50" style="background: transparent;">
				<defs>
					<style>
						.pulse-ring {
							animation: user-location-pulse 2s infinite;
							transform-origin: center;
						}
						@keyframes user-location-pulse {
							0% { transform: scale(0.8); opacity: 1; }
							100% { transform: scale(2); opacity: 0; }
						}
					</style>
				</defs>
				<!-- Animated pulse ring -->
				<circle cx="25" cy="25" r="15" fill="#4285f4" fill-opacity="0.3" class="pulse-ring" />
				<!-- Main blue dot with white border -->
				<circle cx="25" cy="25" r="10" fill="#4285f4" stroke="white" stroke-width="3" />
				<!-- Inner white dot -->
				<circle cx="25" cy="25" r="3" fill="white" />
			</svg>
		`)}`,
		iconSize: [50, 50],
		iconAnchor: [25, 25],
		popupAnchor: [0, -25],
	});

	const waypointIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
			${createCircleBackground(8)}
			${createCircleBackground(4, "#fff")}
		</svg>
	`)}`,
		iconSize: [28, 28],
		iconAnchor: [14, 28],
		popupAnchor: [0, -28],
	});

	const checkpointIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
		<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
			${createCircleBackground()}
			<svg x="5" y="5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
				<path d="M12 7v6"/>
				<path d="m9 10 6 0"/>
			</svg>
		</svg>
	`)}`,
		iconSize: [28, 28],
		iconAnchor: [14, 28],
		popupAnchor: [0, -28],
	});

	return {
		startIcon,
		endIcon,
		userLocationIcon,
		waypointIcon,
		checkpointIcon,
	};
};

export const useMapIcons = () => {
	const [icons, setIcons] = useState<CustomIcons | null>(null);

	useEffect(() => {
		createCustomIcons().then(setIcons);
	}, []);

	return icons;
};
