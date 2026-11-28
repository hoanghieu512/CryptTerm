import type { Page } from '@playwright/test';
// On production, Netlify's free plan adds <script src="/.netlify/scripts/hud">, which injects
// iframe#nl-badge-frame (a srcdoc frame). The app CSP blocks the inline style and script in that
// frame, so the console shows two CSP errors per load. Only CSP errors from that frame are ignored.
// The check is made on the frame that produced the message: its element id must be
// nl-badge-frame. The message text alone never decides. Anything unclear is not ignored.
export const BADGE_FRAME_ID = 'nl-badge-frame';
const CSP_TEXT = 'Content Security Policy';
export interface FrameInfo {
  url: string;
  elementId: string | null;
}
export interface ConsoleErrorRecord {
  page: Page;
  sourceUrl: string;
  text: string;
}
// Pure filter. A message comes from the badge frame when every frame that has the message's
// source URL is the badge frame. An about:srcdoc source shared with any other frame is ambiguous
// and is not ignored.
export function isBadgeFrameCspError(sourceUrl: string, text: string, frames: readonly FrameInfo[]): boolean {
  if (!text.includes(CSP_TEXT)) return false;
  const sameSource = frames.filter((f) => f.url === sourceUrl);
  return sameSource.length > 0 && sameSource.every((f) => f.elementId === BADGE_FRAME_ID);
}
async function frameInfosOf(page: Page): Promise<FrameInfo[]> {
  const infos: FrameInfo[] = [];
  for (const frame of page.frames()) {
    let elementId: string | null = null;
    if (frame !== page.mainFrame()) {
      try {
        elementId = await (await frame.frameElement()).getAttribute('id');
      } catch {
        elementId = null;
      }
    }
    infos.push({ url: frame.url(), elementId });
  }
  return infos;
}
// Returns the text of every console error that is not an ignorable badge frame message. Frames are
// read once per page, when the run ends. A page that is gone has no frames, so its errors stay.
export async function unexpectedConsoleErrors(records: readonly ConsoleErrorRecord[]): Promise<string[]> {
  const framesByPage = new Map<Page, FrameInfo[]>();
  const kept: string[] = [];
  for (const record of records) {
    let frames = framesByPage.get(record.page);
    if (!frames) {
      frames = record.page.isClosed() ? [] : await frameInfosOf(record.page);
      framesByPage.set(record.page, frames);
    }
    if (!isBadgeFrameCspError(record.sourceUrl, record.text, frames)) kept.push(record.text);
  }
  return kept;
}
