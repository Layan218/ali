"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import EditorPage from "./[id]/page";

function EditorRootContent() {
  const searchParams = useSearchParams();
  const slideId = searchParams.get("slideId") ?? "slide-1";
  const presentationId = searchParams.get("presentationId") ?? undefined;

  return <EditorPage key={`${presentationId ?? "default"}-${slideId}`} params={{ id: slideId }} />;
}

export default function EditorRootPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "Calibri, Arial, sans-serif" }}>Loading editor…</div>}>
      <EditorRootContent />
    </Suspense>
  );
}
