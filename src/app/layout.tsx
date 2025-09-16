import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "~/components/tooltip";
import { auth } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "ATSC Route Planner",
	description: "All Terrain Route Planner",
	icons: [{ rel: "icon", url: "/favicon.png" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await auth();

	return (
		<html lang="en" className={`${geist.variable}`}>
			<body>
				<TooltipProvider>
					<TRPCReactProvider>
						{children}
						<Toaster />
					</TRPCReactProvider>
				</TooltipProvider>
			</body>
		</html>
	);
}
