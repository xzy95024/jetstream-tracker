// src/components/wind/WindParticlesCanvas.tsx

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Map } from "maplibre-gl";

import { fetchWindGrid } from "../../api/fetchWindGrid";
import {
    createWindFieldFromSamples,
    type WindField,
} from "../../domain/wind/gridField";

type Props = {
    mapRef: MutableRefObject<Map | null>;
    selectedAgeHours: number;
    enabled: boolean;
};

type Particle = {
    lon: number;
    lat: number;
    age: number;
};

const PARTICLE_COUNT = 900;
const MAX_AGE = 160;

// Visual tuning for the bright magenta “line + point” effect
const LINE_WIDTH = 1.4;
const LINE_COLOR = "rgba(255, 0, 255, 0.7)"; // bright pink line
const HEAD_RADIUS = 2.2;
const HEAD_COLOR = "rgba(255, 0, 255, 1.0)"; // solid bright pink head

// How long the tail should be relative to the actual movement
// 1.0 = true distance, >1 = visually longer tail
const TAIL_SCALE = 2.5;

export default function WindParticlesCanvas({
                                                mapRef,
                                                selectedAgeHours,
                                                enabled,
                                            }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [windField, setWindField] = useState<WindField | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const frameRef = useRef<number | null>(null);

    // 1. Fetch grid-based wind field based on time + current map bounds
    useEffect(() => {
        const map = mapRef.current;
        if (!enabled || !map) {
            setWindField(null);
            return;
        }

        let cancelled = false;

        const bounds = map.getBounds();
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLon = bounds.getWest();
        const maxLon = bounds.getEast();

        (async () => {
            const samples = await fetchWindGrid(
                selectedAgeHours,
                minLat,
                maxLat,
                minLon,
                maxLon,
                3, // rows
                5  // cols
            );

            if (cancelled) return;

            const field = createWindFieldFromSamples(samples);
            if (!field) {
                console.warn("[WindParticles] failed to build wind field");
                setWindField(null);
                return;
            }

            setWindField(field);
        })();

        return () => {
            cancelled = true;
        };
    }, [selectedAgeHours, enabled, mapRef]);

    // Initialize particles randomly inside the given bounds
    function initParticles(bounds: maplibregl.LngLatBounds) {
        const particles: Particle[] = [];
        const west = bounds.getWest();
        const east = bounds.getEast();
        const south = bounds.getSouth();
        const north = bounds.getNorth();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                lon: west + Math.random() * (east - west),
                lat: south + Math.random() * (north - south ? north - south : 1),
                age: Math.floor(Math.random() * MAX_AGE),
            });
        }
        particlesRef.current = particles;
    }

    // 2. Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const map = mapRef.current;
        if (!canvas || !map) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const mapCanvas = map.getCanvas() as HTMLCanvasElement;

        // Keep canvas size in sync with the MapLibre canvas (including DPR)
        const syncSizeFromMap = () => {
            const rect = mapCanvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        syncSizeFromMap();
        window.addEventListener("resize", syncSizeFromMap);
        map.on("resize", syncSizeFromMap);

        if (windField) {
            initParticles(map.getBounds());
        }

        // When the map stops moving, re-seed particles in the new bounds
        const handleMoveEnd = () => {
            if (windField) {
                initParticles(map.getBounds());
            }
        };
        map.on("moveend", handleMoveEnd);

        function step() {
            frameRef.current = requestAnimationFrame(step);

            if (!enabled || !windField) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            const bounds = map.getBounds();
            const west = bounds.getWest();
            const east = bounds.getEast();
            const south = bounds.getSouth();
            const north = bounds.getNorth();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const particles = particlesRef.current;

            // Configure line style for all particles
            ctx.lineWidth = LINE_WIDTH;
            ctx.strokeStyle = LINE_COLOR;
            ctx.lineCap = "round";

            for (const p of particles) {
                // Respawn old particles
                if (p.age++ > MAX_AGE) {
                    p.lon = west + Math.random() * (east - west);
                    p.lat = south + Math.random() * (north - south || 1);
                    p.age = 0;
                }

                // Previous screen position
                const prev = map.project([p.lon, p.lat]);

                // Move according to wind field (in lon/lat)
                const { u, v } = windField.getWind(p.lon, p.lat);
                p.lon += u;
                p.lat += v;

                // If out of bounds, respawn
                if (p.lon < west || p.lon > east || p.lat < south || p.lat > north) {
                    p.lon = west + Math.random() * (east - west);
                    p.lat = south + Math.random() * (north - south || 1);
                    p.age = 0;
                    continue;
                }

                // New screen position
                const curr = map.project([p.lon, p.lat]);

                // Compute a visually longer tail (even if actual movement is very small)
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;

                const tailX = curr.x - dx * TAIL_SCALE;
                const tailY = curr.y - dy * TAIL_SCALE;

                // Draw trail line (from tail to current head)
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(curr.x, curr.y);
                ctx.stroke();

                // Draw a small head point at the end of the line
                ctx.beginPath();
                ctx.arc(curr.x, curr.y, HEAD_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = HEAD_COLOR;
                ctx.fill();
            }
        }

        frameRef.current = requestAnimationFrame(step);

        return () => {
            window.removeEventListener("resize", syncSizeFromMap);
            map.off("resize", syncSizeFromMap);
            map.off("moveend", handleMoveEnd);
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRef, enabled, windField]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                backgroundColor: "transparent",
            }}
        />
    );
}
