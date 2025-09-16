"use client";

import { Route, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "~/components/chart";
import type { ChartConfig } from "~/components/chart";
import { formatDistance, formatElevation } from "~/lib/route-utils";

type ElevationChartProps = {
	data: Array<{
		distance: number;
		elevation: number;
	}>;
	elevationGain: number;
	elevationLoss: number;
};

const chartConfig = {
	elevation: {
		label: "Elevation",
		color: "var(--color-route)",
	},
} satisfies ChartConfig;

export const ElevationChart = ({
	data,
	elevationGain,
	elevationLoss,
}: ElevationChartProps) => {
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
					<span className="font-medium">
						{formatDistance((data.at(-1)?.distance ?? 0) * 1000)}
					</span>
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
						tickFormatter={(value) => formatElevation(value)}
						axisLine={true}
						tickMargin={8}
						minTickGap={15}
						tickLine={true}
						tick={{ fontSize: 12 }}
					/>
					<ChartTooltip
						content={({ active, payload }) => {
							if (!active || !payload?.length) return null;

							const data = payload[0]?.payload;
							if (!data) return null;

							return (
								<div className="rounded-lg border bg-background p-3 text-sm shadow-lg">
									<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
										<span className="font-semibold">Elevation:</span>
										<span className="font-mono">
											{formatElevation(data.elevation)}
										</span>
										<span className="font-semibold">Distance:</span>
										<span className="font-mono">
											{formatDistance(Number(data.distance) * 1000)}
										</span>
									</div>
								</div>
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
		</div>
	);
};
