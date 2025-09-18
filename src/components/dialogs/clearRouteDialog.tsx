import type { ReactNode } from "react";
import { Button } from "~/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/dialog";
import { useMap } from "~/contexts/mapContext";

type ClearRouteDialogProps = {
	children: ReactNode;
};

export const ClearRouteDialog = ({ children }: ClearRouteDialogProps) => {
	const { clearRoute } = useMap();

	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Clear Route</DialogTitle>
					<DialogDescription>
						Are you sure you want to clear the current route? Any unsaved
						changes will be lost.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<DialogClose asChild>
						<Button variant="destructive" onClick={clearRoute}>
							Clear Route
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
