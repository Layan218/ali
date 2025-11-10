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

let mockPresentations: PresentationRecord[] = [
  {
    presentationId: "presentation-deep-learning",
    title: "Lab Manual: Introduction to Deep Learning",
    owner: "Aramco Digital",
    lastUpdated: "2025-06-18T09:00:00.000Z",
    status: "Draft",
    slides: [
      {
        id: "slide-1",
        title: "Overview",
        subtitle: "What we will cover today",
      },
    ],
  },
  {
    presentationId: "presentation-dbms",
    title: "Advanced Coding & Databases for AI & Data Science",
    owner: "Shared Workspace",
    lastUpdated: "2024-12-15T11:00:00.000Z",
    status: "Final",
    slides: [
      {
        id: "slide-1",
        title: "Recap",
        subtitle: "Where we left off",
      },
    ],
  },
];

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

