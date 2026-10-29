"use strict";

/**
 * The Thunderbird side of the add-on: read the compose window, convert on send,
 * and keep the toolbar button in a sensible state.
 *
 * All listeners are registered at the top level, because this is a Manifest V3
 * event page and may be restarted between events.
 */

/**
 * Assemble the message that will actually be sent.
 *
 * @param {string} bodyHtml The current compose body.
 * @returns {string|null} The converted body, or null if there is nothing to do.
 */
function convertComposeBody(bodyHtml) {
  const { segments, preserved } = segmentComposeBody(bodyHtml);
  if (!segments.some((segment) => segment.markdown)) return null;

  const body = segments
    .map((segment) =>
      segment.markdown
        ? restorePreserved(renderMarkdown(segment.markdown), preserved)
        : segment.html,
    )
    .join("");
  return `<html><body>${body}</body></html>`;
}

browser.compose.onBeforeSend.addListener(async (tab, details) => {
  // The compose format of an open window cannot be changed, so a plain text
  // message is sent exactly as written.
  if (details.isPlainText) return {};

  // The compose script owns the per-window on/off flag. A window that has been
  // switched off is sent exactly as written. If the script cannot be reached,
  // fall back to converting, which is the default behaviour.
  const state = await browser.tabs
    .sendMessage(tab.id, { type: "mdc:get" })
    .catch(() => null);
  if (state && state.active === false) return {};

  const body = convertComposeBody(details.body);
  return body ? { details: { body } } : {};
});

/** Compositions that are laid out when they open. */
const LAYOUT_TYPES = new Set(["new", "reply", "forward"]);

/**
 * How a compose window that has just opened should be laid out, or null to
 * leave it alone.
 *
 * Asked by the compose script when its window opens. A draft is skipped
 * because it was saved already laid out, with the footer in it if you kept it.
 *
 * @returns {Promise<{footer: string}|null>}
 */
async function layoutFor(tabId) {
  const details = await browser.compose.getComposeDetails(tabId);
  if (details.isPlainText || !LAYOUT_TYPES.has(details.type)) return null;

  const { footer = "" } = await browser.storage.local.get("footer");
  return { footer: footer.trim() };
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "mdc:layout" && sender.tab) {
    return layoutFor(sender.tab.id);
  }
});

/** Markdown conversion only applies to HTML compositions; show that in the UI. */
async function updateComposeAction(tabId) {
  try {
    const details = await browser.compose.getComposeDetails(tabId);
    if (details.isPlainText) {
      await browser.composeAction.disable(tabId);
    } else {
      await browser.composeAction.enable(tabId);
    }
  } catch (error) {
    // The tab was closed, or is not a compose tab after all.
  }
}

browser.tabs.onCreated.addListener((tab) => {
  if (tab.type === "messageCompose") updateComposeAction(tab.id);
});
