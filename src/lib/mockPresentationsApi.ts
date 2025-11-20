type SlideSummary = {
  id: string;
  title: string;
  subtitle: string;
};

export type PresentationRecord = {
  presentationId: string;
  title: string;
  owner: string;
  lastUpdated: string;
  status: "Draft" | "Final";
  slides: SlideSummary[];
};

// All dummy data removed - this file should use Firestore instead
let mockPresentations: PresentationRecord[] = [];

const simulateDelay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchPresentations(): Promise<PresentationRecord[]> {
  await simulateDelay();
  return mockPresentations.map((record) => ({ ...record, slides: record.slides.map((slide) => ({ ...slide })) }));
}

export async function createPresentation(record: PresentationRecord): Promise<void> {
  await simulateDelay(250);
  mockPresentations = [record, ...mockPresentations];
}

export async function deletePresentation(presentationId: string): Promise<void> {
  await simulateDelay(250);
  mockPresentations = mockPresentations.filter((record) => record.presentationId !== presentationId);
}

