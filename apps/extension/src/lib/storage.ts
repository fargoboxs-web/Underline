import type {
  BridgeRecord,
  HighlightRecord,
  LearningProfile,
  ProfileSignal
} from "@underline/shared";

export interface ExtensionSettings {
  apiBaseUrl: string;
  requestTimeoutMs: number;
  providerApiUrl: string;
  providerApiKey: string;
  providerModel: string;
  providerTimeoutMs: number;
  providerWireApi: "auto" | "responses" | "chat-completions";
}

export interface PageSession {
  normalizedUrl: string;
  url: string;
  articleFingerprint: string;
  readerModeEnabled: boolean;
  highlights: HighlightRecord[];
  bridges: BridgeRecord[];
  updatedAt: string;
}

export interface CleanArticleCacheRecord {
  normalizedUrl: string;
  url: string;
  title: string;
  articleFingerprint: string;
  rawTextFingerprint: string;
  cleanedText: string;
  cleanedAt: string;
  truncated: boolean;
}

const SETTINGS_KEY = "underline:settings";
const PROFILE_KEY = "underline:profile";
const SIGNALS_KEY = "underline:signals";
const PAGE_PREFIX = "underline:page:";
const CLEAN_ARTICLE_PREFIX = "underline:clean-article:";

function pageKey(normalizedUrl: string): string {
  return `${PAGE_PREFIX}${encodeURIComponent(normalizedUrl)}`;
}

export function cleanArticleKey(normalizedUrl: string, articleFingerprint: string): string {
  return `${CLEAN_ARTICLE_PREFIX}${encodeURIComponent(normalizedUrl)}:${encodeURIComponent(articleFingerprint)}`;
}

function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function storageSet<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: "http://localhost:8787",
  requestTimeoutMs: 30_000,
  providerApiUrl: "https://api.openai.com/v1/chat/completions",
  providerApiKey: "",
  providerModel: "",
  providerTimeoutMs: 30_000,
  providerWireApi: "auto"
};

export function createDefaultProfile(): LearningProfile {
  return {
    discipline: "Non-technical learner",
    roleContext: "Curious reader crossing into new domains",
    technicalFamiliarity: "low",
    explanationPreference: "balanced",
    updatedAt: new Date().toISOString()
  };
}

export function createEmptyPageSession(
  normalizedUrl: string,
  url: string,
  articleFingerprint: string
): PageSession {
  return {
    normalizedUrl,
    url,
    articleFingerprint,
    readerModeEnabled: false,
    highlights: [],
    bridges: [],
    updatedAt: new Date().toISOString()
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  return (await storageGet<ExtensionSettings>(SETTINGS_KEY)) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await storageSet(SETTINGS_KEY, settings);
}

export async function getProfile(): Promise<LearningProfile> {
  return (await storageGet<LearningProfile>(PROFILE_KEY)) ?? createDefaultProfile();
}

export async function saveProfile(profile: LearningProfile): Promise<void> {
  await storageSet(PROFILE_KEY, {
    ...profile,
    updatedAt: new Date().toISOString()
  });
}

export async function getPageSession(normalizedUrl: string): Promise<PageSession | null> {
  return (await storageGet<PageSession>(pageKey(normalizedUrl))) ?? null;
}

export async function savePageSession(session: PageSession): Promise<void> {
  await storageSet(pageKey(session.normalizedUrl), {
    ...session,
    updatedAt: new Date().toISOString()
  });
}

export async function getCleanArticleCache(
  normalizedUrl: string,
  articleFingerprint: string
): Promise<CleanArticleCacheRecord | null> {
  return (await storageGet<CleanArticleCacheRecord>(
    cleanArticleKey(normalizedUrl, articleFingerprint)
  )) ?? null;
}

export async function getCleanArticleByStorageKey(
  storageKey: string
): Promise<CleanArticleCacheRecord | null> {
  if (!storageKey.startsWith(CLEAN_ARTICLE_PREFIX)) {
    return null;
  }

  return (await storageGet<CleanArticleCacheRecord>(storageKey)) ?? null;
}

export async function saveCleanArticleCache(record: CleanArticleCacheRecord): Promise<string> {
  const key = cleanArticleKey(record.normalizedUrl, record.articleFingerprint);
  await storageSet(key, record);
  return key;
}

export async function getSignals(limit = 8): Promise<ProfileSignal[]> {
  const signals = (await storageGet<ProfileSignal[]>(SIGNALS_KEY)) ?? [];
  return signals.slice(-limit);
}

export async function appendSignals(newSignals: ProfileSignal[]): Promise<void> {
  const current = (await storageGet<ProfileSignal[]>(SIGNALS_KEY)) ?? [];
  const next = [...current, ...newSignals].slice(-50);
  await storageSet(SIGNALS_KEY, next);
}
