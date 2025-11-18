// src/components/map/core/attachEventHandlers.ts

import type { Map } from "maplibre-gl";

type Params = {
    map: Map;
    selectBalloon: (id: string) => void;
};

export function attachEventHandlers({ map, selectBalloon }: Params) {
    // Change cursor to pointer when hovering over the small circle.
    map.on("mouseenter", "latest-circle", () => {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "latest-circle", () => {
        map.getCanvas().style.cursor = "";
    });

    // 点击小圆点时选中对应气球
    map.on("click", "latest-circle", (e: any) => {
        try {
            const feature = e.features?.[0];
            if (!feature) return;
            const props = feature.properties as any;
            const id = (props.id as string) ?? "N/A";
            selectBalloon(id);
        } catch (error) {
            console.error("click latest-circle handler error:", error);
        }
    });
}
