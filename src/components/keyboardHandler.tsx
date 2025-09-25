"use client";

import { useEffect } from "react";
import { useMap } from "~/contexts/mapContext";

export const KeyboardHandler = () => {
	const { undo, redo, canUndo, canRedo } = useMap();

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check for Cmd (Meta) key on Mac or Ctrl key on Windows/Linux
			const isMetaOrCtrl = event.metaKey || event.ctrlKey;

			if (!isMetaOrCtrl) return;

			// Cmd/Ctrl + Z for undo
			if (event.key === "z" && !event.shiftKey && canUndo) {
				event.preventDefault();
				undo();
				return;
			}

			// Cmd/Ctrl + Shift + Z for redo
			if (event.key === "z" && event.shiftKey && canRedo) {
				event.preventDefault();
				redo();
				return;
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [undo, redo, canUndo, canRedo]);

	return null;
};
