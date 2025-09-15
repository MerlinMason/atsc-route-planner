import { Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Marker } from "react-leaflet";
import { Button } from "~/components/button";
import { PopoverLatLng } from "~/components/popoverLatLng";
import { useMapIcons } from "~/hooks/useMapIcons";

export type RoutePoint = {
	lat: number;
	lng: number;
	type: "start" | "waypoint" | "end";
};

type RoutePointsProps = {
	routePoints: RoutePoint[];
	onRemovePoint: (index: number) => void;
	onMovePoint: (index: number, newLatLng: { lat: number; lng: number }) => void;
};

export const RoutePoints = ({
	routePoints,
	onRemovePoint,
	onMovePoint,
}: RoutePointsProps) => {
	const customIcons = useMapIcons();

	if (!customIcons) return null;

	return (
		<>
			{routePoints.map((point, index) => (
				<RoutePoint
					key={`${point.type}-${index}`}
					point={point}
					index={index}
					onRemovePoint={onRemovePoint}
					onMovePoint={onMovePoint}
				/>
			))}
		</>
	);
};

type RoutePointProps = {
	point: RoutePoint;
	index: number;
	onRemovePoint: (index: number) => void;
	onMovePoint: (index: number, newLatLng: { lat: number; lng: number }) => void;
};

const RoutePoint = memo(
	({ point, index, onRemovePoint, onMovePoint }: RoutePointProps) => {
		const customIcons = useMapIcons();
		const [openPopover, setOpenPopover] = useState(false);
		const [isDragging, setIsDragging] = useState(false);

		const { icon, pointLabel } = useMemo(() => {
			if (!customIcons) return { icon: null, pointLabel: "" };
			if (point.type === "start") {
				return { icon: customIcons.startIcon, pointLabel: "Start" };
			}
			if (point.type === "end") {
				return { icon: customIcons.endIcon, pointLabel: "End" };
			}
			// For waypoints, use numbered icons
			const waypointNumber = index;
			return {
				icon: customIcons.createWaypointIcon(waypointNumber),
				pointLabel: `Waypoint ${waypointNumber}`,
			};
		}, [point.type, customIcons, index]);

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

							onMovePoint(index, {
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
								onRemovePoint(index);
								setOpenPopover(false);
							}}
						>
							Remove waypoint
						</Button>
					</div>
				</PopoverLatLng>
			</>
		);
	},
);
