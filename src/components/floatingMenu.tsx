"use client";

import { Download, LogOut, Redo, Undo, User } from "lucide-react";
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

	return (
		<div className="fixed top-4 right-4 z-50">
			<TooltipProvider>
				<div className="flex items-center gap-2 rounded-lg border bg-white/95 p-2 shadow-lg backdrop-blur-sm">
					{/* Map Actions - Always Visible */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => {
									// TODO: Implement undo functionality
									console.log("Undo clicked");
								}}
							>
								<Undo size={16} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>Undo last action</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => {
									// TODO: Implement redo functionality
									console.log("Redo clicked");
								}}
							>
								<Redo size={16} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>Redo last action</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => {
									// TODO: Implement GPX export functionality
									console.log("Export GPX clicked");
								}}
							>
								<Download size={16} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<p>Export route as GPX</p>
						</TooltipContent>
					</Tooltip>

					{/* Separator */}
					<Separator orientation="vertical" className="!h-7" />

					{/* User Profile Menu */}
					<Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-full"
							>
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
								{/* User Info Section */}
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

								{/* Auth Section */}
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
			</TooltipProvider>
		</div>
	);
};
