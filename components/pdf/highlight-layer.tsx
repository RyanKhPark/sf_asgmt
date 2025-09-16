"use client";

import React from "react";

type Rect = { x: number; y: number; width: number; height: number };

export interface HighlightItem {
  id: string;
  rects: Rect[];
  color: string;
  type: "manual" | "ai";
}

interface HighlightLayerProps {
  items: HighlightItem[];
}

export function HighlightLayer({ items }: HighlightLayerProps) {
  return (
    <div className="absolute top-0 left-0 pointer-events-none">
      {items.map((highlight) => (
        <div key={highlight.id}>
          {highlight.rects.map((rect, rectIndex) => (
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
          ))}
        </div>
      ))}
    </div>
  );
}

