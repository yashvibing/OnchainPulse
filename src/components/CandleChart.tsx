"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

const UP_COLOR = "#00f5cc";
const DOWN_COLOR = "#ffb4ab";
const TEXT_COLOR = "#84948e";
const BORDER_COLOR = "#3a4a45";
const GRID_COLOR = "rgba(255,255,255,0.05)";

export interface CandleChartPoint {
  /** Unix timestamp in seconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

function pricePrecision(points: CandleChartPoint[]) {
  const lastClose = points[points.length - 1]?.close || 0;
  if (lastClose > 0 && lastClose < 0.0001) return 8;
  if (lastClose < 0.01) return 6;
  if (lastClose < 1) return 4;
  return 2;
}

export function CandleChart({
  points,
  className,
  onCrosshairIndex,
}: {
  points: CandleChartPoint[];
  className?: string;
  onCrosshairIndex?: (index: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const crosshairCallbackRef = useRef(onCrosshairIndex);
  crosshairCallbackRef.current = onCrosshairIndex;

  // Ascending, unique timestamps — required by lightweight-charts.
  const cleanPoints = useMemo(() => {
    const byTime = new Map<number, CandleChartPoint>();
    for (const point of points) {
      byTime.set(point.time, point);
    }
    return [...byTime.values()].sort((a, b) => a.time - b.time);
  }, [points]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT_COLOR,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      rightPriceScale: {
        borderColor: BORDER_COLOR,
      },
      timeScale: {
        borderColor: BORDER_COLOR,
        timeVisible: true,
        secondsVisible: false,
        lockVisibleTimeRangeOnResize: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.35)", labelBackgroundColor: "#151d1a" },
        horzLine: { color: "rgba(255,255,255,0.35)", labelBackgroundColor: "#151d1a" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    const precision = pricePrecision(cleanPoints);
    candleSeries.applyOptions({
      priceFormat: {
        type: "price",
        precision,
        minMove: Number((10 ** -precision).toFixed(precision)),
      },
    });

    candleSeries.setData(
      cleanPoints.map((point) => ({
        time: point.time as UTCTimestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })),
    );
    volumeSeries.setData(
      cleanPoints.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.volume || 0,
        color: point.close >= point.open ? "rgba(0,245,204,0.3)" : "rgba(255,180,171,0.3)",
      })),
    );
    chart.timeScale().fitContent();

    const indexByTime = new Map<number, number>(
      cleanPoints.map((point, index) => [point.time, index]),
    );
    const handleCrosshair = (param: { time?: unknown }) => {
      const callback = crosshairCallbackRef.current;
      if (!callback) return;
      const index = typeof param.time === "number" ? indexByTime.get(param.time) : undefined;
      callback(typeof index === "number" ? index : null);
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
    };
  }, [cleanPoints]);

  return <div ref={containerRef} className={className} />;
}
