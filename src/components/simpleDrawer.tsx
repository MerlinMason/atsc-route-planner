"use client";

import { cn } from "~/lib/utils";

type SimpleDrawerProps = {
	open: boolean;
	children: React.ReactNode;
	className?: string;
};

export const SimpleDrawer = ({
	open,
	children,
	className,
}: SimpleDrawerProps) => {
	return (
		<div
			className={cn(
				"fixed right-4 bottom-4 left-4 z-40 max-h-[80vh] overflow-y-auto rounded-lg border-background border-t bg-background/70 backdrop-blur-sm transition-transform duration-300 ease-in-out",
				"translate-y-0 transform",
				{ "translate-y-full": !open },
				className,
			)}
		>
			{children}
		</div>
	);
};
