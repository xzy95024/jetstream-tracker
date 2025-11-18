// src/components/map/JetstreamMap.tsx

import { useEffect, useRef } from "react";
import maplibregl, { Map } from "maplibre-gl";

import type { BalloonFilter, Snapshot } from "../../domain/balloons/types";

import { initMap } from "./core/initMap";
import { attachEventHandlers } from "./core/attachEventHandlers";
import { updateLayers } from "./core/updateLayers";
import { selectBalloon as coreSelectBalloon } from "./core/selectBalloon";

import { fetchSnapshots } from "../../api/fetchSnapshots";

import WindParticlesCanvas from "../wind/WindParticlesCanvas";

type Props = {
    filter: BalloonFilter;
    showTracks: boolean;
    selectedAgeHours: number; // 0 = latest
    resetVersion: number;
    showWindField?: boolean;
};

export default function JetstreamMap({
                                         filter,
                                         showTracks,
                                         selectedAgeHours,
                                         resetVersion,
                                         showWindField = false,
                                     }: Props) {
    const mapRef = useRef<Map | null>(null);
    const snapshotsRef = useRef<Snapshot[] | null>(null);

    const selectedIdRef = useRef<string | null>(null);
    const selectedIdsRef = useRef<Set<string>>(new Set());
    const popupRef = useRef<maplibregl.Popup | null>(null);

    // 1. Initialize map → after map load, fetch snapshots + attach handlers
    useEffect(() => {
        const map = initMap();
        mapRef.current = map;

        const onLoad = () => {
            fetchSnapshots().then((snaps) => {
                snapshotsRef.current = snaps;

                // Initial render
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

    // 2. When filter / showTracks / selectedAgeHours change → re-render
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

    // 3. When resetVersion changes → clear selections & popup → re-render
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

    // 4. When filter.onlyId changes → simulate a click on that balloon’s ID
    //    Only selects this ID; does not clear other selected balloons.
    useEffect(() => {
        if (!filter.onlyId) return;
        if (!mapRef.current || !snapshotsRef.current) return;

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
        // Depend only on onlyId — sliding time does not reset the selection
    }, [filter.onlyId]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div id="map" style={{ width: "100%", height: "100%" }} />
            {showWindField && (
                <WindParticlesCanvas
                    mapRef={mapRef}
                    selectedAgeHours={selectedAgeHours}
                    enabled={showWindField}
                />
            )}
        </div>
    );
}
