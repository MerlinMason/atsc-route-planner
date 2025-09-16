import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "~/components/tooltip";
import { TRPCReactProvider } from "~/trpc/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

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
	return (
		<html lang="en" className={`${geist.variable}`}>
			<body>
				<TooltipProvider>
					<TRPCReactProvider>
						{children}
						<Toaster />
					</TRPCReactProvider>
				</TooltipProvider>
				<SpeedInsights />
				<Analytics />
			</body>
		</html>
	);
}
