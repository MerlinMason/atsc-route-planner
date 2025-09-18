"use client";

import { Route, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "~/components/chart";
import type { ChartConfig } from "~/components/chart";
import { useMap } from "~/contexts/mapContext";
import { formatDistance, formatElevation } from "~/lib/route-utils";
import { getSurfaceAtDistance, processSurfaceData } from "~/lib/surface-utils";
import { RouteTooltip } from "./routeTooltip";
import { SurfaceBar } from "./surfaceBar";
import { SurfaceLegend } from "./surfaceLegend";

const chartConfig = {
	elevation: {
		label: "Elevation",
		color: "var(--color-route)",
	},
} satisfies ChartConfig;

export const ElevationChart = () => {
	const {
		elevationData: data,
		elevationGain,
		elevationLoss,
		surfaceData,
		routeDistance,
	} = useMap();
	// Process surface data into segments
	const surfaceSegments = processSurfaceData(surfaceData, routeDistance / 1000);
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

			{/* Chart */}
			<ChartContainer config={chartConfig} className="aspect-auto h-40">
				<AreaChart data={data}>
					<defs>
						<linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
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

					<ChartTooltip
						content={({ active, payload, coordinate }) => {
							if (!active || !payload?.length || !coordinate) return null;

							const data = payload[0]?.payload;
							if (!data) return null;

							// Find surface at this distance
							const surface = getSurfaceAtDistance(
								surfaceSegments,
								data.distance,
							);

							// Convert chart coordinates to viewport coordinates
							const chartElement = document.querySelector(".recharts-wrapper");
							const rect = chartElement?.getBoundingClientRect();

							return (
								<RouteTooltip
									x={(rect?.left ?? 0) + (coordinate.x ?? 0)}
									y={(rect?.top ?? 0) + (coordinate.y ?? 0)}
									distance={data.distance}
									elevation={data.elevation}
									surface={
										surface
											? {
													formattedSurface: surface.formattedSurface,
													color: surface.color,
												}
											: undefined
									}
								/>
							);
						}}
					/>

					<Area
						type="linear"
						dataKey="elevation"
						stroke="var(--color-route)"
						strokeWidth={2}
						animationDuration={600}
						fill="url(#elevationGradient)"
						dot={false}
						activeDot={{
							r: 4,
							fill: "var(--color-route)",
							stroke: "var(--color-background)",
							strokeWidth: 2,
						}}
					/>
				</AreaChart>
			</ChartContainer>

			<SurfaceBar />

			<SurfaceLegend />
		</div>
	);
};
