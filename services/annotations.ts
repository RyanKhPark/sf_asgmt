import { Highlight } from "@/types/pdf";

export interface AnnotationRecord {
  id: string;
  documentId: string;
  userId: string;
  type: string; // "highlight" | "ai_highlight" | "image_highlight"
  highlightText: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  createdBy?: string; // "user" | "ai"
}

export async function listAnnotations(documentId: string): Promise<AnnotationRecord[]> {
  const res = await fetch(`/api/annotations?documentId=${documentId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.annotations || []) as AnnotationRecord[];
}

export function mapAnnotationToHighlight(a: AnnotationRecord): Highlight {
  return {
    id: `ann-${a.id}`,
    pageNumber: a.pageNumber,
    text: a.highlightText,
    rects: [
      {
        x: a.x ?? 0,
        y: a.y ?? 0,
        width: a.width ?? 0,
        height: a.height ?? 0,
      },
    ].filter((r) => r.width > 1 && r.height > 1),
    color: a.color || (a.type === "image_highlight" ? "#ff0000" : "#ffff00"),
    type: a.type === "image_highlight" ? "image" : a.createdBy === "ai" ? "ai" : "manual",
    shape: a.type === "image_highlight" ? "circle" : "rect",
    strokeColor: a.type === "image_highlight" ? "#ff0000" : undefined,
    strokeWidth: a.type === "image_highlight" ? 2 : undefined,
  };
}

export async function saveAnnotation(payload: {
  documentId: string;
  type: string;
  highlightText: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  createdBy?: string;
  messageId?: string;
}): Promise<{ annotationId?: string }> {
  const res = await fetch("/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return {};
  return res.json();
}

