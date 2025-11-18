// src/components/map/useJetstreamMap.ts

import { useEffect, useRef } from "react";
import maplibregl, { Map } from "maplibre-gl";

import type { BalloonFilter, Snapshot } from "../../domain/balloons/types";

import { initMap } from "./core/initMap";
import { attachEventHandlers } from "./core/attachEventHandlers";
import { updateLayers } from "./core/updateLayers";
import { selectBalloon as coreSelectBalloon } from "./core/selectBalloon";

import { fetchSnapshots } from "../../api/fetchSnapshots";

type UseJetstreamMapParams = {
    filter: BalloonFilter;
    showTracks: boolean;
    selectedAgeHours: number;
    resetVersion: number;
};

export function useJetstreamMap({
                                    filter,
                                    showTracks,
                                    selectedAgeHours,
                                    resetVersion,
                                }: UseJetstreamMapParams) {
    const mapRef = useRef<Map | null>(null);
    const snapshotsRef = useRef<Snapshot[] | null>(null);

    const selectedIdRef = useRef<string | null>(null);
    const selectedIdsRef = useRef<Set<string>>(new Set());
    const popupRef = useRef<maplibregl.Popup | null>(null);

    // 1. Initialize map → after load, fetch 24h data & attach event handlers
    useEffect(() => {
        const map = initMap();
        mapRef.current = map;

        const onLoad = () => {
            fetchSnapshots().then((snaps) => {
                snapshotsRef.current = snaps;

                // Initial rendering
                updateLayers({
                    map,
                    filter,
                    showTracks,
                    selectedAgeHours,
                    snapshots: snaps,
                    selectedIdRef,
                    selectedIdsRef,
                    popupRef,
                });

                // Bind hover + click events
                attachEventHandlers({
                    map,
                    selectBalloon: (id: string) => {
                        coreSelectBalloon({
                            id,
                            mapRef,
                            snapshotsRef,
                            popupRef,
                            selectedIdRef,
                            selectedIdsRef,
                            selectedAgeHours,
                            onUpdate: () => {
                                if (!mapRef.current || !snapshotsRef.current) return;
                                updateLayers({
                                    map: mapRef.current!,
                                    filter,
                                    showTracks,
                                    selectedAgeHours,
                                    snapshots: snapshotsRef.current!,
                                    selectedIdRef,
                                    selectedIdsRef,
                                    popupRef,
                                });
                            },
                        });
                    },
                });
            });
        };

        map.on("load", onLoad);

        return () => {
            map.off("load", onLoad);

            if (popupRef.current) {
                popupRef.current.remove();
                popupRef.current = null;
            }

            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            snapshotsRef.current = null;
            selectedIdRef.current = null;
            selectedIdsRef.current = new Set();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Re-render whenever filter / showTracks / selectedAgeHours change
    useEffect(() => {
        if (!mapRef.current || !snapshotsRef.current) return;

        updateLayers({
            map: mapRef.current!,
            filter,
            showTracks,
            selectedAgeHours,
            snapshots: snapshotsRef.current!,
            selectedIdRef,
            selectedIdsRef,
            popupRef,
        });
    }, [filter, showTracks, selectedAgeHours]);

    // 3. When resetVersion changes → clear selections & popup, then re-render
    useEffect(() => {
        if (!mapRef.current || !snapshotsRef.current) return;

        selectedIdRef.current = null;
        selectedIdsRef.current = new Set();

        if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
        }

        updateLayers({
            map: mapRef.current!,
            filter,
            showTracks,
            selectedAgeHours,
            snapshots: snapshotsRef.current!,
            selectedIdRef,
            selectedIdsRef,
            popupRef,
        });
    }, [resetVersion]);

    // 4. When filter.onlyId changes → auto-select / focus the corresponding balloon
    // ❗ Note: this does NOT clear existing selections, and does NOT depend on
    //         selectedAgeHours or showTracks → dragging the time slider does NOT reset selection.
    useEffect(() => {
        if (!filter.onlyId) return;
        if (!mapRef.current || !snapshotsRef.current) return;

        // Simulate “clicking” a balloon: select & focus it by ID
        coreSelectBalloon({
            id: filter.onlyId,
            mapRef,
            snapshotsRef,
            popupRef,
            selectedIdRef,
            selectedIdsRef,
            selectedAgeHours,
            onUpdate: () => {
                if (!mapRef.current || !snapshotsRef.current) return;
                updateLayers({
                    map: mapRef.current!,
                    filter,
                    showTracks,
                    selectedAgeHours,
                    snapshots: snapshotsRef.current!,
                    selectedIdRef,
                    selectedIdsRef,
                    popupRef,
                });
            },
        });
        // Depend only on filter.onlyId → dragging the time slider won't re-trigger this effect
    }, [filter.onlyId]);
}
