import { useEffect, useState } from "react";

export type MapIcon = Awaited<
	ReturnType<typeof createCustomIcons>
>["startIcon"];

type CustomIcons = {
	startIcon: MapIcon;
	endIcon: MapIcon;
	createWaypointIcon: (number: number) => MapIcon;
};

const createCustomIcons = async () => {
	const L = await import("leaflet");

	// Create proper Leaflet icon objects using L.icon
	const startIcon = new L.Icon({
		iconUrl: `data:image/svg+xml;base64,${btoa(`
			<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" style="background: transparent;">
				<circle cx="14" cy="14" r="13" fill="#22c55e" stroke="#16a34a" stroke-width="1" style="filter: drop-shadow(0 7px 7px rgba(0,0,0,0.3))"/>
				<svg x="7" y="7" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
				<circle cx="14" cy="14" r="13" fill="white" stroke="#e5e7eb" stroke-width="1" style="filter: drop-shadow(0 7px 7px rgba(0,0,0,0.3))"/>
				<svg x="5" y="5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
					<path d="m9 10 2 2 4-4"/>
				</svg>
			</svg>
		`)}`,
		iconSize: [28, 28],
		iconAnchor: [14, 28],
		popupAnchor: [0, -28],
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

export const useMapIcons = () => {
	const [icons, setIcons] = useState<CustomIcons | null>(null);

	useEffect(() => {
		createCustomIcons().then(setIcons);
	}, []);

	return icons;
};
