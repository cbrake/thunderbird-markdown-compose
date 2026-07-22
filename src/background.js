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
  const { source, trailer, preserved } = splitComposeBody(bodyHtml);
  if (!source) return null;
  const rendered = restorePreserved(renderMarkdown(source), preserved);
  return `<html><body>${rendered}${trailer}</body></html>`;
}

browser.compose.onBeforeSend.addListener((tab, details) => {
  // The compose format of an open window cannot be changed, so a plain text
  // message is sent exactly as written.
  if (details.isPlainText) return {};

  const body = convertComposeBody(details.body);
  return body ? { details: { body } } : {};
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
