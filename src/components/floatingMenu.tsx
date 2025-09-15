"use client";

import { Download, LogOut, Mountain, Redo, Undo, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "~/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/popover";
import { Separator } from "~/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/tooltip";
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
	} = useMap();

	return (
		<div className="fixed top-4 right-4 z-50">
			<div className="flex items-center gap-2 rounded-lg border bg-white/95 p-2 shadow-lg backdrop-blur-sm">
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

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={isDrawerOpen ? "default" : "ghost"}
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

				<Separator orientation="vertical" className="!h-7" />

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

				<Separator orientation="vertical" className="!h-7" />

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
