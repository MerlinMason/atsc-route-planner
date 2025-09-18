"use client";

import { Route, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceDot, XAxis, YAxis } from "recharts";
import { ChartContainer } from "~/components/chart";
import type { ChartConfig } from "~/components/chart";
import { useMap } from "~/contexts/mapContext";
import { formatDistance, formatElevation } from "~/lib/route-utils";
import { getSurfaceAtDistance, processSurfaceData } from "~/lib/surface-utils";
import { RouteTooltip } from "./routeTooltip";
import { SurfaceBar } from "./surfaceBar";
import { SurfaceLegend } from "./surfaceLegend";

type TooltipData = {
	x: number;
	y: number;
	distance: number;
	elevation: number;
	surface: {
		formattedSurface: string;
		color: string;
	};
};

const chartConfig = {
	elevation: {
		label: "Elevation",
		color: "var(--color-route)",
	},
} satisfies ChartConfig;

/**
 * Interactive elevation chart with synchronized hover tracking across chart and surface bar.
 * Features: elevation profile, surface type visualization, tooltips, and active point indicator.
 */
export const ElevationChart = () => {
	const {
		elevationData: data,
		elevationGain,
		elevationLoss,
		surfaceData,
		routeDistance,
	} = useMap();

	// State for hover interactions
	const [activeDistance, setActiveDistance] = useState<number | null>(null);
	const [tooltip, setTooltip] = useState<TooltipData | null>(null);

	// Memoize expensive calculations
	const surfaceSegments = useMemo(
		() => processSurfaceData(surfaceData, routeDistance / 1000),
		[surfaceData, routeDistance],
	);

	const maxDistance = useMemo(() => data.at(-1)?.distance ?? 0, [data]);

	// Find the closest data point for the active distance
	const activePoint = useMemo(() => {
		if (activeDistance === null || data.length === 0) return null;

		return data.reduce((closest, point) =>
			Math.abs(point.distance - activeDistance) <
			Math.abs(closest.distance - activeDistance)
				? point
				: closest,
		);
	}, [data, activeDistance]);

	// Helper functions for mouse handling
	const findClosestElevationPoint = useCallback(
		(distance: number) => {
			return data.reduce((closest, point) =>
				Math.abs(point.distance - distance) <
				Math.abs(closest.distance - distance)
					? point
					: closest,
			);
		},
		[data],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			const chartSurface = e.currentTarget.querySelector(".recharts-surface");
			if (!chartSurface) {
				// Fallback to wrapper div
				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const percentage = x / rect.width;
				const distance = percentage * maxDistance;
				requestAnimationFrame(() => setActiveDistance(distance));
				return;
			}

			const surfaceRect = chartSurface.getBoundingClientRect();
			const x = e.clientX - surfaceRect.left;
			const percentage = Math.max(0, Math.min(1, x / surfaceRect.width));
			const distance = percentage * maxDistance;

			requestAnimationFrame(() => {
				setActiveDistance(distance);

				const elevationPoint = findClosestElevationPoint(distance);
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
			});
		},
		[maxDistance, surfaceSegments, findClosestElevationPoint],
	);

	const handleMouseLeave = useCallback(() => {
		setActiveDistance(null);
		setTooltip(null);
	}, []);

	if (data.length === 0) {
		return (
			<div className="flex h-40 items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed text-muted-foreground">
				Start plotting a route to see elevation profile
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Stats */}
			<div className="flex items-center justify-center gap-6 text-sm">
				<div className="flex items-center gap-1.5 text-green-600">
					<TrendingUp size={16} />
					<span className="font-medium">{formatElevation(elevationGain)}</span>
					<span className="text-muted-foreground">climbing</span>
				</div>
				<div className="flex items-center gap-1.5 text-red-600">
					<TrendingDown size={16} />
					<span className="font-medium">{formatElevation(elevationLoss)}</span>
					<span className="text-muted-foreground">descending</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Route size={16} />
					<span className="font-medium">{formatDistance(routeDistance)}</span>
					<span className="text-muted-foreground">distance</span>
				</div>
			</div>

			{/* Hover tracking area for both chart and surface bar */}
			<div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
				{/* Chart */}
				<ChartContainer config={chartConfig} className="aspect-auto h-40">
					<AreaChart data={data}>
						<defs>
							<linearGradient
								id="elevationGradient"
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
								<stop
									offset="0%"
									stopColor="var(--color-route)"
									stopOpacity={0.8}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-route)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<XAxis
							dataKey="distance"
							tickFormatter={(value) => formatDistance(Number(value) * 1000)}
							axisLine={true}
							tickLine={true}
							tick={{ fontSize: 12 }}
							tickMargin={8}
							minTickGap={32}
							tickCount={5}
							interval="preserveStartEnd"
						/>
						<YAxis
							domain={["dataMin - 20", "dataMax + 20"]}
							axisLine={false}
							tickLine={false}
							tick={false}
							width={0}
						/>

						<Area
							type="linear"
							dataKey="elevation"
							stroke="var(--color-route)"
							strokeWidth={2}
							animationDuration={600}
							fill="url(#elevationGradient)"
							dot={false}
							activeDot={false}
						/>

						{/* Active point indicator */}
						{activePoint && (
							<ReferenceDot
								x={activePoint.distance}
								y={activePoint.elevation}
								r={4}
								fill="var(--color-route)"
								stroke="var(--color-background)"
								strokeWidth={2}
								isFront={true}
							/>
						)}
					</AreaChart>
				</ChartContainer>

				<SurfaceBar activeDistance={activeDistance} />
			</div>

			<SurfaceLegend />

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
		</div>
	);
};
