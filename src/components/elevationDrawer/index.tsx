"use client";

import { SimpleDrawer } from "~/components/simpleDrawer";
import { useMap } from "~/contexts/mapContext";
import { ElevationChart } from "./elevationChart";

export const ElevationDrawer = () => {
	const { isDrawerOpen } = useMap();

	return (
		<SimpleDrawer open={isDrawerOpen} className="p-4">
			<ElevationChart />
		</SimpleDrawer>
	);
};
