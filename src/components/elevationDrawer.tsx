"use client";

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "~/components/drawer";
import { useMap } from "~/contexts/mapContext";

export const ElevationDrawer = () => {
	const { isDrawerOpen, toggleDrawer } = useMap();

	return (
		<Drawer open={isDrawerOpen} onOpenChange={toggleDrawer}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Elevation Profile</DrawerTitle>
					<DrawerDescription>
						View the elevation changes along your route
					</DrawerDescription>
				</DrawerHeader>

				{/* Empty content for now */}
				<div className="flex-1 p-4">
					<div className="flex h-48 items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed text-muted-foreground">
						Elevation chart will appear here
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
};
