'use client';

export type SlideMeta = {
  id: string;
  title?: string;
  subtitle?: string;
  notes?: string;
  textBlocks?: Array<{ text?: string } | string | null | undefined>;
  items?: Array<{ text?: string } | string | null | undefined>;
};

export type PresentationMeta = {
  id: string;
  title: string;
  updatedAt: string | null;
  isSaved: boolean;
  searchIndex?: string;
  status: "draft" | "final";
};

export const PRESENTATION_META_STORAGE_KEY = "presentationMeta";
export const PRESENTATION_META_UPDATED_EVENT = "presentationMeta:updated";

const sanitizeEntry = (entry: Partial<PresentationMeta>): PresentationMeta | null => {
  if (!entry || typeof entry !== "object") return null;
  const id = typeof entry.id === "string" ? entry.id : null;
  if (!id) return null;
  const title =
    typeof entry.title === "string" && entry.title.trim().length > 0
      ? entry.title
      : "Untitled presentation";
  const updatedAt =
    typeof entry.updatedAt === "string" && entry.updatedAt.trim().length > 0 ? entry.updatedAt : null;
  const isSaved = Boolean(entry.isSaved);
  const searchIndex = typeof entry.searchIndex === "string" ? entry.searchIndex : undefined;
  const status =
    entry?.status === "final" || entry?.status === "draft" ? entry.status : "draft";
  return { id, title, updatedAt, isSaved, searchIndex, status };
};

const writeMeta = (items: PresentationMeta[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESENTATION_META_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(PRESENTATION_META_UPDATED_EVENT));
  } catch (error) {
    console.error("Failed to write presentation meta", error);
  }
};

export const readPresentationMeta = (): PresentationMeta[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESENTATION_META_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed
      .map((item) => sanitizeEntry(item))
      .filter((item): item is PresentationMeta => item != null);
    return sanitized;
  } catch (error) {
    console.error("Failed to read presentation meta", error);
    return [];
  }
};

const upsertMeta = (entry: PresentationMeta) => {
  if (typeof window === "undefined") return;
  const existing = readPresentationMeta();
  const filtered = existing.filter((item) => item.id !== entry.id);
  const updated = [entry, ...filtered];
  writeMeta(updated);
};

export const recordPresentationDraft = (id: string, title: string) => {
  if (typeof window === "undefined" || !id) return;
  const existing = readPresentationMeta();
  const current = existing.find((item) => item.id === id);
  const entry: PresentationMeta = {
    id,
    title: title?.trim().length ? title : current?.title ?? "Untitled presentation",
    updatedAt: current?.updatedAt ?? new Date().toLocaleString(),
    isSaved: current?.isSaved ?? false,
    searchIndex: current?.searchIndex,
    status: current?.status ?? "draft",
  };
  upsertMeta(entry);
};

const normalizeText = (value: string): string =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collectTextSegmentsFromSlide = (slide: SlideMeta): string[] => {
  const segments: string[] = [];
  if (typeof slide.title === "string") {
    const normalized = normalizeText(slide.title);
    if (normalized) segments.push(normalized);
  }
  if (typeof slide.subtitle === "string") {
    const normalized = normalizeText(slide.subtitle);
    if (normalized) segments.push(normalized);
  }
  if (typeof slide.notes === "string") {
    const normalized = normalizeText(slide.notes);
    if (normalized) segments.push(normalized);
  }
  if (Array.isArray(slide.textBlocks)) {
    for (const block of slide.textBlocks) {
      if (typeof block === "string") {
        const normalized = normalizeText(block);
        if (normalized) segments.push(normalized);
      } else if (block && typeof block.text === "string") {
        const normalized = normalizeText(block.text);
        if (normalized) segments.push(normalized);
      }
    }
  }
  if (Array.isArray(slide.items)) {
    for (const item of slide.items) {
      if (typeof item === "string") {
        const normalized = normalizeText(item);
        if (normalized) segments.push(normalized);
      } else if (item && typeof item.text === "string") {
        const normalized = normalizeText(item.text);
        if (normalized) segments.push(normalized);
      }
    }
  }
  return segments;
};

export const buildSearchIndex = (title: string, slides: SlideMeta[]): string => {
  const parts: string[] = [];
  if (title) {
    const normalizedTitle = normalizeText(title);
    if (normalizedTitle) parts.push(normalizedTitle);
  }
  for (const slide of slides) {
    parts.push(...collectTextSegmentsFromSlide(slide));
  }
  return parts
    .join(" ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const markPresentationSaved = (
  id: string,
  title: string,
  slides: SlideMeta[],
  status: "draft" | "final"
) => {
  if (typeof window === "undefined" || !id) return;
  const existing = readPresentationMeta();
  const current = existing.find((item) => item.id === id);
  const entry: PresentationMeta = {
    id,
    title: title?.trim().length ? title : current?.title ?? "Untitled presentation",
    updatedAt: new Date().toLocaleString(),
    isSaved: true,
    searchIndex: buildSearchIndex(title, slides),
    status,
  };
  upsertMeta(entry);
};

export const updatePresentationStatus = (id: string, status: "draft" | "final") => {
  if (typeof window === "undefined" || !id) return;
  const existing = readPresentationMeta();
  const current = existing.find((item) => item.id === id);
  if (!current) {
    upsertMeta({
      id,
      title: "Untitled presentation",
      updatedAt: new Date().toLocaleString(),
      isSaved: false,
      status,
      searchIndex: "",
    });
    return;
  }
  upsertMeta({
    ...current,
    status,
  });
};


const EXECUTIVE_SUMMARY_STORAGE_PREFIX = "execSummary:";
const EXECUTIVE_SUMMARY_UPDATED_EVENT = "executive-summary:updated";

type ExecutiveSummaryRecord = {
  title: string;
  author: string;
  summary: string;
  updatedAt: number;
};

export async function getExecutiveSummary(
  id: string
): Promise<{ title?: string; author?: string; summary?: string; updatedAt?: number } | null> {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${EXECUTIVE_SUMMARY_STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExecutiveSummaryRecord> | null;
    if (!parsed) return null;
    const { title, author, summary, updatedAt } = parsed;
    return {
      title: typeof title === "string" ? title : undefined,
      author: typeof author === "string" ? author : undefined,
      summary: typeof summary === "string" ? summary : undefined,
      updatedAt: typeof updatedAt === "number" ? updatedAt : undefined,
    };
  } catch (error) {
    console.error("Failed to load executive summary", error);
    return null;
  }
}

export async function setExecutiveSummary(
  id: string,
  data: { title: string; author: string; summary: string }
): Promise<void> {
  if (!id || typeof window === "undefined") return;
  const record: ExecutiveSummaryRecord = {
    title: data.title,
    author: data.author,
    summary: data.summary,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(`${EXECUTIVE_SUMMARY_STORAGE_PREFIX}${id}`, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent(EXECUTIVE_SUMMARY_UPDATED_EVENT, { detail: { id, record } }));
  } catch (error) {
    console.error("Failed to persist executive summary", error);
  }
}
