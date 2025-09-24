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
				</DialogHeader>
				<div className="space-y-4 text-sm">
					<p>
						Built for cyclists who want to discover epic off-road adventures!
						Plan routes with detailed elevation profiles and surface analysis to
						help you tackle any terrain. 🚴‍♂️
					</p>

					<p>
						This is a <strong>completely free</strong> passion project created
						by members of the All Terrain Social Club.
					</p>

					<div className="space-y-2">
						<h4 className="font-medium">The team:</h4>
						<div className="space-y-1">
							<div>
								<strong>Merlin Mason</strong> (Engineering) -{" "}
								<a
									href="https://www.linkedin.com/in/merlin-mason/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:underline"
								>
									LinkedIn
								</a>
							</div>
							<div>
								<strong>Alex van Rensburgh</strong> (Design / UX) -{" "}
								<a
									href="https://www.linkedin.com/in/oolex/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:underline"
								>
									LinkedIn
								</a>
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<p>
							We're both proud members of the{" "}
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
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
