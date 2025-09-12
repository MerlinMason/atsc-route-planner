import { HydrateClient } from "~/trpc/server";

import { RouteMap } from "~/components/routeMap";

export default async function Home() {
	return (
		<HydrateClient>
			<main className="h-screen w-full">
				<RouteMap className="h-full" />
			</main>
		</HydrateClient>
	);
}
