"use client";

import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";

/**
 * PopoverLatLng - A custom popover component for positioning relative to map coordinates
 *
 * This component is used instead of shadcn's Popover because:
 * 1. Leaflet markers use CSS transforms that conflict with Floating UI's positioning
 * 2. We need precise positioning based on lat/lng coordinates converted to screen pixels
 *
 * Uses shadcn design tokens for consistent styling while bypassing positioning conflicts.
 */

type PopoverLatLngProps = {
	point: { lat: number; lng: number };
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	offsetX?: number;
	offsetY?: number;
};

export const PopoverLatLng = ({
	point,
	isOpen,
	onClose,
	children,
	offsetX = 14,
	offsetY = -40,
}: PopoverLatLngProps) => {
	const map = useMap();

	if (!isOpen) return null;

	// Convert lat/lng to screen coordinates
	const screenPoint = map.latLngToContainerPoint([point.lat, point.lng]);

	return createPortal(
		<>
			{/* Click outside to close overlay */}
			<div
				className="fixed inset-0 z-[999]"
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						onClose();
					}
				}}
				role="button"
				tabIndex={0}
			/>
			{/* Popover content */}
			<div
				className="fixed z-[1000] w-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
				style={{
					left: screenPoint.x + offsetX,
					top: screenPoint.y + offsetY,
				}}
			>
				{children}
			</div>
		</>,
		document.body
	);
};
