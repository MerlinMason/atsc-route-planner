"use client";

import { RulerDimensionLine, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "~/components/chart";
import type { ChartConfig } from "~/components/chart";

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
		color: "var(--color-chart-1)",
	},
} satisfies ChartConfig;

export const ElevationChart = ({
	data,
	elevationGain,
	elevationLoss,
}: ElevationChartProps) => {
	if (data.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed text-muted-foreground">
				Start plotting a route to see elevation profile
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Stats */}
			<div className="flex items-center justify-center gap-6 text-sm">
				<div className="flex items-center gap-1.5">
					<RulerDimensionLine size={16} />
					<span className="font-medium">
						{data.at(-1)?.distance.toFixed(1) ?? 0}km
					</span>
					<span className="text-muted-foreground">distance</span>
				</div>
				<div className="flex items-center gap-1.5 text-green-600">
					<TrendingUp size={16} />
					<span className="font-medium">{elevationGain}m</span>
					<span className="text-muted-foreground">gain</span>
				</div>
				<div className="flex items-center gap-1.5 text-red-600">
					<TrendingDown size={16} />
					<span className="font-medium">{elevationLoss}m</span>
					<span className="text-muted-foreground">loss</span>
				</div>
			</div>

			{/* Chart */}
			<ChartContainer config={chartConfig} className="aspect-auto h-48">
				<AreaChart data={data}>
					<defs>
						<linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="0%"
								stopColor="var(--color-chart-1)"
								stopOpacity={0.8}
							/>
							<stop
								offset="100%"
								stopColor="var(--color-chart-1)"
								stopOpacity={0.1}
							/>
						</linearGradient>
					</defs>
					<XAxis
						dataKey="distance"
						tickFormatter={(value) => `${Number(value).toFixed(1)}km`}
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
						tickFormatter={(value) => `${value}m`}
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
										<span className="font-mono">{data.elevation}m</span>
										<span className="font-semibold">Distance:</span>
										<span className="font-mono">
											{Number(data.distance).toFixed(1)}km
										</span>
									</div>
								</div>
							);
						}}
					/>
					<Area
						type="linear"
						dataKey="elevation"
						stroke="var(--color-chart-1)"
						strokeWidth={2}
						animationDuration={600}
						fill="url(#elevationGradient)"
						dot={false}
						activeDot={{
							r: 4,
							fill: "var(--color-chart-1)",
							stroke: "var(--color-background)",
							strokeWidth: 2,
						}}
					/>
				</AreaChart>
			</ChartContainer>
		</div>
	);
};
