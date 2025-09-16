"use client";

import { Calendar, Copy, Mountain, Route, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/dialog";
import { Separator } from "~/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/tooltip";
import { useMap } from "~/contexts/mapContext";
import { api } from "~/trpc/react";

type MyRoutesDialogProps = {
	children: ReactNode;
};

export const MyRoutesDialog = ({ children }: MyRoutesDialogProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const { loadRoute, duplicateRoute } = useMap();

	// Fetch user's saved routes
	const {
		data: routes,
		isLoading,
		refetch,
	} = api.routePlanner.getRoutes.useQuery(undefined, {
		enabled: isOpen, // Only fetch when dialog is open
	});

	// Delete route mutation
	const deleteRoute = api.routePlanner.deleteRoute.useMutation({
		onSuccess: () => {
			toast.success("Route deleted successfully!");
			refetch(); // Refresh the routes list
		},
		onError: (error) => {
			toast.error("Failed to delete route", {
				description: error.message,
			});
		},
	});

	const handleLoadRoute = (route: NonNullable<typeof routes>[0]) => {
		// Parse the route data and load it
		const routeData = route.routeData as Array<{
			lat: number;
			lng: number;
			type: "start" | "waypoint" | "end";
		}>;

		loadRoute(route.id, routeData);
		setIsOpen(false);
	};

	const handleDeleteRoute = (routeId: number) => {
		deleteRoute.mutate({ id: routeId });
	};

	const handleDuplicateRoute = (route: NonNullable<typeof routes>[0]) => {
		// Parse the route data and duplicate it (without routeId)
		const routeData = route.routeData as Array<{
			lat: number;
			lng: number;
			type: "start" | "waypoint" | "end";
		}>;

		duplicateRoute(routeData);
		setIsOpen(false);
		toast.success("Route duplicated! You can now edit and save it as a new route.");
	};

	const formatDistance = (distanceInMeters: number) => {
		if (distanceInMeters < 1000) {
			return `${Math.round(distanceInMeters)}m`;
		}
		return `${(distanceInMeters / 1000).toFixed(1)}km`;
	};

	const formatElevation = (elevationInMeters: number) => {
		return `${Math.round(elevationInMeters)}m`;
	};

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(date);
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>My Routes</DialogTitle>
					<DialogDescription>
						Load, manage, or delete your saved routes.
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-96 overflow-y-auto">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-muted-foreground">Loading routes...</div>
						</div>
					) : routes && routes.length > 0 ? (
						<div className="space-y-2">
							{routes.map((route) => (
								<div
									key={route.id}
									className="cursor-pointer flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
									onClick={() => handleLoadRoute(route)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleLoadRoute(route);
										}
									}}
									tabIndex={0}
									role="button"
									aria-label={`Load route: ${route.title}`}
								>
									<div className="min-w-0 flex-1">
										<h3 className="truncate font-medium text-sm">
											{route.title}
										</h3>
										<div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
											<div className="flex items-center gap-1">
												<Route size={12} />
												<span>{formatDistance(route.distance)}</span>
											</div>
											<div className="flex items-center gap-1">
												<Mountain size={12} />
												<span>{formatElevation(route.elevationGain)}</span>
											</div>
											<div className="flex items-center gap-1">
												<Calendar size={12} />
												<span>{formatDate(route.createdAt)}</span>
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														handleDuplicateRoute(route);
													}}
												>
													<Copy size={14} />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Duplicate route</TooltipContent>
										</Tooltip>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteRoute(route.id);
													}}
													disabled={deleteRoute.isPending}
													className="text-destructive hover:text-destructive"
												>
													<Trash2 size={14} />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Delete route</TooltipContent>
										</Tooltip>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<Route size={48} className="mb-2 text-muted-foreground" />
							<div className="text-muted-foreground text-sm">
								No saved routes found
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								Create and save your first route to see it here
							</div>
						</div>
					)}
				</div>

				{routes && routes.length > 0 && (
					<>
						<Separator />
						<div className="flex justify-end">
							<Button
								variant="outline"
								onClick={() => setIsOpen(false)}
							>
								Cancel
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};