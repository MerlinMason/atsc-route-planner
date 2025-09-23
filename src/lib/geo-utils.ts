import type { LatLngPoint } from "./geometry";

type CalculateDistanceParams = {
	/** Starting point with lat/lng coordinates */
	from: LatLngPoint;
	/** Ending point with lat/lng coordinates */
	to: LatLngPoint;
	/** Unit for return value - 'km' for kilometers, 'm' for meters (default: 'km') */
	unit?: "km" | "m";
};

/**
 * Calculates distance between two geographic points using Haversine formula
 */
export const calculateDistance = ({
	from,
	to,
	unit = "km",
}: CalculateDistanceParams): number => {
	const R = 6371; // Earth's radius in kilometers
	const dLat = ((to.lat - from.lat) * Math.PI) / 180;
	const dLng = ((to.lng - from.lng) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((from.lat * Math.PI) / 180) *
			Math.cos((to.lat * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distanceKm = R * c;

	return unit === "m" ? distanceKm * 1000 : distanceKm;
};
