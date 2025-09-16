"use client";

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "~/components/drawer";
import { ElevationChart } from "~/components/elevationChart";
import { useMap } from "~/contexts/mapContext";

export const ElevationDrawer = () => {
	const {
		isDrawerOpen,
		toggleDrawer,
		elevationData,
		elevationGain,
		elevationLoss,
	} = useMap();

	return (
		<Drawer open={isDrawerOpen} onOpenChange={toggleDrawer} modal={false}>
			<DrawerContent
				hasOverlay={false}
				className="bg-background/70 backdrop-blur-sm"
			>
				<DrawerHeader>
					<DrawerTitle>Elevation Profile</DrawerTitle>
					<DrawerDescription className="sr-only">
						Your route&apos;s elevation profile
					</DrawerDescription>
				</DrawerHeader>

				<div className="p-4">
					<ElevationChart
						data={elevationData}
						elevationGain={elevationGain}
						elevationLoss={elevationLoss}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
};
