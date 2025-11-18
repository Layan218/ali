"use client";

import { useSearchParams } from "next/navigation";
import EditorPage from "./[id]/page";

export default function EditorRootPage() {
  const searchParams = useSearchParams();
  const slideId = searchParams.get("slideId") ?? "slide-1";
  const presentationId = searchParams.get("presentationId") ?? undefined;

  return (
    <EditorPage
      key={`${presentationId ?? "default"}-${slideId}`}
      params={{ id: slideId }}
    />
  );
}
