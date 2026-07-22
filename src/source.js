"use strict";

/**
 * Recovering Markdown source from the compose editor's HTML.
 *
 * The editor stores what you type as HTML: line breaks become `<br>`, lines may
 * be wrapped in `<div>`, and runs of spaces become non-breaking spaces. This
 * file undoes that, and separates the parts of the message you wrote from the
 * parts Thunderbird generated (quoted replies, forwards, signatures), which are
 * preserved exactly as they are.
 *
 * A message is treated as a sequence of segments rather than as a body followed
 * by a quote, so it does not matter whether you write above the quoted message,
 * below it, or both.
 *
 * Requires a DOM, so it runs in the background page and the preview popup but
 * not under `node --test`.
 *
 * Depends on the globals `MARKDOWN_STYLES` / `MAX_IMAGE_WIDTH` (src/style.js)
 * and `placeholderFor` (src/render.js).
 */

/** Elements that are passed through untouched, along with their contents. */
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
 * The width an image asks to be drawn at, or 0 if it does not say.
 *
 * The document here comes from DOMParser, which does not load images, so
 * `naturalWidth` is unavailable and the element's own declarations are all
 * there is to go on.
 *
 * @param {Element} img
 * @returns {number}
 */
function declaredWidth(img) {
  const attribute = Number.parseInt(img.getAttribute("width") ?? "", 10);
  if (attribute > 0) return attribute;

  const inline = /(?:^|;)\s*width\s*:\s*([\d.]+)px/i.exec(
    img.getAttribute("style") ?? "",
  );
  return inline ? Math.round(Number(inline[1])) : 0;
}

/**
 * Serialize an image at a size that suits a mail window.
 *
 * An image wider than MAX_IMAGE_WIDTH is brought down to it, and every image
 * picks up MARKDOWN_STYLES.img so that the ones markdown-it renders and the
 * ones passed through here are laid out alike.
 *
 * The width is set as an attribute rather than as CSS because Outlook renders
 * mail through Word, which honours the attribute and ignores `max-width`. An
 * image that arrives here declares its size, so unlike the ones markdown-it
 * renders, there is a number to put in the attribute.
 *
 * This governs display size only. The image is still sent at its full
 * resolution, so a large screenshot remains a large attachment.
 *
 * @param {Element} img
 * @returns {string} The element's HTML.
 */
function imageHtml(img) {
  const copy = img.cloneNode(false);
  let style = copy.getAttribute("style") ?? "";

  if (declaredWidth(copy) > MAX_IMAGE_WIDTH) {
    copy.setAttribute("width", String(MAX_IMAGE_WIDTH));
    // A declared height would hold the original aspect ratio's pixel count and
    // squash the image, and a declared width would win over the attribute.
    copy.removeAttribute("height");
    style = style.replace(/(?:^|;)\s*(?:width|height)\s*:[^;]*/gi, "");
  }

  copy.setAttribute(
    "style",
    `${style};${MARKDOWN_STYLES.img}`.replace(/^[;\s]+/, ""),
  );
  return copy.outerHTML;
}

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
      text += placeholderFor(preserved.push(imageHtml(node)) - 1);
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
 * Split a compose body into alternating segments of your Markdown and of
 * generated HTML to pass through.
 *
 * Each segment is either `{markdown: string}`, holding source you wrote, or
 * `{html: string}`, holding markup to send exactly as it stands. They are in
 * document order, so reassembling them in order rebuilds the message.
 *
 * Elements that Markdown cannot express, currently images, are replaced in the
 * source by a placeholder and collected in `preserved`. Pass rendered HTML and
 * that list to restorePreserved() to put them back.
 *
 * @param {string} bodyHtml The `body` field of a ComposeDetails object.
 * @returns {{segments: Array<{markdown?: string, html?: string}>,
 *            preserved: string[]}}
 */
function segmentComposeBody(bodyHtml) {
  const doc = new DOMParser().parseFromString(bodyHtml, "text/html");
  const preserved = [];
  const segments = [];

  const isPassThrough = (node) =>
    node.nodeType === node.ELEMENT_NODE && node.matches(PRESERVED_SELECTOR);

  // Group consecutive nodes of the same kind, so a quoted reply and the cite
  // line above it stay together as one block to pass through.
  for (const node of doc.body.childNodes) {
    const passThrough = isPassThrough(node);
    const last = segments[segments.length - 1];

    if (last && last.passThrough === passThrough) {
      last.nodes.push(node);
    } else {
      segments.push({ passThrough, nodes: [node] });
    }
  }

  return {
    preserved,
    segments: segments.map((segment) => {
      const html = segment.nodes
        .map((node) => node.outerHTML ?? node.textContent)
        .join("");
      if (segment.passThrough) return { html };

      // A run holding nothing but spacing is kept as it stands, so the blank
      // line between your text and a quote survives.
      const markdown = nodesToText(segment.nodes, preserved).trim();
      return markdown ? { markdown } : { html };
    }),
  };
}
