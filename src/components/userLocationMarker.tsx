"use client";

import { Marker } from "react-leaflet";
import { useMap as useMapContext } from "~/contexts/mapContext";
import { useMapIcons } from "~/hooks/useMapIcons";

export const UserLocationMarker = () => {
	const { userLocation } = useMapContext();
	const icons = useMapIcons();

	// Don't render if conditions aren't met
	if (
		!userLocation.latitude ||
		!userLocation.longitude ||
		!icons?.userLocationIcon
	) {
		return null;
	}

	return (
		<Marker
			position={[userLocation.latitude, userLocation.longitude]}
			icon={icons.userLocationIcon}
			zIndexOffset={1000}
		/>
	);
};
