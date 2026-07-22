"use strict";

/**
 * Recovering Markdown source from the compose editor's HTML.
 *
 * The editor stores what you type as HTML: line breaks become `<br>`, lines may
 * be wrapped in `<div>`, and runs of spaces become non-breaking spaces. This
 * file undoes that, and separates the part of the message you wrote from the
 * parts Thunderbird generated (quoted replies, forwards, signatures), which are
 * preserved exactly as they are.
 *
 * Requires a DOM, so it runs in the background page and the preview popup but
 * not under `node --test`.
 */

/** Content from the first match onward is passed through untouched. */
const PRESERVED_SELECTOR = [
  "blockquote[type=cite]",
  ".moz-cite-prefix",
  ".moz-signature",
  ".moz-forward-container",
].join(",");

/** Tags that start and end a line of text. */
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
  "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
  "LI", "MAIN", "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL",
]);

/** Tags that are followed by a blank line. */
const PARAGRAPH_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6"]);

/**
 * Convert a list of DOM nodes back to the plain text that was typed.
 *
 * @param {Iterable<Node>} nodes
 * @returns {string}
 */
function nodesToText(nodes, preserved) {
  let text = "";

  // Ensure the text ends with at least `count` newlines, so that a block
  // boundary never swallows a blank line the author typed.
  const endLine = (count) => {
    if (text.length === 0) return;
    const trailing = /\n*$/.exec(text)[0].length;
    text += "\n".repeat(Math.max(0, count - trailing));
  };

  const walk = (node) => {
    if (node.nodeType === node.TEXT_NODE) {
      // The editor writes non-breaking spaces for leading and repeated
      // spaces, which would otherwise break Markdown indentation.
      text += node.nodeValue.replace(/\u00a0/g, " ");
      return;
    }
    if (node.nodeType !== node.ELEMENT_NODE) return;

    const tag = node.tagName.toUpperCase();
    if (tag === "BR") {
      text += "\n";
      return;
    }
    if (tag === "STYLE" || tag === "SCRIPT") return;
    if (tag === "IMG") {
      // An image pasted from the clipboard arrives as a data: URI that
      // Thunderbird turns into an embedded attachment on send. Markdown has
      // nowhere to put that, so the element is set aside and dropped back into
      // the rendered output afterwards.
      text += placeholderFor(preserved.push(node.outerHTML) - 1);
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) endLine(1);
    for (const child of node.childNodes) walk(child);
    if (isBlock) endLine(PARAGRAPH_TAGS.has(tag) ? 2 : 1);
  };

  for (const node of nodes) walk(node);
  return text;
}

/**
 * Split a compose body into the Markdown you wrote and the generated HTML that
 * follows it.
 *
 * Elements that Markdown cannot express, currently images, are replaced in the
 * source by a placeholder and returned alongside it. Pass the rendered HTML and
 * that list to restorePreserved() to put them back.
 *
 * @param {string} bodyHtml The `body` field of a ComposeDetails object.
 * @returns {{source: string, trailer: string, preserved: string[]}}
 */
function splitComposeBody(bodyHtml) {
  const doc = new DOMParser().parseFromString(bodyHtml, "text/html");
  const children = Array.from(doc.body.childNodes);

  const boundary = children.findIndex(
    (node) =>
      node.nodeType === node.ELEMENT_NODE && node.matches(PRESERVED_SELECTOR),
  );
  const split = boundary === -1 ? children.length : boundary;
  const preserved = [];

  return {
    source: nodesToText(children.slice(0, split), preserved).trim(),
    trailer: children
      .slice(split)
      .map((node) => node.outerHTML ?? node.textContent)
      .join(""),
    preserved,
  };
}
