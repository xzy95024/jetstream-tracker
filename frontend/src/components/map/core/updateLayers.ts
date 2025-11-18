// src/components/map/core/updateLayers.ts

import type { MutableRefObject } from "react";
import maplibregl, { Map, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";

import type { BalloonFilter, Snapshot } from "../../../domain/balloons/types";
import { EMPTY_FC } from "../../../domain/balloons/types";
import {
    buildTracksAndLatestByFilter,
    buildTrackForId,
    buildTracksForIds,
} from "../../../domain/balloons/tracks";
import { pickSnapshotForAge } from "../../../domain/balloons/snapshotUtils";
import { buildPopupHtml } from "./popup";

type UpdateParams = {
    map: Map | null;
    filter: BalloonFilter;
    showTracks: boolean;
    selectedAgeHours: number;
    snapshots: Snapshot[] | null;
    selectedIdRef: MutableRefObject<string | null>;
    selectedIdsRef: MutableRefObject<Set<string>>;
    popupRef: MutableRefObject<maplibregl.Popup | null>;
};

export function updateLayers({
                                 map,
                                 filter,
                                 showTracks,
                                 selectedAgeHours,
                                 snapshots,
                                 selectedIdRef,
                                 selectedIdsRef,
                                 popupRef,
                             }: UpdateParams) {
    // 0. Basic guard
    if (!map || !snapshots || snapshots.length === 0) {
        return;
    }

    // 1. Retrieve GeoJSON sources (we ensure this runs after the map is fully loaded)
    const latestSource = map.getSource("latest") as GeoJSONSource | undefined;
    const tracksSource = map.getSource("tracks") as GeoJSONSource | undefined;

    if (!latestSource || !tracksSource) {
        // Sources not added yet → skip rendering
        return;
    }

    // 2. Snapshot corresponding to the current time slider (with fallback)
    const refSnap = pickSnapshotForAge(snapshots, selectedAgeHours);

    // Ensure the multi-select set exists
    if (!selectedIdsRef.current) {
        selectedIdsRef.current = new Set<string>();
    }
    const selectedIdsSet = selectedIdsRef.current;
    const selectedId = selectedIdRef.current;

    // 3. Build global tracks + latest positions based on the filter
    const { tracks: globalTracks, latest } = buildTracksAndLatestByFilter(
        snapshots,
        filter,
        refSnap,
        selectedId
    );

    // 4. Mark selected IDs with selected=1 so circle layer turns them red
    const latestWithSelection: FeatureCollection = {
        ...latest,
        features: latest.features.map((feat: any) => {
            const id = feat.properties?.id as string | undefined;
            const isSelected = !!(id && selectedIdsSet.has(id));
            return {
                ...feat,
                properties: {
                    ...feat.properties,
                    selected: isSelected ? 1 : 0,
                },
            };
        }),
    };

    latestSource.setData(latestWithSelection);

    // 5. Determine which set of tracks to render
    let tracksFC: FeatureCollection<LineString> =
        EMPTY_FC as FeatureCollection<LineString>;

    if (selectedIdsSet.size > 0) {
        tracksFC = buildTracksForIds(snapshots, selectedIdsSet);
    } else if (selectedId) {
        tracksFC = buildTrackForId(snapshots, selectedId);
    } else if (showTracks) {
        tracksFC = globalTracks as FeatureCollection<LineString>;
    } else {
        tracksFC = EMPTY_FC as FeatureCollection<LineString>;
    }

    tracksSource.setData(tracksFC);

    // 6. Update popup position & content as balloon moves with the time slider
    if (popupRef.current && selectedId) {
        const item = refSnap.items.find((it) => it.id === selectedId);
        if (item) {
            popupRef.current
                .setLngLat([item.lon, item.lat])
                .setHTML(buildPopupHtml(selectedId, item.lon, item.lat, item.altKm));
        } else {
            // Balloon disappeared at current hour → remove popup & deselect
            popupRef.current.remove();
            popupRef.current = null;
            selectedIdRef.current = null;
            selectedIdsSet.delete(selectedId);
        }
    }
}
