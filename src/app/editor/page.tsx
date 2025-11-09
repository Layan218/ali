"use client";

import { useSearchParams } from "next/navigation";
import EditorPage from "./[id]/page";

export default function EditorRootPage() {
  const searchParams = useSearchParams();
  const slideId = searchParams.get("slideId") ?? "slide-1";

  return <EditorPage params={{ id: slideId }} />;
}
