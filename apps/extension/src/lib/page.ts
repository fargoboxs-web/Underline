import type { PagePayload } from "@underline/shared";

export interface ParagraphDescriptor {
  element: HTMLElement;
  index: number;
  domPath: string;
  rawText: string;
  text: string;
  tagName: string;
  className: string;
  parentTagName: string;
  lang: string;
  dir: string;
}

export interface BridgePresentationTemplate {
  tagName: string;
  className: string;
  parentTagName: string;
  lang: string;
  dir: string;
  inlineStyles: Record<string, string>;
}

const PARAGRAPH_SELECTOR = "article p, main p, p, li, blockquote";
const MANAGED_SELECTOR = "[data-underline-ui], [data-underline-bridge]";

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hashString(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return Math.abs(hash >>> 0).toString(16);
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function isManaged(element: HTMLElement): boolean {
  return Boolean(element.closest(MANAGED_SELECTOR));
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  return url.toString();
}

export function getDomPath(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    const parentElement: Element | null = current.parentElement;

    if (!parentElement) {
      break;
    }

    const currentTagName = current.tagName;
    const siblings = Array.from(parentElement.children).filter(
      (candidate: Element) => candidate.tagName === currentTagName
    );
    const siblingIndex = siblings.indexOf(current) + 1;
    segments.unshift(`${current.tagName.toLowerCase()}[${siblingIndex}]`);
    current = parentElement;
  }

  return ["body", ...segments].join("/");
}

export function findElementByDomPath(path: string): HTMLElement | null {
  const segments = path.split("/").filter(Boolean);

  if (!segments.length || segments[0] !== "body") {
    return null;
  }

  let current: Element = document.body;

  for (const segment of segments.slice(1)) {
    const match = /^([a-z0-9-]+)\[(\d+)\]$/i.exec(segment);

    if (!match) {
      return null;
    }

    const [, tag, indexText] = match;
    const sameTagChildren = Array.from(current.children).filter(
      (candidate) => candidate.tagName.toLowerCase() === tag.toLowerCase()
    );
    const next = sameTagChildren[Number(indexText) - 1];

    if (!next) {
      return null;
    }

    current = next;
  }

  return current instanceof HTMLElement ? current : null;
}

export function getCandidateParagraphs(root: Document = document): ParagraphDescriptor[] {
  return Array.from(root.querySelectorAll<HTMLElement>(PARAGRAPH_SELECTOR))
    .filter((element) => !isManaged(element))
    .filter((element) => isVisible(element))
    .map((element) => ({
      element,
      rawText: element.textContent ?? "",
      text: normalizeText(element.textContent ?? ""),
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      parentTagName: element.parentElement?.tagName.toLowerCase() ?? "",
      lang: element.lang || "",
      dir: element.dir || ""
    }))
    .filter((candidate) => candidate.text.length >= 24)
    .map((candidate, index) => ({
      ...candidate,
      index,
      domPath: getDomPath(candidate.element)
    }));
}

export function computeArticleFingerprint(paragraphs: ParagraphDescriptor[]): string {
  const sample = paragraphs.slice(0, 12).map((paragraph) => paragraph.text).join("||");
  return hashString(sample || document.title || location.pathname);
}

export function detectPageLanguage(root: Document = document): string {
  const declared = root.documentElement.lang?.trim();

  if (declared) {
    return declared;
  }

  return navigator.language || "en";
}

export function buildPagePayload(normalizedUrl: string, fingerprint: string): PagePayload {
  return {
    url: normalizedUrl,
    title: document.title || location.hostname,
    hostname: location.hostname,
    articleFingerprint: fingerprint,
    language: detectPageLanguage()
  };
}

const CLONED_STYLE_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "color",
  "text-indent",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "max-width"
] as const;

export function buildBridgePresentationTemplate(
  paragraph: ParagraphDescriptor
): BridgePresentationTemplate {
  const computedStyle = window.getComputedStyle(paragraph.element);
  const inlineStyles = Object.fromEntries(
    CLONED_STYLE_PROPERTIES.map((propertyName) => [
      propertyName,
      computedStyle.getPropertyValue(propertyName)
    ]).filter((entry) => entry[1])
  );

  return {
    tagName: paragraph.tagName,
    className: paragraph.className,
    parentTagName: paragraph.parentTagName,
    lang: paragraph.lang,
    dir: paragraph.dir,
    inlineStyles
  };
}

export function applyBridgePresentationTemplate(
  element: HTMLElement,
  template: BridgePresentationTemplate
): void {
  if (template.className) {
    element.className = template.className;
  }

  if (template.lang) {
    element.lang = template.lang;
  }

  if (template.dir) {
    element.dir = template.dir;
  }

  for (const [propertyName, propertyValue] of Object.entries(template.inlineStyles)) {
    if (propertyValue) {
      element.style.setProperty(propertyName, propertyValue);
    }
  }
}
