"use strict";

/**
 * Markdown source in, HTML string out.
 *
 * This file touches no Thunderbird APIs, so it can be exercised from Node with
 * `node --test test/`. Keep it that way: anything that needs the compose window
 * belongs in background.js.
 *
 * Depends on the globals `markdownit` (vendor/markdown-it.min.js) and
 * `MARKDOWN_STYLES` / `MARKDOWN_BODY_STYLE` (src/style.js).
 */

const markdownRenderer = (function createRenderer() {
  const md = markdownit({
    html: false, // raw HTML in the source is escaped, not passed through
    linkify: true,
    breaks: false,
  });

  const applyStyle = (token) => {
    const style = MARKDOWN_STYLES[token.tag];
    if (style && token.nesting !== -1) {
      token.attrJoin("style", style);
    }
  };

  // Most block and inline tokens are emitted by renderToken.
  const renderToken = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, idx, options) => {
    applyStyle(tokens[idx]);
    return renderToken(tokens, idx, options);
  };

  // A few token types have dedicated rules that bypass renderToken. Each of
  // them still emits the token's attributes, so styling them the same way works.
  for (const rule of ["code_inline", "code_block", "fence", "image"]) {
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
