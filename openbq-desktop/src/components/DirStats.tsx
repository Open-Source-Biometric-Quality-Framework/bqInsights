import React from "react";

type FileEntry = {
    filename: string;
    path: string;
    size: number;
    extension: string;
};

type DirectorySummaryProps = {
    directoryPath: string;
    files: FileEntry[];
    counts: Record<string, number>;
    limit: number;
    maxExamplesPerType?: number;
};

type PreviewImage = {
    path: string;
    base64: string;
};

function shuffle<T>(array: T[]): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const IMAGE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "wsq"
]);

export const DirectorySummary: React.FC<DirectorySummaryProps> = ({
    directoryPath,
    files,
    counts,
    limit,
    maxExamplesPerType = 10
}) => {
    if (!directoryPath) {
        return null; // renders nothing
    }

    const [previews, setPreviews] = React.useState<
        Record<string, PreviewImage[]>
    >({});
    const [loading, setLoading] = React.useState(false);

    const imageCounts = React.useMemo(
        () =>
            Object.entries(counts)
                .filter(([ext]) => IMAGE_EXTENSIONS.has(ext))
                .sort((a, b) => b[1] - a[1]),
        [counts]
    );

    const sampledImageBytes = React.useMemo(
        () =>
            files
                .filter(f => IMAGE_EXTENSIONS.has(f.extension))
                .reduce((sum, f) => sum + f.size, 0),
        [files]
    );

    React.useEffect(() => {
        let cancelled = false;

        async function loadPreviews() {
            setLoading(true);
            const next: Record<string, PreviewImage[]> = {};

            for (const [ext] of imageCounts) {
                const candidates = files.filter(f => f.extension === ext);
                const examples = shuffle(candidates).slice(0, maxExamplesPerType);

                next[ext] = [];

                for (const file of examples) {
                    try {
                        const { success, base64 } =
                            await window.electron.fs.readImageBase64(file.path, {
                                maxWidth: 60
                            });

                        if (!cancelled && success && base64) {
                            next[ext].push({
                                path: file.path,
                                base64
                            });
                        }
                    } catch {
                        // ignore preview failures
                    }
                }
            }

            if (!cancelled) {
                setPreviews(next);
                setLoading(false);
            }
        }

        if (imageCounts.length > 0) {
            loadPreviews();
        }

        return () => {
            cancelled = true;
        };
    }, [files, imageCounts, maxExamplesPerType]);

    const totalFiles = Object.values(counts).reduce((a, b) => a + b, 0);
    const totalImages = imageCounts.reduce((a, [, c]) => a + c, 0);

    function formatBytes(bytes: number): string {
        if (!Number.isFinite(bytes) || bytes < 0) return "0 B";

        const units = ["B", "KB", "MB", "GB", "TB"];
        let value = bytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
    }

    return (
        <div className="p-4 space-y-4 text-sm">
            <section>
                <div className="text-xs text-gray-500">Selected directory</div>
                <div className="font-mono break-all">{directoryPath}</div>
            </section>

            <section className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-gray-500">Total files</div>
                    <div className="text-lg">{totalFiles}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500">Image files</div>
                    <div className="text-lg">{totalImages}</div>
                </div>
            </section>

            <section>
                <div className="mb-2 text-xs text-gray-500">
                    Image types and examples
                </div>

                {imageCounts.length === 0 && (
                    <div className="text-gray-400">No images found</div>
                )}

                <div className="space-y-3">
                    {imageCounts.map(([ext, count]) => (
                        <div key={ext} className="flex items-start gap-3">
                            <div className="w-16 shrink-0">
                                <div className="font-mono text-xs">{ext}</div>
                                <div className="text-gray-500">{count}</div>
                            </div>

                            <div className="flex gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap pb-1">
                                {(previews[ext] || []).map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={`data:image/${ext};base64,${img.base64}`}
                                        className="h-14 w-14 object-cover rounded border"
                                        title={img.path}
                                    />
                                ))}

                                {loading && (!previews[ext] || previews[ext].length === 0) && (
                                    <div className="h-16 w-16 flex items-center justify-center text-xs text-gray-400 border rounded">
                                        loading
                                    </div>
                                )}
                            </div>



                        </div>
                    ))}
                </div>
                {/*
                <div className="pt-5">
                    <div className="text-xs text-gray-500">Average image size</div>
                    <div className="text-lg">{formatBytes(sampledImageBytes / limit)}</div>
                </div>
                */}
            </section>
        </div>
    );
};