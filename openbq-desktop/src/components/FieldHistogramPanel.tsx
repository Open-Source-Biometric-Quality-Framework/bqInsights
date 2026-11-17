import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import './FieldHistogramPanel.css'

type Props = {
    inputData: any[] | Record<string, any> | undefined;
    dataKey: string;
    fieldConfig?: Record<string, any>;
    imageFunc?: (args: { imageFile: string }) => Promise<string>;
    bins?: number;
};

type HistogramField = {
    key: string;
    label: string;
    values: number[];
    items: any[];
};

const DEFAULT_BINS = 20;

const FieldHistogramPanel: React.FC<Props> = ({
    inputData,
    dataKey,
    fieldConfig = {},
    imageFunc,
    bins = DEFAULT_BINS,
}) => {

    if (inputData?.length < 10) {
        return null
    }
    /**
     * ---------------------------
     * Hooks MUST run unconditionally
     * ---------------------------
     */
    const [logScale, setLogScale] = useState<Record<string, boolean>>({});

    const [hoverPreview, setHoverPreview] = useState<{
        image?: string;
        x: number;
        y: number;
        key?: string;
        label?: string;
        value?: number;
        range?: { start: number; end: number };
    } | null>(null);

    const [dataVersion, setDataVersion] = useState(0);

    useEffect(() => {
        setDataVersion(v => v + 1);
    }, [inputData]);


    /**
     * Coerce input safely
     */
    const safeDataRef = useRef<any[]>([]);

    useEffect(() => {
        if (!inputData) {
            safeDataRef.current = [];
        } else if (Array.isArray(inputData)) {
            safeDataRef.current = inputData;
        } else if (typeof inputData === "object") {
            safeDataRef.current = Object.values(inputData);
        }
    }, [inputData]);

    const safeData = safeDataRef.current;


    const hoverImageCache = useRef<Record<string, string>>({});
    useEffect(() => {
        hoverImageCache.current = {};
        setHoverPreview(null);
    }, [inputData]);









    /**
     * ---------------------------
     * Extract numeric fields
     * ---------------------------
     */
    const fields: HistogramField[] = useMemo(() => {
        if (!safeData.length) return [];

        const map = new Map<string, HistogramField>();

        safeData.forEach((item) => {
            const src = item?.[dataKey];
            if (!src) return;

            Object.entries(src).forEach(([key, value]) => {
                if (typeof value !== "number") return;

                if (!map.has(key)) {
                    map.set(key, {
                        key,
                        label: fieldConfig[key]?.label || key,
                        values: [],
                        items: [],
                    });
                }

                map.get(key)!.values.push(value);
                map.get(key)!.items.push(item);
            });
        });

        return Array.from(map.values());
    }, [dataVersion, safeData, dataKey, fieldConfig]);

    /**
     * Histogram component
     */
    const Histogram: React.FC<{ field: HistogramField }> = ({
        field,
    }) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const isLog = logScale[field.key];

        const hist = useMemo(() => {
            if (!field.values.length) return null;

            /**
             * Clean numeric values
             */
            const cleanVals = field.values.filter(
                (v) => typeof v === "number" && !Number.isNaN(v)
            );

            if (!cleanVals.length) return null;

            /**
             * Log transform safely
             */
            const transformed = isLog
                ? cleanVals.map((v) =>
                    Math.log10(Math.max(v, 0.000001))
                )
                : cleanVals;

            const min = Math.min(...transformed);
            const max = Math.max(...transformed);

            /**
             * Handle zero-range distributions
             */
            const step = (max - min) / bins;
            const ranges = new Array(bins).fill(0).map((_, i) => {
                const start = min + step * i;
                const end = start + step;
                return { start, end };
            });

            if (min === max) {
                const counts = new Array(bins).fill(0);
                const bucketItems = new Array(bins)
                    .fill(0)
                    .map(() => []);

                // Put everything in centre bin
                const mid = Math.floor(bins / 2);

                transformed.forEach((_, i) => {
                    counts[mid]++;
                    bucketItems[mid].push(field.items[i]);
                });



                return { counts, bucketItems, ranges, min, max };
            }


            const counts = new Array(bins).fill(0);
            const bucketItems = new Array(bins)
                .fill(0)
                .map(() => []);

            transformed.forEach((v, i) => {
                if (Number.isNaN(v)) return;

                let idx = Math.floor((v - min) / step);

                /**
                 * Clamp index
                 */
                if (idx < 0) idx = 0;
                if (idx >= bins) idx = bins - 1;

                counts[idx]++;

                if (!bucketItems[idx]) {
                    bucketItems[idx] = [];
                }

                bucketItems[idx].push(field.items[i]);
            });
            const rawMin = Math.min(...cleanVals);
            const rawMax = Math.max(...cleanVals);

            return { counts, bucketItems, ranges, min: rawMin, max: rawMax };
        }, [field.key, field.values, bins, isLog]);

        /**
         * Draw histogram
         */
        useEffect(() => {
            if (!hist) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext("2d")!;
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            const maxCount = Math.max(...hist.counts);

            hist.counts.forEach((c, i) => {
                const x = (i / bins) * w;
                const bw = w / bins;
                const bh = (c / maxCount) * (h - 10);

                ctx.fillStyle = "#6366f1";
                ctx.fillRect(x, h - bh, bw - 2, bh);
            });
        }, [hist]);

        /**
         * Hover preview
         */
        const hoverRAF = useRef<number | null>(null);

        const handleMove = (
            e: React.MouseEvent<HTMLCanvasElement>
        ) => {
            if (!hist) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const clientX = e.clientX;
            const clientY = e.clientY;

            if (hoverRAF.current) {
                cancelAnimationFrame(hoverRAF.current);
            }



            hoverRAF.current = requestAnimationFrame(async () => {
                const x = clientX - rect.left;
                const bin = Math.floor((x / rect.width) * bins);

                const items = hist.bucketItems?.[bin];
                if (!items?.length) return;

                // Deterministic representative
                const rep =
                    items[Math.floor(items.length / 2)];

                const file = rep?.[dataKey]?.file;
                if (!file) return;

                let img = hoverImageCache.current[file];

                // Lazy load only if needed
                if (!img && imageFunc) {
                    try {
                        const b64 = await imageFunc({
                            imageFile: file,
                        });

                        if (b64) {
                            img = b64.startsWith("data:image")
                                ? b64
                                : `data:image/png;base64,${b64}`;

                            hoverImageCache.current[file] = img;
                        }
                    } catch { }
                }

                const range = hist.ranges?.[bin];

                setHoverPreview({
                    image: img,
                    x: clientX,
                    y: clientY,
                    key: field.key,
                    label: field.label,
                    range,
                    value: rep?.[field.key],
                });
                console.log(range)
                console.log(rep?.[field.key])
            });
        };

        useEffect(() => {
            return () => {
                if (hoverRAF.current) {
                    cancelAnimationFrame(hoverRAF.current);
                }
            };
        }, []);

        useEffect(() => {
            if (hoverRAF.current) {
                cancelAnimationFrame(hoverRAF.current);
            }
        }, [inputData]);

        return (
            <div className="histogram-panel">
                <div className="histogram-header">
                    <span>{field.label}</span>


                    <label>
                        <input
                            type="checkbox"
                            checked={!!isLog}
                            onChange={() =>
                                setLogScale((p) => ({
                                    ...p,
                                    [field.key]: !p[field.key],
                                }))
                            }
                        />
                        Log X
                    </label>
                </div>
                {hist && (
                    <div className="histogram-range">

                        {hist?.min?.toFixed(2)} – {hist?.max?.toFixed(2)}
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    className="histogram-canvas"
                    height={140}
                    onMouseMove={handleMove}
                    onMouseLeave={() => setHoverPreview(null)}
                />
            </div>
        );
    };

    /**
     * Final render guard (SAFE)
     */
    if (!fields.length) {
        return null;
    }

    const previewWidth = 140;
    const previewHeight = 140;

    let left = 0
    let top = 0

    if (hoverPreview) {
        left =
            hoverPreview.x + previewWidth > window.innerWidth
                ? hoverPreview.x - previewWidth - 20
                : hoverPreview.x + 18;

        top =
            hoverPreview.y + previewHeight > window.innerHeight
                ? hoverPreview.y - previewHeight - 20
                : hoverPreview.y + 18;

    }



    return (
        <div className="field-histogram-panel">
            {fields.map((f) => (
                <Histogram key={f.key} field={f} />
            ))}

            {hoverPreview &&
                createPortal(
                    <div
                        className="histogram-hover-preview"
                        style={{ left, top }}
                    >
                        {hoverPreview.image && (
                            <img src={hoverPreview.image} />
                        )}




                        <div className="hover-metadata">
                            {hoverPreview.label && (
                                <div className="hover-field-label">
                                    {hoverPreview.label}
                                </div>
                            )}

                            {hoverPreview.value !== undefined && (
                                <div>
                                    Value: {hoverPreview.value.toFixed(2)}
                                </div>
                            )}

                            {hoverPreview.range && (
                                <div>
                                    Range:{" "}
                                    {hoverPreview.range.start.toFixed(1)} –{" "}
                                    {hoverPreview.range.end.toFixed(1)}
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )
            }
        </div>
    );
};

export default FieldHistogramPanel;