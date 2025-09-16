export type Rect = { x: number; y: number; width: number; height: number };

export type HighlightType = "manual" | "ai" | "image";

export interface Highlight {
  id: string;
  pageNumber: number;
  text: string;
  rects: Rect[];
  color: string;
  type: HighlightType;
  shape?: "rect" | "circle";
  strokeColor?: string;
  strokeWidth?: number;
}

