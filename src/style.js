"use strict";

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
  img: "max-width: 100%;",
  a: "color: #0969da;",
};

/** Style applied to the wrapper element around the whole rendered message. */
const MARKDOWN_BODY_STYLE =
  "font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size: 1em; line-height: 1.5;";
