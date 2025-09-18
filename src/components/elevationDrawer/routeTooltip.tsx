"use client";

import { createPortal } from "react-dom";
import { formatDistance, formatElevation } from "~/lib/route-utils";

type RouteTooltipProps = {
	x: number;
	y: number;
	distance: number;
	elevation: number;
	surface?: {
		formattedSurface: string;
		color: string;
	};
};

const calculateTooltipPosition = (x: number, y: number) => {
	const tooltipWidth = 250;
	const tooltipHeight = 100;

	let tooltipX = x + 10;
	let tooltipY = y - 10;

	// Keep tooltip within viewport bounds
	if (tooltipX + tooltipWidth > window.innerWidth) {
		tooltipX = x - tooltipWidth - 10;
	}
	if (tooltipY < 0) {
		tooltipY = y + 20;
	}
	if (tooltipY + tooltipHeight > window.innerHeight) {
		tooltipY = y - tooltipHeight - 10;
	}

	return { x: tooltipX, y: tooltipY };
};

export const RouteTooltip = ({
	x,
	y,
	distance,
	elevation,
	surface,
}: RouteTooltipProps) => {
	if (typeof document === "undefined") return null;

	const position = calculateTooltipPosition(x, y);

	return createPortal(
		<div
			className="pointer-events-none fixed z-[9999] rounded-lg border bg-background p-3 text-sm shadow-lg"
			style={{
				left: position.x,
				top: position.y,
			}}
		>
			<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
				<span className="font-semibold">Elevation:</span>
				<span className="font-mono">{formatElevation(elevation)}</span>
				<span className="font-semibold">Distance:</span>
				<span className="font-mono">
					{formatDistance(Number(distance) * 1000)}
				</span>
				{surface && (
					<>
						<span className="font-semibold">Surface:</span>
						<div className="flex items-center gap-2">
							<div
								className="h-3 w-3 rounded-full border border-gray-300"
								style={{ backgroundColor: surface.color }}
							/>
							<span className="font-mono">{surface.formattedSurface}</span>
						</div>
					</>
				)}
			</div>
		</div>,
		document.body,
	);
};
