"use client";

import { useState } from "react";
import { useMap } from "~/contexts/mapContext";
import { getSurfaceAtDistance, processSurfaceData } from "~/lib/surface-utils";
import { RouteTooltip } from "./routeTooltip";

export const SurfaceBar = () => {
	const { surfaceData, elevationData, routeDistance } = useMap();
	const totalDistance = elevationData.at(-1)?.distance ?? 0;
	const [tooltip, setTooltip] = useState<{
		x: number;
		y: number;
		distance: number;
		elevation: number;
		surface: {
			formattedSurface: string;
			color: string;
		};
	} | null>(null);

	const surfaceSegments = processSurfaceData(surfaceData, routeDistance / 1000);

	if (surfaceSegments.length === 0 || totalDistance === 0) {
		return null;
	}

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = x / rect.width;
		const distance = percentage * totalDistance;

		// Find closest elevation point
		const elevationPoint = elevationData.reduce((closest, point) =>
			Math.abs(point.distance - distance) <
			Math.abs(closest.distance - distance)
				? point
				: closest,
		);

		// Find surface at this distance
		const surface = getSurfaceAtDistance(surfaceSegments, distance);

		if (surface && elevationPoint) {
			setTooltip({
				x: e.clientX,
				y: e.clientY,
				distance: elevationPoint.distance,
				elevation: elevationPoint.elevation,
				surface: {
					formattedSurface: surface.formattedSurface,
					color: surface.color,
				},
			});
		}
	};

	const handleMouseLeave = () => {
		setTooltip(null);
	};

	return (
		<>
			<div
				className="relative h-4 w-full overflow-hidden rounded border bg-gray-100"
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{surfaceSegments.map((segment) => {
					// Calculate percentage width and position
					const startPercent = (segment.startDistance / totalDistance) * 100;
					const widthPercent =
						((segment.endDistance - segment.startDistance) / totalDistance) *
						100;

					return (
						<div
							key={`surface-bar-${segment.startDistance}-${segment.endDistance}-${segment.surface}`}
							className="pointer-events-none absolute top-0 h-full border-white/20 border-r"
							style={{
								left: `${startPercent}%`,
								width: `${widthPercent}%`,
								backgroundColor: segment.color,
							}}
						/>
					);
				})}
			</div>

			{/* Tooltip */}
			{tooltip && (
				<RouteTooltip
					x={tooltip.x}
					y={tooltip.y}
					distance={tooltip.distance}
					elevation={tooltip.elevation}
					surface={tooltip.surface}
				/>
			)}
		</>
	);
};
