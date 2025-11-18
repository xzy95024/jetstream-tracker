// src/components/map/core/popup.ts

export function buildPopupHtml(id: string, lon: number, lat: number, altKm: number | string) {
    const altText = typeof altKm === "number" ? altKm.toFixed(2) : altKm;
    return `
    <div style="font-size: 12px; line-height: 1.4;">
      <div><b>ID:</b> ${id}</div>
      <div><b>Lon:</b> ${lon.toFixed(3)}</div>
      <div><b>Lat:</b> ${lat.toFixed(3)}</div>
      <div><b>Alt:</b> ${altText} km</div>
    </div>
  `;
}
