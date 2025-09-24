"use client";

import { CircleDot, Flag, MapPinCheckInside } from "lucide-react";
import { memo } from "react";
import { Button } from "~/components/button";
import { PopoverLatLng } from "~/components/popoverLatLng";
import { useMap } from "~/contexts/mapContext";
import type { RoutePoint } from "~/lib/graphhopper";

type MapContextMenuProps = {
	point: { lat: number; lng: number } | null;
	isOpen: boolean;
	onClose: () => void;
};

export const MapContextMenu = memo(
	({ point, isOpen, onClose }: MapContextMenuProps) => {
		const { setPointFromSearch } = useMap();

		if (!point || !isOpen) return null;

		const handleAction = (type: RoutePoint["type"]) => {
			setPointFromSearch(point, type);
			onClose();
		};

		return (
			<PopoverLatLng point={point} isOpen={isOpen} onClose={onClose}>
				<div className="flex min-w-[140px] flex-col gap-1">
					<Button
						variant="ghost"
						size="sm"
						icon={Flag}
						onClick={() => handleAction("start")}
						className="justify-start"
					>
						Set start point
					</Button>
					<Button
						variant="ghost"
						size="sm"
						icon={MapPinCheckInside}
						onClick={() => handleAction("end")}
						className="justify-start"
					>
						Set end point
					</Button>
					<Button
						variant="ghost"
						size="sm"
						icon={CircleDot}
						onClick={() => handleAction("waypoint")}
						className="justify-start"
					>
						Add waypoint
					</Button>
				</div>
			</PopoverLatLng>
		);
	},
);
