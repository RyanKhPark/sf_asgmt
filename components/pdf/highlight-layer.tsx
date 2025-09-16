"use client";

import React from "react";

type Rect = { x: number; y: number; width: number; height: number };

export interface HighlightItem {
  id: string;
  rects: Rect[];
  color: string;
  type: "manual" | "ai" | "image";
  shape?: "rect" | "circle";
  strokeColor?: string;
  strokeWidth?: number;
}

interface HighlightLayerProps {
  items: HighlightItem[];
}

export function HighlightLayer({ items }: HighlightLayerProps) {
  return (
    <div className="absolute top-0 left-0 pointer-events-none">
      {items.map((highlight) => (
        <div key={highlight.id}>
          {highlight.rects.map((rect, rectIndex) => {
            if (!rect || rect.width <= 1 || rect.height <= 1) return null;
            if (highlight.shape === "circle") {
              const radius = (Math.max(rect.width, rect.height) / 2) * 1.1;
              const cx = rect.x + rect.width / 2;
              const cy = rect.y + rect.height / 2;
              const left = cx - radius;
              const top = cy - radius;
              return (
                <div
                  key={rectIndex}
                  className="absolute"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${radius * 2}px`,
                    height: `${radius * 2}px`,
                    borderRadius: "9999px",
                    border: `${highlight.strokeWidth ?? 2}px solid ${highlight.strokeColor ?? "#ff0000"}`,
                    backgroundColor: "transparent",
                    boxSizing: "border-box",
                  }}
                />
              );
            }
            return (
              <div
                key={rectIndex}
                className={`absolute ${highlight.type === "ai" ? "animate-pulse" : ""}`}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  backgroundColor: highlight.color,
                  opacity: 0.3,
                  mixBlendMode: "multiply",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
