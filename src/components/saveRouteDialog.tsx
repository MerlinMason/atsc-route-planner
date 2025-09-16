"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/form";
import { Input } from "~/components/input";
import { useMap } from "~/contexts/mapContext";
import { api } from "~/trpc/react";

// Form schema for saving routes
const saveRouteSchema = z.object({
	title: z.string().min(1, "Route title is required").max(75, "Title too long"),
});

type SaveRouteForm = z.infer<typeof saveRouteSchema>;

type SaveRouteDialogProps = {
	children: ReactNode;
};

export const SaveRouteDialog = ({ children }: SaveRouteDialogProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const { routePoints, elevationGain, routeDistance, routeId } = useMap();

	// Check if we're editing an existing route
	const isEditing = routeId !== null;

	// Fetch current route data when editing
	const { data: currentRoute } = api.routePlanner.getRoute.useQuery(
		{ id: routeId ?? 0 }, // Use 0 as fallback, but query won't run when not editing
		{
			enabled: isEditing && isOpen && routeId !== null, // Only fetch when editing and dialog is open
		},
	);

	// Form setup
	const form = useForm<SaveRouteForm>({
		resolver: zodResolver(saveRouteSchema),
		defaultValues: {
			title: "",
		},
	});

	// Update form with current route title when data loads
	useEffect(() => {
		if (currentRoute && isEditing) {
			form.setValue("title", currentRoute.title);
		} else if (!isEditing) {
			form.setValue("title", "");
		}
	}, [currentRoute, isEditing, form]);

	// Get tRPC utils for cache invalidation
	const utils = api.useUtils();

	// tRPC mutation for saving routes
	const saveRoute = api.routePlanner.saveRoute.useMutation({
		onSuccess: () => {
			toast.success(`Route ${isEditing ? "updated" : "saved"} successfully!`);
			setIsOpen(false);
			form.reset();
			// Invalidate routes cache to refresh the MyRoutesDialog
			utils.routePlanner.getRoutes.invalidate();
		},
		onError: (error) => {
			toast.error(`Failed to ${isEditing ? "update" : "save"} route`, {
				description: error.message,
			});
		},
	});

	const onSaveRoute = (data: SaveRouteForm) => {
		if (routePoints.length < 2) {
			toast.error("Cannot save route", {
				description: "Need at least 2 points to save a route",
			});
			return;
		}

		saveRoute.mutate({
			id: routeId || undefined, // Pass routeId if editing
			title: data.title,
			routeData: routePoints,
			distance: routeDistance,
			elevationGain,
		});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEditing ? "Update Route" : "Save Route"}</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update your route with a new name or keep the current one."
							: "Give your route a name to save it to your account."}
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSaveRoute)} className="space-y-4">
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Route Name</FormLabel>
									<FormControl>
										<Input placeholder="Awesome adventure" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<DialogClose asChild>
								<Button variant="outline" type="button">
									Cancel
								</Button>
							</DialogClose>
							<Button type="submit" disabled={saveRoute.isPending}>
								{saveRoute.isPending
									? `${isEditing ? "Updating" : "Saving"}...`
									: `${isEditing ? "Update" : "Save"} Route`}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
