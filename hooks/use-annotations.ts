"use client";

import { useCallback } from "react";
import { listAnnotations, mapAnnotationToHighlight } from "@/services/annotations";
import type { Highlight } from "@/types/pdf";

export function useAnnotations() {
  const loadExisting = useCallback(async (documentId: string): Promise<Highlight[]> => {
    const anns = await listAnnotations(documentId);
    const mapped = anns.map(mapAnnotationToHighlight).filter((h) => h.rects.length > 0);
    return mapped;
  }, []);

  return { loadExisting };
}

