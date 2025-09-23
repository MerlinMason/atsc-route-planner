import { Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Marker } from "react-leaflet";
import { Button } from "~/components/button";
import { PopoverLatLng } from "~/components/popoverLatLng";
import { useMap } from "~/contexts/mapContext";
import { useMapIcons } from "~/hooks/useMapIcons";

export type RoutePoint = {
	lat: number;
	lng: number;
	type: "start" | "waypoint" | "end" | "landmark";
	name?: string;
};

export type LandmarkPoint = RoutePoint & {
	type: "landmark";
	name: string;
};

export const RoutePoints = () => {
	const { routePoints } = useMap();
	const customIcons = useMapIcons();

	if (!customIcons) return null;

	return (
		<>
			{routePoints.map((point, index) => (
				<RoutePoint
					key={`${point.type}-${index}`}
					point={point}
					index={index}
				/>
			))}
		</>
	);
};

type RoutePointProps = {
	point: RoutePoint;
	index: number;
};

const RoutePoint = memo(({ point, index }: RoutePointProps) => {
	const { handleRemovePoint, handleMovePoint } = useMap();
	const customIcons = useMapIcons();
	const [openPopover, setOpenPopover] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	const { icon, pointLabel } = useMemo(() => {
		if (!customIcons) return { icon: null, pointLabel: "" };
		if (point.type === "start") {
			return { icon: customIcons.startIcon, pointLabel: point.name || "Start" };
		}
		if (point.type === "end") {
			return { icon: customIcons.endIcon, pointLabel: point.name || "End" };
		}
		if (point.type === "landmark") {
			return { icon: customIcons.createWaypointIcon(index), pointLabel: point.name || "Landmark" };
		}
		// For waypoints, use numbered icons
		const waypointNumber = index;
		return {
			icon: customIcons.createWaypointIcon(waypointNumber),
			pointLabel: point.name || `Waypoint ${waypointNumber}`,
		};
	}, [point.type, point.name, customIcons, index]);

	if (!icon) return null;

	return (
		<>
			<Marker
				position={[point.lat, point.lng]}
				icon={icon}
				draggable={true}
				eventHandlers={{
					click: (e) => {
						e.originalEvent.stopPropagation();
						if (!isDragging) {
							setOpenPopover(!openPopover);
						}
					},
					dragstart: () => {
						setIsDragging(true);
						setOpenPopover(false);
					},
					dragend: (e) => {
						const marker = e.target;
						const newLatLng = marker.getLatLng();

						handleMovePoint(index, {
							lat: newLatLng.lat,
							lng: newLatLng.lng,
						});
						setTimeout(() => setIsDragging(false), 100);
					},
				}}
			/>
			<PopoverLatLng
				point={point}
				isOpen={openPopover}
				onClose={() => setOpenPopover(false)}
			>
				<div className="flex flex-col gap-2">
					<div className="font-medium text-sm">{pointLabel}</div>
					<Button
						variant="destructive"
						size="sm"
						icon={Trash2}
						onClick={() => {
							handleRemovePoint(index);
							setOpenPopover(false);
						}}
					>
						Remove waypoint
					</Button>
				</div>
			</PopoverLatLng>
		</>
	);
});
