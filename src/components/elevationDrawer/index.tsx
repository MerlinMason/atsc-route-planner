"use client";

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "~/components/drawer";
import { useMap } from "~/contexts/mapContext";
import { ElevationChart } from "./elevationChart";

export const ElevationDrawer = () => {
	const { isDrawerOpen, toggleDrawer } = useMap();

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
					<ElevationChart />
				</div>
			</DrawerContent>
		</Drawer>
	);
};
