"use strict";

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

  const { source, preserved } = splitComposeBody(details.body);
  if (!source) {
    message.textContent = "Nothing to preview yet.";
    return;
  }

  // renderMarkdown escapes raw HTML in the source, and the compose body is the
  // author's own text, so this is the same markup that will be sent.
  preview.innerHTML = restorePreserved(renderMarkdown(source), preserved);
}

showPreview();
