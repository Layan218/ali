import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { encryptText } from "@/lib/encryption";
import { serverTimestamp } from "firebase/firestore";

type SlideData = {
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  theme: string;
  order: number;
  content?: string;
};

/**
 * Save slides to Firebase Firestore
 */
export async function saveSlidesToFirebase(
  presentationId: string,
  slides: SlideData[]
): Promise<void> {
  if (!presentationId || !slides || slides.length === 0) {
    console.warn("❌ Cannot save slides: missing presentationId or slides", {
      presentationId,
      slidesCount: slides?.length || 0,
    });
    return;
  }

  try {
    console.log(`💾 Saving ${slides.length} slides to Firebase for presentation: ${presentationId}`);
    console.log(`📁 Collection path: presentations/${presentationId}/slides`);

    // First, ensure the presentation document exists
    const presentationRef = doc(db, "presentations", presentationId);
    const presentationSnap = await getDoc(presentationRef);
    
    if (!presentationSnap.exists()) {
      // Create the presentation document if it doesn't exist
      await setDoc(presentationRef, {
        id: presentationId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`✅ Created presentation document: ${presentationId}`);
    } else {
      console.log(`✅ Presentation document already exists: ${presentationId}`);
    }

    // Save each slide to the slides subcollection
    const savePromises = slides.map(async (slide, index) => {
      const slideRef = doc(db, "presentations", presentationId, "slides", slide.id);
      
      // Encrypt sensitive content
      const encryptedTitle = slide.title ? encryptText(slide.title) : "";
      const encryptedContent = slide.subtitle ? encryptText(slide.subtitle) : "";
      const encryptedNotes = slide.notes ? encryptText(slide.notes) : "";

      const slideData = {
        id: slide.id,
        order: slide.order !== undefined ? slide.order : index + 1,
        title: encryptedTitle,
        subtitle: encryptedContent, // Using subtitle field for content
        content: encryptedContent, // Also save as content for compatibility
        notes: encryptedNotes,
        theme: slide.theme || "default",
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        slideRef,
        slideData,
        { merge: true } // Merge to avoid overwriting other fields
      );
      
      console.log(`  ✓ Saved slide ${index + 1}: ${slide.id} (order: ${slideData.order})`);
    });

    await Promise.all(savePromises);
    console.log(`✅ Successfully saved ${slides.length} slides to Firebase`);
    console.log(`📋 Presentation ID: ${presentationId}`);
    console.log(`📁 Full path: presentations/${presentationId}/slides`);
  } catch (error) {
    console.error("❌ Failed to save slides to Firebase:", error);
    console.error("📋 Presentation ID:", presentationId);
    console.error("📊 Slides count:", slides.length);
    throw error;
  }
}

