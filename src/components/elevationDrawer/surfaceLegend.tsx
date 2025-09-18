"use client";

import { useMap } from "~/contexts/mapContext";
import { getUniqueSurfaces, processSurfaceData } from "~/lib/surface-utils";

export const SurfaceLegend = () => {
	const { surfaceData, routeDistance } = useMap();
	const surfaceSegments = processSurfaceData(surfaceData, routeDistance / 1000);
	const uniqueSurfaces = getUniqueSurfaces(surfaceSegments);

	if (uniqueSurfaces.length === 0) {
		return null;
	}

	return (
		<ul className="flex flex-wrap justify-center gap-3">
			{uniqueSurfaces.map((surface) => (
				<li key={surface.surface} className="flex items-center gap-2 text-xs">
					<div
						className="h-3 w-3 rounded-full border border-gray-300"
						style={{ backgroundColor: surface.color }}
					/>
					<span className="text-muted-foreground">
						{surface.formattedSurface}
					</span>
				</li>
			))}
		</ul>
	);
};
