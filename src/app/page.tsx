import { HydrateClient } from "~/trpc/server";
import { auth } from "~/server/auth";
import { RouteMap } from "~/components/routeMap";

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
