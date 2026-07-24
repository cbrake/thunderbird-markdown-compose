"use strict";

/**
 * Build a frame holding markup that is sent exactly as it stands.
 *
 * This markup comes from whoever wrote the original message, and this popup can
 * reach the browser.* APIs, so it goes into a sandboxed frame rather than into
 * this document. The sandbox attribute blocks scripts, and the frame's own
 * policy blocks remote loads, so a tracking pixel in a quoted message cannot
 * report that you opened the preview.
 *
 * @param {string} html
 * @returns {HTMLIFrameElement}
 */
function passThroughFrame(html) {
  const frame = document.createElement("iframe");
  frame.className = "pass-through";
  frame.setAttribute("sandbox", "");
  frame.srcdoc =
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ` +
    `img-src data:; style-src 'unsafe-inline'">${html}`;
  return frame;
}

/** Build a block of rendered Markdown. */
function renderedBlock(markdown, preserved) {
  const block = document.createElement("div");
  // renderMarkdown escapes raw HTML in the source, and this is the author's own
  // text, so this is the same markup that will be sent.
  block.innerHTML = restorePreserved(renderMarkdown(markdown), preserved);
  return block;
}

/**
 * Reflect a window's on/off state on the toolbar button with a badge.
 *
 * The button icon itself cannot change to show state: Thunderbird only applies
 * `context-fill` theming to manifest-declared action icons, so an icon set at
 * runtime rasterises blank. A per-tab badge is themed by Thunderbird and shows
 * on any toolbar, so a switched-off window is marked "off" instead.
 *
 * @param {number} tabId
 * @param {boolean} active
 */
async function showBadge(tabId, active) {
  await browser.composeAction.setBadgeText({ tabId, text: active ? "" : "off" });
  if (!active) {
    await browser.composeAction.setBadgeBackgroundColor({
      tabId,
      color: "#d73a49",
    });
  }
}

/** Show the current compose body as it will be sent. */
async function showPreview() {
  const message = document.getElementById("message");
  const preview = document.getElementById("preview");
  const toggle = document.getElementById("toggle");
  const toggleInput = document.getElementById("toggle-input");

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const details = await browser.compose.getComposeDetails(tab.id);

  if (details.isPlainText) {
    message.textContent =
      "This message is in plain text mode, so it will be sent as written.";
    return;
  }

  // The compose script owns the flag; default to active if it cannot be reached.
  const state = await browser.tabs
    .sendMessage(tab.id, { type: "mdc:get" })
    .catch(() => null);
  let active = !(state && state.active === false);

  // Re-assert the badge from the authoritative flag, so it self-corrects.
  await showBadge(tab.id, active);

  toggle.hidden = false;
  toggleInput.checked = active;

  // Redraw message and preview for the current state.
  const draw = () => {
    message.textContent = "";
    preview.replaceChildren();

    if (!active) {
      message.textContent =
        "Conversion is off — this message will be sent as written.";
      return;
    }

    const { segments, preserved } = segmentComposeBody(details.body);
    if (!segments.some((segment) => segment.markdown)) {
      message.textContent = "Nothing to preview yet.";
    }

    // Segments are in document order, so writing above a quote, below it, or
    // both previews the way the message will actually read.
    for (const segment of segments) {
      preview.appendChild(
        segment.markdown
          ? renderedBlock(segment.markdown, preserved)
          : passThroughFrame(segment.html),
      );
    }
  };

  toggleInput.addEventListener("change", async () => {
    active = toggleInput.checked;
    await browser.tabs.sendMessage(tab.id, { type: "mdc:set", active });
    await showBadge(tab.id, active);
    draw();
  });

  draw();
}

showPreview();
