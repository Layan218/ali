import { Suspense } from "react";
import EditorRootPageClient from "./EditorRootPageClient";

export default function EditorRootPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading editor...</div>}>
      <EditorRootPageClient />
    </Suspense>
  );
}
