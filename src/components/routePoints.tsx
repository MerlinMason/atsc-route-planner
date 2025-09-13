import { Marker } from "react-leaflet";
import { useMapIcons, type MapIcon } from "~/hooks/useMapIcons";

export type RoutePoint = {
	lat: number;
	lng: number;
	type: "start" | "waypoint" | "end";
};

type RouteMarkersProps = {
	routePoints: RoutePoint[];
};

export const RoutePoints = ({ routePoints }: RouteMarkersProps) => {
	const customIcons = useMapIcons();

	if (!customIcons) return null;

	return (
		<>
			{routePoints.map((point, index) => {
				let icon: MapIcon;

				if (point.type === "start") {
					icon = customIcons.startIcon;
				} else if (point.type === "end") {
					icon = customIcons.endIcon;
				} else {
					// For waypoints, use numbered icons (count only waypoints for numbering)
					const waypointNumber =
						routePoints.slice(0, index).filter((p) => p.type === "waypoint")
							.length + 1;
					icon = customIcons.createWaypointIcon(waypointNumber);
				}

				return (
					<Marker
						key={`${point.type}-${index}`}
						position={[point.lat, point.lng]}
						icon={icon}
					/>
				);
			})}
		</>
	);
};
