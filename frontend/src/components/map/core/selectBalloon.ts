// src/components/map/core/selectBalloon.ts

import maplibregl, { Map } from "maplibre-gl";
import type { Snapshot } from "../../../domain/balloons/types";
import { pickSnapshotForAge } from "../../../domain/balloons/snapshotUtils";
import { buildPopupHtml } from "./popup";

// Used to distinguish between programmatic popup close vs. user clicking the "X"
let programmaticClose = false;

// Use `any` here to simplify ref types
type Params = {
    id: string;
    snapshotsRef: any;
    mapRef: any;
    popupRef: any;
    selectedIdRef: any;
    selectedIdsRef: any;
    selectedAgeHours: number;
    onUpdate: () => void;
};

export function selectBalloon({
                                  id,
                                  snapshotsRef,
                                  mapRef,
                                  popupRef,
                                  selectedIdRef,
                                  selectedIdsRef,
                                  selectedAgeHours,
                                  onUpdate,
                              }: Params) {
    const snapshots: Snapshot[] | null = snapshotsRef.current;
    const map: Map | null = mapRef.current;

    if (!snapshots || !snapshots.length || !map) {
        console.warn("selectBalloon called but map or snapshots not ready:", id);
        return;
    }

    const refSnap = pickSnapshotForAge(snapshots, selectedAgeHours);
    const item = refSnap.items.find((i) => i.id === id);

    const selectedSet: Set<string> = selectedIdsRef.current ?? new Set<string>();

    // Balloon not found at the current hour → treat as deselect
    if (!item) {
        console.warn("Balloon id not found at current hour:", id);
        selectedSet.delete(id);
        selectedIdsRef.current = selectedSet;

        if (selectedIdRef.current === id) {
            selectedIdRef.current = null;
        }
        if (popupRef.current) {
            programmaticClose = true;
            popupRef.current.remove();
            programmaticClose = false;
            popupRef.current = null;
        }
        onUpdate();
        return;
    }

    // Second click on the same balloon → deselect it
    if (selectedSet.has(id)) {
        selectedSet.delete(id);
        selectedIdsRef.current = selectedSet;

        if (selectedIdRef.current === id) {
            selectedIdRef.current = null;
        }
        if (popupRef.current) {
            programmaticClose = true;
            popupRef.current.remove();
            programmaticClose = false;
            popupRef.current = null;
        }

        console.log("[multi-select] deselect", id, "=>", Array.from(selectedSet));
        onUpdate();
        return;
    }

    // Newly selected balloon → add it to the set
    selectedSet.add(id);
    selectedIdsRef.current = selectedSet;
    selectedIdRef.current = id;

    // Close old popup (but without triggering "deselect" logic)
    if (popupRef.current) {
        programmaticClose = true;
        popupRef.current.remove();
        programmaticClose = false;
        popupRef.current = null;
    }

    const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 8,
    })
        .setLngLat([item.lon, item.lat])
        .setHTML(buildPopupHtml(id, item.lon, item.lat, item.altKm))
        .addTo(map);

    popup.on("close", () => {
        // If close was triggered programmatically, ignore it
        if (programmaticClose) {
            return;
        }

        const s: Set<string> = selectedIdsRef.current ?? new Set<string>();
        s.delete(id);
        selectedIdsRef.current = s;

        if (selectedIdRef.current === id) {
            selectedIdRef.current = null;
        }

        console.log("[multi-select] popup close, deselect", id, "=>", Array.from(s));
        onUpdate();
    });

    popupRef.current = popup;

    console.log("[multi-select] select", id, "=>", Array.from(selectedSet));

    onUpdate();
}
