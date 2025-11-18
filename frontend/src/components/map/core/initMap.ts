// src/components/map/core/initMap.ts

import maplibregl, { Map } from "maplibre-gl";
import { EMPTY_FC } from "../../../domain/balloons/types";

export function initMap(): Map {
    const map = new maplibregl.Map({
        container: "map",
        style: "https://demotiles.maplibre.org/style.json",
        center: [0, 20],
        zoom: 2,
    });

    // Sometimes style JSON loads, but internal style resources are not ready yet.
    // Use both isStyleLoaded and 'styledata' events to guarantee proper initialization.
    function safeInitializeLayers() {
        if (!map.isStyleLoaded()) return;

        // Already initialized — prevent adding sources/layers twice
        if (map.getSource("tracks") && map.getSource("latest")) {
            return; // Already initialized
        }

        console.log("[initMap] style loaded, initializing sources/layers");

        // ---------- Tracks source / layer ----------
        if (!map.getSource("tracks")) {
            map.addSource("tracks", {
                type: "geojson",
                data: EMPTY_FC,
            });
        }

        if (!map.getLayer("tracks-line")) {
            map.addLayer({
                id: "tracks-line",
                type: "line",
                source: "tracks",
                paint: {
                    "line-width": 2,
                    "line-color": "#1e88e5",
                    "line-opacity": 0.9,
                },
            });
        }

        // ---------- Latest balloon source / layer ----------
        if (!map.getSource("latest")) {
            map.addSource("latest", {
                type: "geojson",
                data: EMPTY_FC,
            });
        }

        if (!map.getLayer("latest-circle")) {
            map.addLayer({
                id: "latest-circle",
                type: "circle",
                source: "latest",
                paint: {
                    "circle-radius": 5,
                    "circle-color": [
                        "case",
                        ["==", ["get", "selected"], 1],
                        "#e53935", // selected → red
                        "#1e88e5", // normal → blue
                    ],
                    "circle-stroke-color": "#fff",
                    "circle-stroke-width": 1,
                },
            });
        }
    }

    // Event 1: style fully loaded
    map.on("load", () => {
        console.log("[initMap] map load event fired");
        safeInitializeLayers();
    });

    // Event 2: style JSON parsed, but sub-resources may still be loading
    // Some map providers require adding sources after 'styledata' or errors occur.
    map.on("styledata", () => {
        safeInitializeLayers();
    });

    return map;
}
