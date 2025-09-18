"use client";

import { useMap } from "~/contexts/mapContext";
import { processSurfaceData } from "~/lib/surface-utils";

type SurfaceBarProps = {
	activeDistance?: number | null;
};

export const SurfaceBar = ({ activeDistance }: SurfaceBarProps) => {
	const { surfaceData, elevationData, routeDistance } = useMap();
	const totalDistance = elevationData.at(-1)?.distance ?? 0;

	const surfaceSegments = processSurfaceData(surfaceData, routeDistance / 1000);

	if (surfaceSegments.length === 0 || totalDistance === 0) {
		return null;
	}

	return (
		<>
			<div className="relative h-4 w-full overflow-hidden rounded border bg-gray-100">
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
		</>
	);
};
