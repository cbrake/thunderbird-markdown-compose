"use strict";

/**
 * Paste handling, injected into the compose editor.
 *
 * The rest of the add-on assumes the compose window holds Markdown source, so
 * rich text has to become Markdown at the point it arrives rather than on the
 * way out. Pasting a styled table gives you a Markdown table you can edit,
 * and everything downstream stays unchanged.
 *
 * Depends on the globals `TurndownService` and `turndownPluginGfm`, which the
 * compose script declaration loads first.
 */

/**
 * Elements that carry meaning Markdown can express. If a paste contains none
 * of them there is nothing to convert, and the editor's own plain text paste
 * does a better job than a round trip through Turndown would.
 */
const FORMATTING_SELECTOR = [
  "a[href]", "img", "b", "strong", "i", "em", "code", "pre", "blockquote",
  "ul", "ol", "li", "table", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "s", "del", "strike",
].join(",");

const turndown = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});
turndown.use(turndownPluginGfm.gfm);

/**
 * Convert clipboard HTML to Markdown source.
 *
 * @param {string} html The clipboard's `text/html` flavour.
 * @returns {string} Markdown, or an empty string if the paste carries no
 *   formatting worth converting.
 */
function markdownFromClipboard(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.body.querySelector(FORMATTING_SELECTOR)) return "";
  return turndown.turndown(doc.body).trim();
}

/**
 * Render Markdown source as editor HTML.
 *
 * Line breaks become `<br>` and leading spaces become non-breaking spaces,
 * because the editor collapses ordinary ones. src/source.js reverses both when
 * the message is sent.
 *
 * @param {string} markdown
 * @returns {string}
 */
function markdownToEditorHtml(markdown) {
  return markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/^ +/, (spaces) => "&nbsp;".repeat(spaces.length)),
    )
    .join("<br>");
}

document.addEventListener(
  "paste",
  (event) => {
    const html = event.clipboardData?.getData("text/html");
    if (!html) return;

    const markdown = markdownFromClipboard(html);
    if (!markdown) return;

    event.preventDefault();
    // execCommand keeps the paste on the editor's undo stack, so Ctrl+Z
    // behaves the way it does for any other paste.
    document.execCommand("insertHTML", false, markdownToEditorHtml(markdown));
  },
  true,
);
