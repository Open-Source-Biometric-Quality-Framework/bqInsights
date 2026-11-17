// EmbeddingVisualization.tsx - Embedding visualization component

import React, { useRef, useEffect, useState } from 'react';
import { EmbeddingView, type DataPoint, type Rectangle, type ViewportState } from 'embedding-atlas/react';
import { findNearestIndex, makeHoverThreshold2 } from '../utils/hoverUtils';

interface CustomOverlayProps {
  proxy: {
    location: (x: number, y: number) => { x: number; y: number } | null;
    on?: (event: string, callback: () => void) => void;
    off?: (event: string, callback: () => void) => void;
  };
  customProp?: { x: number; y: number } | [number, number];
}

class CustomOverlay {
  private target: HTMLElement;
  private props: CustomOverlayProps;
  private container: HTMLDivElement;
  private svg: SVGSVGElement;
  private circle: SVGCircleElement;
  private updateHandler: () => void;
  private baseSize: number = 25; // Base size in pixels at scale 1
  private referenceDistance: number | null = null;
  private animationFrameId: number | null = null;
  private startTime: number = Date.now();

  constructor(target: HTMLElement, props: CustomOverlayProps) {
    this.target = target;
    this.props = props;

    // Create container div
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.pointerEvents = 'none';
    this.container.style.willChange = 'transform, left, top';

    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.overflow = 'visible';
    this.svg.style.display = 'block';

    // Create circle with dashed stroke
    this.circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.circle.setAttribute('fill', 'rgba(59, 130, 246, 0.3)');
    this.circle.setAttribute('stroke', 'rgb(59, 130, 246)');
    this.circle.setAttribute('stroke-width', '5');

    // Calculate dash pattern for ~10 segments with long dashes and small gaps
    const radius = 47; // Slightly less than 50 to account for stroke width
    const circumference = 2 * Math.PI * radius;
    const segmentCount = 10;
    const totalLength = circumference / segmentCount; // Length for one dash + gap
    const gapLength = totalLength * 0.15; // Gap is 15% of total segment length
    const dashLength = totalLength - gapLength; // Dash takes up the rest (85%)

    this.circle.setAttribute('stroke-dasharray', `${dashLength} ${gapLength}`);
    this.circle.setAttribute('cx', '50'); // Center at 50,50 in viewBox
    this.circle.setAttribute('cy', '50');
    this.circle.setAttribute('r', `${radius}`);

    // Assemble SVG
    this.svg.appendChild(this.circle);
    this.container.appendChild(this.svg);

    // Mount to target
    this.target.appendChild(this.container);

    // Bind the update handler
    this.updateHandler = () => this.updatePosition();

    // Listen for view changes (zoom/pan)
    if (this.props.proxy.on) {
      this.props.proxy.on('viewchange', this.updateHandler);
      this.props.proxy.on('zoom', this.updateHandler);
      this.props.proxy.on('pan', this.updateHandler);
    }

    // Start the pulsing animation
    this.startPulseAnimation();

    // Initial position update
    this.updatePosition();
  }

  private calculateScale(): number {
    const ref1 = this.props.proxy.location(0, 0);
    const ref2 = this.props.proxy.location(1, 0);

    if (!ref1 || !ref2) return 1;

    const currentDistance = Math.sqrt(
      Math.pow(ref2.x - ref1.x, 2) + Math.pow(ref2.y - ref1.y, 2)
    );

    if (this.referenceDistance === null) {
      this.referenceDistance = currentDistance;
      return 1;
    }

    return currentDistance / this.referenceDistance;
  }

  private startPulseAnimation(): void {
    const animate = () => {
      const elapsed = Date.now() - this.startTime;
      const pulseSpeed = 2000; // Pulse duration in ms
      const progress = (elapsed % pulseSpeed) / pulseSpeed;

      // Sine wave for smooth pulsing (0.8 to 1.2 scale)
      const pulseFactor = 1.0 + 0.4 * Math.sin(progress * Math.PI * 2);

      // Update the pulse
      this.updatePosition(pulseFactor);

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private updatePosition(pulseFactor: number = 1): void {
    if (this.props.customProp && this.props.proxy) {
      const x = Array.isArray(this.props.customProp)
        ? this.props.customProp[0]
        : this.props.customProp.x;
      const y = Array.isArray(this.props.customProp)
        ? this.props.customProp[1]
        : this.props.customProp.y;

      // Get pixel location from data coordinates
      const pixelPos = this.props.proxy.location(x, y);

      if (pixelPos) {
        const scale = this.calculateScale();
        const scaledSize = this.baseSize * scale * pulseFactor;

        // Update SVG size - the viewBox is 100x100, so we multiply by 2 to get diameter
        const svgSize = scaledSize * 2;
        this.svg.setAttribute('width', `${svgSize}`);
        this.svg.setAttribute('height', `${svgSize}`);
        this.svg.setAttribute('viewBox', '0 0 100 100');

        // Position the container - center it on the point
        // Since the SVG is now svgSize x svgSize, we need to offset by half
        this.container.style.left = `${pixelPos.x - svgSize / 2}px`;
        this.container.style.top = `${pixelPos.y - svgSize / 2}px`;
        this.container.style.display = 'block';
      } else {
        this.container.style.display = 'none';
      }
    }
  }

  update(props: CustomOverlayProps): void {
    this.props = props;
    this.startTime = Date.now(); // Reset animation on update
    this.updatePosition();
  }

  destroy(): void {
    // Stop animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Remove event listeners
    if (this.props.proxy.off) {
      this.props.proxy.off('viewchange', this.updateHandler);
      this.props.proxy.off('zoom', this.updateHandler);
      this.props.proxy.off('pan', this.updateHandler);
    }

    // Remove the container element
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// simple 256-entry Viridis palette (RGB hex strings)
const VIRIDIS_PALETTE = [
  "#440154", "#440256", "#450457", "#450559", "#46075A", "#46085B", "#470A5C", "#480C5D",
  "#490D5E", "#4B0F5F", "#4C105F", "#4D125F", "#4F145F", "#511560", "#531760", "#551961",
  "#571B61", "#591D62", "#5C1F62", "#5F2163", "#622363", "#642563", "#672763", "#6A2964",
  "#6D2B65", "#703D66", "#733F66", "#764166", "#794366", "#7D4566", "#804766", "#844967",
  "#884B67", "#8C4D67", "#914F68", "#955168", "#995368", "#9E5569", "#A25769", "#A65969",
  "#AB5B69", "#B05D6A", "#B45F6A", "#B9616A", "#BD636A", "#C1656B", "#C5676B", "#CA696B",
  "#CD6C6C", "#D16E6C", "#D5706D", "#D8726D", "#DC746E", "#DF766E", "#E3786F", "#E67A6F",
  "#E97C70", "#EC7E70", "#EF8171", "#F28371", "#F58572", "#F78772", "#FA8A73", "#FC8C73",
  "#FE8E74", "#FF9174", "#FF9375", "#FF9575", "#FF9876", "#FF9A76", "#FF9C77", "#FF9F77",
  "#FFA178", "#FFA378", "#FFA679", "#FFA879", "#FFAA7A", "#FFAD7A", "#FFAF7B", "#FFB17B",
  "#FFB47C", "#FFB67C", "#FFB87D", "#FFBB7D", "#FFBD7E", "#FFBF7E", "#FFC17F", "#FFC47F",
  "#FFC680", "#FFC880", "#FFCB81", "#FFCD81", "#FFCF82", "#FFD182", "#FFD383", "#FFD683",
  "#FFD884", "#FFDA84", "#FFDC85", "#FFDE85", "#FFE186", "#FFE386", "#FFE587", "#FFE787",
  "#FFE988", "#FFEC88", "#FFEE89", "#FFF089", "#FFF28A", "#FFF48A", "#FFF68B", "#FFF98B",
  "#FFFB8C", "#FFFD8C", "#FFFF8D", "#FFFE8D", "#FEFC8E", "#FEFA8E", "#FEF88F", "#FEF68F",
  "#FEF490", "#FEF390", "#FEF191", "#FEEF91", "#FEED92", "#FEEB92", "#FEE993", "#FEE793",
  "#FEE594", "#FEE394", "#FDE195", "#FDDF95", "#FDDD96", "#FDDB96", "#FDD997", "#FDD797",
  "#FDD598", "#FDD398", "#FDD199", "#FDCF99", "#FDCD9A", "#FDCB9A", "#FCC99B", "#FCC79B",
  "#FCC59C", "#FCC39C", "#FCC19D", "#FCBF9D", "#FCBD9E", "#FCBB9E", "#FCB99F", "#FCB79F",
  "#FCB5A0", "#FCB3A0", "#FCB1A1", "#FCAFA1", "#FCADA2", "#FCABA2", "#FCA9A3", "#FCA7A3",
  "#FCA5A4", "#FCA3A4", "#FCA1A5", "#FC9FA5", "#FC9DA6", "#FC9BA6", "#FC99A7", "#FC97A7",
  "#FC95A8", "#FC93A8", "#FC91A9", "#FC8FA9", "#FC8DAA", "#FC8BAA", "#FC89AB", "#FC87AB",
  "#FC85AC", "#FC83AC", "#FC81AD", "#FC7FAD", "#FC7DAE", "#FC7BAE", "#FC79AF", "#FC77AF",
  "#FC75B0", "#FC73B0", "#FC71B1", "#FC6FB1", "#FC6DB2", "#FC6BB2", "#FC69B3", "#FC67B3",
  "#FC65B4", "#FC63B4", "#FC61B5", "#FC5FB5", "#FC5DB6", "#FC5BB6", "#FC59B7", "#FC57B7",
  "#FC55B8", "#FC53B8", "#FC51B9", "#FC4FB9", "#FC4DBA", "#FC4BBA", "#FC49BB", "#FC47BB",
  "#FC45BC", "#FC43BC", "#FC41BD", "#FC3FBD", "#FC3DBE", "#FC3BBE", "#FC39BF", "#FC37BF",
  "#FC35C0", "#FC33C0", "#FC31C1", "#FC2FC1", "#FC2DC2", "#FC2BC2", "#FC29C3", "#FC27C3",
  "#FC25C4", "#FC23C4", "#FC21C5", "#FC1FC5", "#FC1DC6", "#FC1BC6", "#FC19C7", "#FC17C7",
  "#FC15C8", "#FC13C8", "#FC11C9", "#FC0FC9", "#FC0DCA", "#FC0BCA", "#FC09CB", "#FC07CB",
  "#FC05CC", "#FC03CC", "#FC01CD", "#FB00CD", "#F900CE", "#F700CE", "#F500CF", "#F300CF",
  "#F100D0", "#EF00D0", "#ED00D1", "#EB00D1", "#E900D2", "#E700D2", "#E500D3", "#E300D3",
  "#FDE725"
] as const;
const PALETTE_SIZE = VIRIDIS_PALETTE.length;
const OUTLIER_COLOR = '#8a8a8a';

type EmbeddingVisualizationProps = {
  xColumn: Float32Array;
  yColumn: Float32Array;
  categoryColumn: Uint8Array | null;
  numericColorColumn?: Float32Array | null;
  numericRange?: { min: number; max: number } | null;
  categoryColors: string[];
  onHover: (index: number | null) => void;
  tooltipData: (index: number) => string;
  onSelection?: (selection: any) => void;
  onProcessingComplete?: (data: any) => void;
};

export function EmbeddingVisualization({
  xColumn,
  yColumn,
  categoryColumn,
  numericColorColumn,
  numericRange,
  categoryColors,
  onHover,
  tooltipData,
  onSelection,
  onProcessingComplete
}: EmbeddingVisualizationProps) {
  const [tooltip, setTooltip] = React.useState<any>(null);
  const hoverThreshold2Ref = useRef<number>(0);
  const lastHoverIdxRef = useRef<number | null>(null);
  let [selection, setSelection] = useState<DataPoint[] | null>([]);
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);

  const rafRef = useRef<number | null>(null);
  let [mode, setMode] = useState<"points" | "density">("points");
  let [minimumDensity, setMinimumDensity] = useState<number>(1 / 64);
  let [viewportState, setViewportState] = useState<ViewportState | null>(null);
  let [rangeSelection, setRangeSelection] = useState<any | null>(null);
  const processingCompleteCalledRef = useRef<boolean>(false);

  // Histogram filter state
  const [histogramFilter, setHistogramFilter] = useState<number | null>(null);

  const [colorScheme, setColorScheme] = useState<"light" | "dark">(() => {
    // Try Tailwind class first
    if (document.documentElement.classList.contains('dark')) {
      return "dark";
    }
    // Fall back to system preference
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return "dark";
    }
    return "light";
  });

  useEffect(() => {
    // Listen to system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener('change', handleChange);

    // Listen to Tailwind dark mode class changes
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setColorScheme(isDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);



  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        let { width, height } = containerRef.current.getBoundingClientRect();
        height -= 80
        if (height > 0) {  // Only update if we have a real height
          setDimensions({ width, height });
        }
      }
    };

    // Initial measurement after a small delay to let layout settle
    const timeout = setTimeout(updateDimensions, 100);

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        let { width, height } = entry.contentRect;
        height -= 80
        if (height > 0) {  // Only update if we have a real height
          setDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeout);
      resizeObserver.disconnect();
    };
  }, []);


  useEffect(() => {
    if (xColumn && yColumn) {
      hoverThreshold2Ref.current = makeHoverThreshold2(xColumn, yColumn);
    }
  }, [xColumn, yColumn]);

  // Signal processing complete when data is ready
  useEffect(() => {
    if (xColumn && yColumn && onProcessingComplete && !processingCompleteCalledRef.current) {
      processingCompleteCalledRef.current = true;
      onProcessingComplete({
        xColumn,
        yColumn,
        categoryColumn,
        pointCount: xColumn.length
      });
    }

    // Reset flag when data changes
    return () => {
      processingCompleteCalledRef.current = false;
    };
  }, [xColumn, yColumn, categoryColumn, onProcessingComplete]);

  const handleQuerySelection = (x: number, y: number) => {
    if (!xColumn || !yColumn) return;

    // Throttle to one per animation frame
    if (rafRef.current != null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const { index, dist2 } = findNearestIndex(x, y, xColumn, yColumn);
      const thresh2 = hoverThreshold2Ref.current;

      const nextIdx = dist2 <= thresh2 ? index : null;

      // Avoid state spam
      if (lastHoverIdxRef.current !== nextIdx) {
        lastHoverIdxRef.current = nextIdx;
        onHover(nextIdx);
      }
    });
  };

  type DataPoint = {
    x: number;
    y: number;
    text?: string;
    fields?: Record<string, unknown>;
  };

  type ConvexHullSelection = DataPoint[];

  type RectSelection = {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
  };

  type RangeSelection = ConvexHullSelection | RectSelection;

  function cross(
    ax: number, ay: number,
    bx: number, by: number,
    cx: number, cy: number
  ): number {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  function pointInConvexHull(
    px: number,
    py: number,
    hull: ConvexHullSelection
  ): boolean {
    let sign = 0;

    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];

      const c = cross(a.x, a.y, b.x, b.y, px, py);

      if (c === 0) continue; // on edge

      if (sign === 0) {
        sign = Math.sign(c);
      } else if (Math.sign(c) !== sign) {
        return false;
      }
    }

    return true;
  }

  function tooltipDataExtract(i) {
    return JSON.parse(tooltipData(i))
  }

  function rowFieldsExtract(i: number): Record<string, unknown> {
    const raw = tooltipDataExtract(i);
    const nested = raw?.fields;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }

  function tooltipFile(i) {
    function basename(path?: string): string {
      if (!path) return '';
      return path.split(/[\\/]/).pop() || '';
    }
    const raw = tooltipDataExtract(i);
    const filePath =
      (raw && typeof raw === 'object' && typeof raw.file === 'string' ? raw.file : undefined) ??
      (raw?.fields && typeof raw.fields === 'object' && typeof raw.fields.file === 'string'
        ? raw.fields.file
        : undefined);
    return basename(filePath)
  }

  function findPointsInSelection(selection: RangeSelection): DataPoint[] {
    // Case 1: convex hull selection
    if (Array.isArray(selection)) {
      const hull = selection;

      const points: DataPoint[] = [];

      for (let i = 0; i < xColumn.length; i++) {
        const x = xColumn[i];
        const y = yColumn[i];

        if (pointInConvexHull(x, y, hull)) {
          points.push({
            x,
            y,
            text: tooltipFile(i),
            fields: rowFieldsExtract(i)
          });
        }
      }

      return points;
    }

    // Case 2: rectangle fallback
    if (!selection) {
      return [];
    }
    const { xMin, xMax, yMin, yMax } = selection;

    const points: DataPoint[] = [];

    for (let i = 0; i < xColumn.length; i++) {
      const x = xColumn[i];
      const y = yColumn[i];

      if (
        x >= xMin &&
        x <= xMax &&
        y >= yMin &&
        y <= yMax
      ) {
      points.push({
        x,
        y,
        text: tooltipFile(i),
        fields: rowFieldsExtract(i)
      });
      }
    }

    return points;
  }

  async function querySelection(x: number, y: number, unitDistance: number): Promise<DataPoint | null> {
    let minDistance2: number | null = null;
    let minIndex: number | null = null;
    for (let i = 0; i < xColumn.length; i++) {
      let d2 = (xColumn[i] - x) * (xColumn[i] - x) + (yColumn[i] - y) * (yColumn[i] - y);
      if (minDistance2 == null || d2 < minDistance2) {
        minDistance2 = d2;
        minIndex = i;
      }
    }
    if (minIndex == null || minDistance2 == null || Math.sqrt(minDistance2) > unitDistance * 10) {
      return null;
    }
    onHover(minIndex);
    return {
      x: xColumn[minIndex],
      y: yColumn[minIndex],
      text: tooltipFile(minIndex),
      fields: rowFieldsExtract(minIndex)
    };
  }

  const rangeSelectionFunc = (selection: RangeSelection) => {
    const points = findPointsInSelection(selection);
    console.log(points)
    return points
  };

  const enrichSelectionWithFields = (points: any[] | null | undefined): any[] => {
    if (!Array.isArray(points) || points.length === 0) return [];

    return points.map((point) => {
      if (point && typeof point === 'object' && point.fields && typeof point.fields === 'object') {
        return point;
      }

      let idx: number | null = null;
      if (typeof point?.index === 'number' && Number.isFinite(point.index)) {
        idx = point.index;
      } else if (typeof point?.i === 'number' && Number.isFinite(point.i)) {
        idx = point.i;
      } else if (typeof point?.x === 'number' && typeof point?.y === 'number') {
        const nearest = findNearestIndex(point.x, point.y, xColumn, yColumn);
        if (nearest && typeof nearest.index === 'number') {
          idx = nearest.index;
        }
      }

      if (idx === null || idx < 0 || idx >= xColumn.length) {
        return point;
      }

      return {
        ...point,
        text: tooltipFile(idx),
        fields: rowFieldsExtract(idx)
      };
    });
  };

  // Process color data - SIMPLIFIED AND FIXED
  const [processedColorData, setProcessedColorData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (numericColorColumn && numericColorColumn.length > 0 && numericRange) {
      const { min: dataMin, max: dataMax } = numericRange;
      const range = dataMax - dataMin || 1; // avoid zero

      const length = numericColorColumn.length;
      const bins = new Uint8Array(length);

      for (let i = 0; i < length; i++) {
        const val = numericColorColumn[i];

        // Normalize to [0,1] using the provided range
        const normalised = (val - dataMin) / range;

        // Clamp to [0,1]
        const clamped = Math.min(1, Math.max(0, normalised));

        // Map to palette index [0, 255]
        bins[i] = Math.floor(clamped * 255);
      }

      setProcessedColorData(bins);
    } else {
      setProcessedColorData(null);
    }
  }, [numericColorColumn, numericRange]);


  const colorData = processedColorData || categoryColumn;

  const isNumeric = numericColorColumn != null && numericRange != null;

  // Choose palette - apply histogram filter if active
  const VIRIDIS_256_MUTABLE: string[] = [...VIRIDIS_PALETTE];

  let colorPalette: string[];
  if (isNumeric) {
    if (histogramFilter !== null) {
      // Create filtered palette with grey for non-selected bins
      const filterWindow = 10; // bins around selection to keep colored
      colorPalette = VIRIDIS_256_MUTABLE.map((color, idx) => {
        const binIdx = Math.floor((idx / 255) * 256); // map palette idx to bin idx
        const distance = Math.abs(binIdx - histogramFilter);
        return distance <= filterWindow ? color : '#888888';
      });
    } else {
      colorPalette = VIRIDIS_256_MUTABLE;
    }
  } else {
    let hasOutliers = false;
    let maxCategory = 0;
    if (categoryColumn) {
      for (let i = 0; i < categoryColumn.length; i++) {
        const v = categoryColumn[i];
        if (v === 255) {
          hasOutliers = true;
        } else if (v > maxCategory) {
          maxCategory = v;
        }
      }
    }

    const minLength = Math.max(
      categoryColors.length,
      maxCategory + 1,
      hasOutliers ? 256 : 0
    );

    if (minLength <= categoryColors.length) {
      colorPalette = categoryColors;
    } else {
      colorPalette = new Array(minLength);
      for (let i = 0; i < minLength; i++) {
        colorPalette[i] = categoryColors[i % categoryColors.length];
      }
    }

    if (hasOutliers) {
      colorPalette[255] = OUTLIER_COLOR;
    }
  }



  const config = {
    autoLabelEnabled: false,
    mode: mode,
    colorScheme: colorScheme,
    minimumDensity: minimumDensity,
    continuousColorScale: false
  };

  const theme = {
    statusBar: true,
    brandingLink: { href: 'https://embedding-atlas.com', text: 'OpenBQ' }
  };


  function computeHistogram(
    values: Uint8Array,
    binCount = 256
  ): Uint32Array {
    const bins = new Uint32Array(binCount);

    for (let i = 0; i < values.length; i++) {
      const v = values[i]; // Already 0-255
      // Direct mapping to bin
      bins[v]++;
    }

    return bins;
  }

  const histogramBins = React.useMemo(() => {
    if (!processedColorData) return null;
    return computeHistogram(processedColorData, 256);
  }, [processedColorData]);

  type ColorHistogramProps = {
    bins: Uint32Array;
    palette: string[];
    onBinClick?: (binIndex: number) => void;
    selectedBin?: number | null;
  };

  function ColorHistogram({ bins, palette, onBinClick, selectedBin }: ColorHistogramProps) {
    const width = 256;
    const height = 40;
    const barWidth = width / bins.length;
    const max = Math.max(...bins);

    return (
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          style={{ display: 'block', cursor: 'pointer' }}
          onClick={(e) => {
            if (!onBinClick) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const binIdx = Math.floor((x / width) * bins.length);
            onBinClick(binIdx);
          }}
        >
          {Array.from(bins).map((count, i) => {
            const h =
              max > 0
                ? (Math.log(count + 1) / Math.log(max + 1)) * height
                : 0;

            // Direct color mapping
            const color = palette[i] || palette[palette.length - 1];

            // Highlight selected bin
            const isSelected = selectedBin !== null && Math.abs(i - selectedBin) <= 10;

            return (
              <rect
                key={i}
                x={i * barWidth}
                y={height - h}
                width={Math.max(1, barWidth)}
                height={h}
                fill={color}
                opacity={isSelected || selectedBin === null ? 1 : 0.3}
                stroke={isSelected ? '#fff' : 'none'}
                strokeWidth={isSelected ? 1 : 0}
              />
            );
          })}
        </svg>

        {selectedBin !== null && (
          <button
            onClick={() => onBinClick?.(null as any)}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ff4444',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  const handleHistogramClick = (binIndex: number | null) => {
    setHistogramFilter(binIndex);
  };

  interface Label {
    x: number;
    y: number;
    text: string;
    level?: number;
    priority?: number;
  }

  // Compute centroid labels per category
  const labelsSimple: Label[] = React.useMemo(() => {
    if (!categoryColumn || !xColumn || !yColumn) return [];

    const sums: Record<number, { sumX: number; sumY: number; count: number }> = {};

    for (let i = 0; i < categoryColumn.length; i++) {
      const cat = categoryColumn[i];

      // Skip outliers
      if (cat === 255) continue;

      if (!sums[cat]) {
        sums[cat] = { sumX: 0, sumY: 0, count: 0 };
      }

      sums[cat].sumX += xColumn[i];
      sums[cat].sumY += yColumn[i];
      sums[cat].count += 1;
    }

    const labels: Label[] = [];

    for (const catStr of Object.keys(sums)) {
      const cat = Number(catStr);
      const { sumX, sumY, count } = sums[cat];

      if (count === 0) continue;

      labels.push({
        x: sumX / count,
        y: sumY / count,
        text: `Cluster ${cat}`,
        level: 1,
        priority: count // larger clusters get higher priority
      });
    }

    return labels;
  }, [categoryColumn, xColumn, yColumn]);


  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: '#111'
      }}
      ref={containerRef}
    >
      <EmbeddingView
        height={dimensions.height}
        width={dimensions.width}
        data={{
          x: xColumn,
          y: yColumn,
          category: colorData
        }}

        key={`embedding-${xColumn?.length || 0}-${numericColorColumn ? 'numeric' : 'category'}-${histogramFilter}`}
        tooltip={tooltip}
        onTooltip={setTooltip}
        config={config}
        theme={theme}
        showLabels={true}
        categoryColors={colorPalette}
        labels={labelsSimple}

        selection={selection}
        onSelection={(v) => {
          setSelectedPoint(null);
          if (v && v.length > 0) {
            const point = v[0];
            // Assuming point has x and y coordinates
            setSelectedPoint([point.x, point.y]);
          }
          setSelection(v);
          onSelection!(enrichSelectionWithFields(v as any[]));
        }}
        rangeSelection={rangeSelection}
        onRangeSelection={(v) => {
          let points = rangeSelectionFunc(v);
          onSelection!(enrichSelectionWithFields(points));
        }}
        querySelection={querySelection}

        customOverlay={selectedPoint ? {
          class: CustomOverlay,
          props: {
            customProp: selectedPoint
          }
        } : undefined}
      />

      {histogramBins && (
        <div style={{
          position: "absolute",
          bottom: 180,
          right: 20,
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.85)',
          borderRadius: 6
        }}>
          <div style={{ color: '#fff', fontSize: 11, marginBottom: 4 }}>
            Distribution {histogramFilter !== null && '(filtered)'}
          </div>
          <ColorHistogram
            bins={histogramBins}
            palette={VIRIDIS_256_MUTABLE}
            onBinClick={handleHistogramClick}
            selectedBin={histogramFilter}
          />
        </div>
      )}

      {/* Color scale legend for numeric mode */}
      {colorPalette && numericRange && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            right: 20,
            background: "rgba(0, 0, 0, 0.85)",
            padding: "8px 12px",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            pointerEvents: "none"
          }}
        >
          <div style={{ marginBottom: 4 }}>Color Scale</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <span>{numericRange.min.toFixed(2)}</span>

            {/* gradient bar */}
            <div
              style={{
                width: 120,
                height: 12,
                borderRadius: 2,
                background: `linear-gradient(
            to right,
            ${VIRIDIS_256_MUTABLE.join(", ")}
          )`
              }}
            />

            <span>{numericRange.max.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
