"use client";

import type { LatLng } from "leaflet";
import { useMemo } from "react";
import { Polyline } from "react-leaflet";
import { useMap } from "~/contexts/mapContext";
import {
	type RouteSegment,
	processSurfaceData,
	surfaceSegmentsToRouteSegments,
} from "~/lib/surface-utils";

type ColoredRouteProps = {
	routeCoordinates: [number, number][];
	onRouteClick: (latlng: LatLng) => void;
};

export const ColoredRoute = ({
	routeCoordinates,
	onRouteClick,
}: ColoredRouteProps) => {
	const { surfaceData, routeDistance } = useMap();

	const routeSegments = useMemo((): RouteSegment[] => {
		// Fallback to single-color route if no surface data
		const fallbackSegment: RouteSegment = {
			coordinates: routeCoordinates,
			color: "var(--color-foreground)",
			key: "no-surface-data",
		};

		if (!surfaceData.length || !routeCoordinates.length) {
			return [fallbackSegment];
		}

		const totalDistanceKm = routeDistance / 1000;
		const surfaceSegments = processSurfaceData(surfaceData, totalDistanceKm);

		const segments = surfaceSegmentsToRouteSegments(
			surfaceSegments,
			routeCoordinates,
			totalDistanceKm,
		);

		return segments.length > 0 ? segments : [fallbackSegment];
	}, [surfaceData, routeCoordinates, routeDistance]);

	return routeSegments.map((segment) => (
		<Polyline
			key={segment.key}
			positions={segment.coordinates}
			pathOptions={{
				color: segment.color,
				weight: 6,
				opacity: 1,
			}}
			eventHandlers={{
				click: (e) => {
					onRouteClick(e.latlng);
				},
			}}
		/>
	));
};
