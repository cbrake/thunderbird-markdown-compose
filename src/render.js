"use strict";

/**
 * Markdown source in, HTML string out.
 *
 * This file touches no Thunderbird APIs, so it can be exercised from Node with
 * `node --test`. Keep it that way: anything that needs the compose window
 * belongs in background.js.
 *
 * Depends on the globals `markdownit` (vendor/markdown-it.min.js) and
 * `MARKDOWN_STYLES` / `MARKDOWN_BODY_STYLE` (src/style.js).
 */

/**
 * An image title holding nothing but dimensions, as in `![](photo.png "400x")`.
 *
 * Markdown has no syntax for image size, and the alternatives all need a parser
 * extension: `=400x` stops markdown-it recognising the image at all, and
 * Pandoc's `{width=400}` is left behind as stray text. The title is the one
 * slot the parser already hands over, and a title of `400x` is a size request
 * rather than a tooltip anyone meant to write.
 */
const IMAGE_SIZE = /^(\d*)x(\d*)$/;

/**
 * Move an explicit size out of an image's title and into its attributes.
 *
 * Sizes go in attributes rather than in CSS because Outlook renders mail
 * through Word, which honours `width` and `height` but ignores their CSS
 * equivalents.
 *
 * @param {object} token A markdown-it `image` token, modified in place.
 * @returns {string|null} The style the image should carry, or null if it asked
 *   for no particular size and should be styled like any other tag.
 */
function applyImageSize(token) {
  const size = IMAGE_SIZE.exec(token.attrGet("title") ?? "");
  if (!size) return null;

  const [, width, height] = size;
  if (!width && !height) return null;

  token.attrs.splice(token.attrIndex("title"), 1);
  if (width) token.attrSet("width", width);
  if (height) token.attrSet("height", height);

  return height
    ? MARKDOWN_SIZED_IMAGE_STYLES.height
    : MARKDOWN_SIZED_IMAGE_STYLES.width;
}

const markdownRenderer = (function createRenderer() {
  const md = markdownit({
    html: false, // raw HTML in the source is escaped, not passed through
    linkify: true,
    breaks: false,
  });

  const applyStyle = (token) => {
    // An image that named its own size carries a style of its own, stored by
    // the rule below because renderToken is what finally emits the attributes.
    const style = token.meta?.style ?? MARKDOWN_STYLES[token.tag];
    if (style && token.nesting !== -1) {
      token.attrJoin("style", style);
    }
  };

  // Images reach renderToken through their own rule, which is the last chance
  // to read the title before it is emitted as an attribute.
  const renderImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const style = applyImageSize(tokens[idx]);
    if (style) tokens[idx].meta = { ...tokens[idx].meta, style };
    return renderImage(tokens, idx, options, env, self);
  };

  // Most block and inline tokens are emitted by renderToken.
  const renderToken = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, idx, options) => {
    applyStyle(tokens[idx]);
    return renderToken(tokens, idx, options);
  };

  // A few token types have dedicated rules that bypass renderToken. Each of
  // them still emits the token's attributes, so styling them the same way works.
  // Images are absent deliberately: their rule ends by calling renderToken, so
  // listing them here would apply the style a second time.
  for (const rule of ["code_inline", "code_block", "fence"]) {
    const base = md.renderer.rules[rule];
    md.renderer.rules[rule] = (tokens, idx, options, env, self) => {
      applyStyle(tokens[idx]);
      return base(tokens, idx, options, env, self);
    };
  }

  return md;
})();

/**
 * Render Markdown source to a styled HTML fragment.
 *
 * @param {string} source Markdown text.
 * @returns {string} HTML, with styling inlined on each element.
 */
function renderMarkdown(source) {
  const html = markdownRenderer
    .render(source)
    // Code blocks render as <pre><code>; only the <code> carries a token, so
    // the wrapper is styled here.
    .replace(/<pre>/g, `<pre style="${MARKDOWN_STYLES.pre}">`);

  return `<div style="${MARKDOWN_BODY_STYLE}">\n${html}</div>`;
}

/**
 * The marker left in the Markdown source in place of an element that has to
 * survive rendering untouched. Braces carry no meaning in Markdown, so the
 * marker passes through the renderer as ordinary text.
 *
 * @param {number} index Position in the preserved list.
 * @returns {string}
 */
function placeholderFor(index) {
  return `{{markdown-compose-${index}}}`;
}

/**
 * Put preserved elements back into rendered HTML.
 *
 * @param {string} html Output of renderMarkdown().
 * @param {string[]} preserved Elements set aside by segmentComposeBody().
 * @returns {string}
 */
function restorePreserved(html, preserved) {
  return html.replace(
    /\{\{markdown-compose-(\d+)\}\}/g,
    (marker, index) => preserved[Number(index)] ?? marker,
  );
}
