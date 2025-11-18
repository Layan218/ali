import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AuditEventParams = {
  presentationId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  details?: unknown;
};

export async function logAuditEvent(params: AuditEventParams) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      presentationId: params.presentationId,
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      action: params.action,
      details: params.details ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to write audit log entry:", error);
  }
}

