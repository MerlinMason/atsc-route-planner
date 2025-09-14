import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Marker } from "react-leaflet";
import { Button } from "~/components/button";
import { PopoverLatLng } from "~/components/popoverLatLng";
import { useMapIcons, type MapIcon } from "~/hooks/useMapIcons";

export type RoutePoint = {
	lat: number;
	lng: number;
	type: "start" | "waypoint" | "end";
};

type RouteMarkersProps = {
	routePoints: RoutePoint[];
	onRemovePoint: (index: number) => void;
};


export const RoutePoints = ({
	routePoints,
	onRemovePoint,
}: RouteMarkersProps) => {
	const customIcons = useMapIcons();
	const [openPopover, setOpenPopover] = useState<number | null>(null);

	if (!customIcons) return null;

	return (
		<>
			{routePoints.map((point, index) => {
				let icon: MapIcon;
				let pointLabel: string;

				if (point.type === "start") {
					icon = customIcons.startIcon;
					pointLabel = "Start";
				} else if (point.type === "end") {
					icon = customIcons.endIcon;
					pointLabel = "End";
				} else {
					// For waypoints, use numbered icons (count only waypoints for numbering)
					const waypointNumber =
						routePoints.slice(0, index).filter((p) => p.type === "waypoint")
							.length + 1;
					icon = customIcons.createWaypointIcon(waypointNumber);
					pointLabel = `Waypoint ${waypointNumber}`;
				}

				return (
					<div key={`${point.type}-${index}`}>
						<Marker
							position={[point.lat, point.lng]}
							icon={icon}
							eventHandlers={{
								click: (e) => {
									e.originalEvent.stopPropagation();
									setOpenPopover(openPopover === index ? null : index);
								},
							}}
						/>
						<PopoverLatLng
							point={point}
							isOpen={openPopover === index}
							onClose={() => setOpenPopover(null)}
						>
							<div className="flex flex-col gap-2">
								<div className="font-medium text-sm">{pointLabel}</div>
								<Button
									variant="destructive"
									size="sm"
									icon={Trash2}
									onClick={() => {
										onRemovePoint(index);
										setOpenPopover(null);
									}}
								>
									Remove waypoint
								</Button>
							</div>
						</PopoverLatLng>
					</div>
				);
			})}
		</>
	);
};
