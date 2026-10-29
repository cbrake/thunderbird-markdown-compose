"use strict";

/**
 * The options page: one Markdown footer, saved as you type.
 *
 * Depends on the global `renderMarkdown` (src/render.js).
 */

/** Show the footer as it will be sent. */
function drawFooter(footer) {
  const preview = document.getElementById("preview");
  // renderMarkdown escapes raw HTML in the source, and this is the author's own
  // text, so this is the same markup that will be sent.
  preview.innerHTML = footer.trim() ? renderMarkdown(footer) : "";
}

async function showOptions() {
  const input = document.getElementById("footer");
  const { footer = "" } = await browser.storage.local.get("footer");

  input.value = footer;
  drawFooter(footer);

  input.addEventListener("input", async () => {
    drawFooter(input.value);
    await browser.storage.local.set({ footer: input.value });
  });
}

showOptions();
