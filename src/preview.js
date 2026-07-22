"use strict";

/**
 * Show the quoted reply and signature exactly as they will be sent.
 *
 * This markup comes from whoever wrote the original message, and this popup can
 * reach the browser.* APIs, so it goes into a sandboxed frame rather than into
 * this document. The sandbox attribute blocks scripts, and the frame's own
 * policy blocks remote loads, so a tracking pixel in a quoted message cannot
 * report that you opened the preview.
 *
 * @param {string} trailer Passed-through HTML from splitComposeBody().
 */
function showQuoted(trailer) {
  if (!trailer.trim()) return;

  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "");
  frame.srcdoc =
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ` +
    `img-src data:; style-src 'unsafe-inline'">${trailer}`;

  document.getElementById("quoted-label").hidden = false;
  document.getElementById("quoted").appendChild(frame);
}

/** Show the current compose body as it will be sent. */
async function showPreview() {
  const message = document.getElementById("message");
  const preview = document.getElementById("preview");

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const details = await browser.compose.getComposeDetails(tab.id);

  if (details.isPlainText) {
    message.textContent =
      "This message is in plain text mode, so it will be sent as written.";
    return;
  }

  const { source, trailer, preserved } = splitComposeBody(details.body);

  if (source) {
    // renderMarkdown escapes raw HTML in the source, and the compose body is
    // the author's own text, so this is the same markup that will be sent.
    preview.innerHTML = restorePreserved(renderMarkdown(source), preserved);
  } else {
    message.textContent = "Nothing to preview yet.";
  }

  showQuoted(trailer);
}

showPreview();
