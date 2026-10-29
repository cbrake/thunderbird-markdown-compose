"use strict";

/**
 * Laying out a new compose window: where the footer goes, and where you write.
 *
 * The footer is written into the body as Markdown source, like anything you
 * type, so you can edit or delete it before sending. It goes above the first
 * block Thunderbird generated, which on a reply puts it between your text and
 * the quoted message rather than below the quote.
 *
 * A reply to a passage you selected is answered below that passage instead:
 * the cursor and the footer move under the quote, so the reply reads as an
 * answer to the lines above it.
 *
 * Depends on `markdownToEditorHtml` from src/paste.js, which the compose script
 * declaration loads first.
 */

/**
 * Blocks the footer is placed above. These are the generated elements that
 * src/source.js passes through untouched (`PRESERVED_SELECTOR`).
 */
const FOOTER_BEFORE_SELECTOR = [
  "blockquote[type=cite]",
  ".moz-cite-prefix",
  ".moz-signature",
  ".moz-forward-container",
].join(",");

/**
 * What a quote of a whole message starts with. Thunderbird opens it with the
 * original's content-type `<meta>` for an HTML message, or with its own wrapper
 * for a plain text one. A quote of a selection starts with the selected
 * content itself.
 */
const WHOLE_MESSAGE_QUOTE_SELECTOR = [
  "meta",
  ".moz-text-html",
  ".moz-text-flowed",
  ".moz-text-plain",
  "pre.moz-quote-pre",
].join(",");

/** Whether a quote holds a selected passage rather than the whole message. */
function quotesSelection(quote) {
  const first = [...quote.childNodes].find(
    (node) => node.nodeType !== node.TEXT_NODE || node.nodeValue.trim(),
  );
  return !first?.matches?.(WHOLE_MESSAGE_QUOTE_SELECTOR);
}

/** Whether a top-level node holds nothing anyone typed. */
function isBlank(node) {
  if (node.nodeType === node.TEXT_NODE) return !node.nodeValue.trim();
  return (
    node.nodeType === node.ELEMENT_NODE &&
    !node.matches(FOOTER_BEFORE_SELECTOR) &&
    !node.textContent.trim() &&
    !node.querySelector("img")
  );
}

/** Build the footer block. */
function footerBlock(footer) {
  const block = document.createElement("div");
  block.className = "mdc-footer";
  // The leading break keeps a blank line between your text and the footer, so
  // the two render as separate paragraphs.
  block.innerHTML = `<br>${markdownToEditorHtml(footer)}`;
  return block;
}

/**
 * Move the cursor, and the footer if there is one, below a quoted selection.
 *
 * @param {Element} quote The top-level quote of the selection.
 * @param {string} footer Markdown source; may be blank.
 */
function answerBelow(quote, footer) {
  // Thunderbird leaves an empty line above the cite line for a reply on top.
  // Nothing has been typed there yet, so it is removed rather than sent.
  while (document.body.firstChild && isBlank(document.body.firstChild)) {
    document.body.firstChild.remove();
  }

  const cursor = document.createElement("div");
  cursor.className = "mdc-cursor";
  cursor.appendChild(document.createElement("br"));
  quote.after(cursor);
  if (footer) cursor.after(footerBlock(footer));

  const range = document.createRange();
  range.setStart(cursor, 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  cursor.scrollIntoView({ block: "center" });
}

/**
 * Lay out a compose window that has just opened.
 *
 * @param {string} footer Markdown source; may be blank.
 */
function layoutCompose(footer) {
  // A reloaded add-on injects this script again into windows already open.
  if (document.querySelector(".mdc-footer, .mdc-cursor")) return;

  const top = [...document.body.children];
  const quote = top.find((element) => element.matches("blockquote[type=cite]"));
  if (quote && quotesSelection(quote)) {
    answerBelow(quote, footer);
    return;
  }

  if (!footer) return;
  const before = top.find((element) => element.matches(FOOTER_BEFORE_SELECTOR));
  document.body.insertBefore(footerBlock(footer), before ?? null);
}

// Only the background page can tell what kind of composition this is: a new
// message, reply, or forward is laid out, and a reopened draft is left as saved.
browser.runtime
  .sendMessage({ type: "mdc:layout" })
  .then((reply) => {
    if (reply) layoutCompose(reply.footer);
  })
  .catch(() => {});
