"use client";

import { useRef } from "react";
import type { Rect } from "@/types/pdf";

export function useImageRects() {
  const imageRectsRef = useRef<Record<number, Rect[]>>({});

  const interceptDrawImage = (
    context: CanvasRenderingContext2D,
    pageNumber: number
  ) => {
    const anyCtx = context as any;
    const original: typeof anyCtx.drawImage | undefined = anyCtx.drawImage?.bind(
      context
    );
    anyCtx.drawImage = function (...args: any[]) {
      try {
        let dx = 0,
          dy = 0,
          dw = 0,
          dh = 0;
        if (args.length === 3) {
          dx = args[1];
          dy = args[2];
          dw = args[0]?.width || 0;
          dh = args[0]?.height || 0;
        } else if (args.length === 5) {
          dx = args[1];
          dy = args[2];
          dw = args[3];
          dh = args[4];
        } else if (args.length === 9) {
          dx = args[5];
          dy = args[6];
          dw = args[7];
          dh = args[8];
        }
        if (dw > 1 && dh > 1) {
          const t = context.getTransform();
          const pts = [
            { x: dx, y: dy },
            { x: dx + dw, y: dy },
            { x: dx, y: dy + dh },
            { x: dx + dw, y: dy + dh },
          ].map((p) => ({ x: t.a * p.x + t.c * p.y + t.e, y: t.b * p.x + t.d * p.y + t.f }));
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          const rect: Rect = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
          if (!imageRectsRef.current[pageNumber]) imageRectsRef.current[pageNumber] = [];
          imageRectsRef.current[pageNumber].push(rect);
        }
      } catch {}
      return original?.(...args);
    };

    return () => {
      if (original) anyCtx.drawImage = original;
    };
  };

  const getRects = (pageNumber: number): Rect[] => imageRectsRef.current[pageNumber] || [];

  return { interceptDrawImage, getRects, imageRectsRef };
}

