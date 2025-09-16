"use client";

import {
	Download,
	Link as LinkIcon,
	LogOut,
	Mountain,
	Redo,
	Trash2,
	Undo,
	User,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "~/components/popover";
import { Separator } from "~/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/tooltip";
import { useMap } from "~/contexts/mapContext";

type FloatingMenuProps = {
	session: {
		user?: {
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	} | null;
};

export const FloatingMenu = ({ session }: FloatingMenuProps) => {
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
	const {
		canUndo,
		canRedo,
		undo,
		redo,
		exportGpx,
		isExporting,
		isDrawerOpen,
		toggleDrawer,
		shareRoute,
		clearRoute,
		routePoints,
		zoomIn,
		zoomOut,
	} = useMap();

	return (
		<div className="fixed top-4 right-4 z-50">
			<div className="flex items-center gap-2 rounded-lg border bg-background/50 p-2 shadow-lg backdrop-blur-sm">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={!canUndo}
							onClick={undo}
						>
							<Undo size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Undo</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={!canRedo}
							onClick={redo}
						>
							<Redo size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Redo</TooltipContent>
				</Tooltip>

				<Separator orientation="vertical" className="!h-7 bg-foreground/10" />

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={zoomIn}
						>
							<ZoomIn size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Zoom in</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={zoomOut}
						>
							<ZoomOut size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Zoom out</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={() => toggleDrawer(!isDrawerOpen)}
						>
							<Mountain size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{isDrawerOpen ? "Hide elevation profile" : "Show elevation profile"}
					</TooltipContent>
				</Tooltip>

				<Separator orientation="vertical" className="!h-7 bg-foreground/10" />

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={isExporting}
							onClick={exportGpx}
						>
							<Download size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Export route as GPX</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							disabled={routePoints.length < 2}
							onClick={shareRoute}
						>
							<LinkIcon size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Share route URL</TooltipContent>
				</Tooltip>

				<Dialog>
					<DialogTrigger asChild>
						<div>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-8"
										disabled={routePoints.length === 0}
									>
										<Trash2 size={16} />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">Clear route</TooltipContent>
							</Tooltip>
						</div>
					</DialogTrigger>
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

				<Separator orientation="vertical" className="!h-7 bg-foreground/10" />

				{/* User Profile Menu */}
				<Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="icon" className="size-8 rounded-full">
							{session?.user?.image ? (
								<img
									src={session.user.image}
									alt={session.user.name ?? "User"}
									className="size-7 rounded-full object-cover"
								/>
							) : (
								<User size={16} />
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-56 p-2" side="bottom" align="end">
						<div className="space-y-1">
							{session && (
								<>
									<div className="py-1.5 text-sm">
										<div className="font-medium">
											{session.user?.name ?? "User"}
										</div>
										{session.user?.email && (
											<div className="text-muted-foreground text-xs">
												{session.user.email}
											</div>
										)}
									</div>
									<Separator className="my-2" />
								</>
							)}

							<Link
								href={session ? "/api/auth/signout" : "/api/auth/signin"}
								className="block"
								onClick={() => setIsUserMenuOpen(false)}
							>
								<Button
									variant="ghost"
									size="sm"
									className="w-full"
									icon={session ? LogOut : User}
								>
									{session ? "Sign out" : "Sign in"}
								</Button>
							</Link>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
};
