import { RouteMap } from "~/components/routeMap";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
	const session = await auth();

	return (
		<HydrateClient>
			<main className="h-screen w-full">
				<RouteMap className="h-full" session={session} />
			</main>
		</HydrateClient>
	);
}
