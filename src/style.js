"use strict";

/**
 * Widest an image is laid out in a sent message, in pixels.
 *
 * An image pasted from a web page or a screenshot tool often carries its full
 * intrinsic size, which reads as enormous in a mail window. Wider images are
 * brought down to this; narrower ones are left alone, so a small logo is never
 * blown up to fill the column.
 */
const MAX_IMAGE_WIDTH = 600;

/**
 * Inline styles applied to rendered Markdown, keyed by HTML tag name.
 *
 * These are written into `style` attributes rather than a `<style>` block
 * because many mail clients discard stylesheets. Edit the declarations here to
 * change how sent mail looks; nothing else reads this file.
 */
const MARKDOWN_STYLES = {
  h1: "font-size: 1.6em; font-weight: 600; margin: 1em 0 0.5em;",
  h2: "font-size: 1.35em; font-weight: 600; margin: 1em 0 0.5em;",
  h3: "font-size: 1.15em; font-weight: 600; margin: 1em 0 0.5em;",
  h4: "font-size: 1em; font-weight: 600; margin: 1em 0 0.5em;",
  h5: "font-size: 1em; font-weight: 600; margin: 1em 0 0.5em;",
  h6: "font-size: 1em; font-weight: 600; color: #57606a; margin: 1em 0 0.5em;",
  p: "margin: 0 0 1em;",
  ul: "margin: 0 0 1em; padding-left: 1.8em;",
  ol: "margin: 0 0 1em; padding-left: 1.8em;",
  li: "margin: 0.2em 0;",
  blockquote:
    "margin: 0 0 1em; padding: 0 1em; color: #57606a; border-left: 4px solid #d0d7de;",
  pre: "margin: 0 0 1em; padding: 0.8em; background: #f6f8fa; border-radius: 4px; overflow-x: auto;",
  code: "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em;",
  table: "margin: 0 0 1em; border-collapse: collapse;",
  th: "padding: 0.4em 0.8em; border: 1px solid #d0d7de; background: #f6f8fa; text-align: left;",
  td: "padding: 0.4em 0.8em; border: 1px solid #d0d7de;",
  hr: "margin: 1.5em 0; border: 0; border-top: 1px solid #d0d7de;",
  // The cap is stated twice on purpose. A client that does not understand
  // min() keeps the first declaration and holds the image inside the window; a
  // client that does also holds it to MAX_IMAGE_WIDTH on a wide one. There is
  // no width attribute to fall back on here, because the intrinsic size of an
  // image named only by a URL is unknown at render time.
  img: `max-width: 100%; max-width: min(100%, ${MAX_IMAGE_WIDTH}px); height: auto;`,
  a: "color: #0969da;",
};

/**
 * Styles for an image whose size the author set explicitly, keyed by which
 * dimension was given.
 *
 * The MAX_IMAGE_WIDTH cap is gone from both, because someone who asked for a
 * size has already answered the question the cap exists to answer.
 * `max-width: 100%` stays, so the image still gives way to a narrow window
 * rather than overflowing it.
 */
const MARKDOWN_SIZED_IMAGE_STYLES = {
  // Only a width was asked for, so the height follows the aspect ratio.
  width: "max-width: 100%; height: auto;",
  // A height was asked for, and `height: auto` would override the attribute
  // carrying it.
  height: "max-width: 100%;",
};

/** Style applied to the wrapper element around the whole rendered message. */
const MARKDOWN_BODY_STYLE =
  "font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size: 1em; line-height: 1.5;";
