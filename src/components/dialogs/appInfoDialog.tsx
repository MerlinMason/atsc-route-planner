import type { ReactNode } from "react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/dialog";

type AppInfoDialogProps = {
	children: ReactNode;
};

export const AppInfoDialog = ({ children }: AppInfoDialogProps) => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>About ATSC Route Planner</DialogTitle>
					<DialogDescription className="sr-only">
						Information about the app and the team behind it.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 text-sm">
					<p>
						Built for cyclists who want to discover epic off-road adventures!
						Plan routes with detailed elevation profiles and surface analysis to
						help you tackle any terrain. 🚴‍♂️
					</p>

					<p>
						This is a <strong>completely free</strong> passion project created
						by cyclists, for cyclists.
					</p>

					<div className="space-y-2">
						<h4 className="font-medium">The team:</h4>
						<ul className="space-y-1">
							<li>
								<strong>Alex van Rensburgh</strong> (Design / UX) -{" "}
								<a
									href="https://www.linkedin.com/in/oolex/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:underline"
								>
									LinkedIn
								</a>
							</li>
							<li>
								<strong>Merlin Mason</strong> (Engineering) -{" "}
								<a
									href="https://www.linkedin.com/in/merlin-mason/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:underline"
								>
									LinkedIn
								</a>
							</li>
						</ul>
					</div>

					<div className="space-y-2">
						<p>
							We're both members of{" "}
							<a
								href="https://www.instagram.com/all.terrain.social.club/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 hover:underline"
							>
								All Terrain Social Club
							</a>{" "}
							- a London cycling club that has impeccable vibes and a good sense
							of adventure.
						</p>

						<p>
							This project is <strong>open source</strong>! Check out the code
							or contribute at{" "}
							<a
								href="https://github.com/MerlinMason/atsc-route-planner"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 hover:underline"
							>
								GitHub
							</a>
							. Pull requests welcome! 🎉
						</p>

						<p>Some notes:</p>
						<ul className="list-disc pl-5">
							<li>
								This project relies on several third party services, we're on
								the free tiers for all of these and usage limits apply. If
								something is not working it's possible we've reached a limit.
							</li>
							<li>
								There may be bugs. Please report them on{" "}
								<a
									href="https://github.com/MerlinMason/atsc-route-planner/issues"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:underline"
								>
									GitHub
								</a>
								.
							</li>
						</ul>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
