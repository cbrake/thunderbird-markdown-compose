"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the renderer the way Thunderbird does: plain scripts sharing one global
// scope. This keeps the extension free of a build step and the tests free of
// dependencies.
const context = vm.createContext({});
for (const file of ["vendor/markdown-it.min.js", "src/style.js", "src/render.js"]) {
  const filename = path.join(__dirname, "..", file);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
}
const { renderMarkdown, placeholderFor, restorePreserved } = context;

test("renders headings, emphasis, and links", () => {
  const html = renderMarkdown("# Title\n\nSome **bold** and a [link](https://example.com).");
  assert.match(html, /<h1 style="[^"]*">Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com"/);
});

test("renders lists", () => {
  const html = renderMarkdown("- one\n- two\n");
  assert.match(html, /<ul style="[^"]*">/);
  assert.equal(html.match(/<li style="[^"]*">/g).length, 2);
});

test("renders GitHub-flavored tables", () => {
  const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n");
  assert.match(html, /<table style="[^"]*">/);
  assert.match(html, /<th style="[^"]*">a<\/th>/);
  assert.match(html, /<td style="[^"]*">1<\/td>/);
});

test("styles both halves of a fenced code block", () => {
  const html = renderMarkdown("```\nnpm test\n```\n");
  assert.match(html, /<pre style="[^"]*"><code style="[^"]*">npm test/);
});

test("escapes raw HTML rather than passing it through", () => {
  const html = renderMarkdown('Hello <script>alert("x")</script>');
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("linkifies bare URLs", () => {
  const html = renderMarkdown("See https://example.com for details.");
  assert.match(html, /<a href="https:\/\/example\.com"[^>]*>https:\/\/example\.com<\/a>/);
});

test("wraps output in a styled container", () => {
  const html = renderMarkdown("text");
  assert.match(html, /^<div style="[^"]*line-height/);
  assert.match(html, /<\/div>$/);
});

test("leaves plain paragraphs alone", () => {
  const html = renderMarkdown("Just a sentence.");
  assert.match(html, /<p style="[^"]*">Just a sentence\.<\/p>/);
});

test("carries a placeholder through rendering untouched", () => {
  const html = renderMarkdown(`Chart: ${placeholderFor(0)}`);
  assert.match(html, /Chart: \{\{markdown-compose-0\}\}/);
});

test("restores a preserved element into rendered output", () => {
  const image = '<img src="data:image/png;base64,AAAA" alt="chart">';
  const html = restorePreserved(renderMarkdown(`Chart: ${placeholderFor(0)}`), [image]);
  assert.match(html, /<p style="[^"]*">Chart: <img src="data:image\/png;base64,AAAA" alt="chart"><\/p>/);
});

test("restores several preserved elements in order", () => {
  const source = `${placeholderFor(0)}\n\ntext\n\n${placeholderFor(1)}`;
  const html = restorePreserved(renderMarkdown(source), ["<img src='a'>", "<img src='b'>"]);
  assert.ok(html.indexOf("<img src='a'>") < html.indexOf("<img src='b'>"));
  assert.ok(!html.includes("markdown-compose-"));
});

test("leaves an unmatched placeholder alone rather than dropping content", () => {
  const html = restorePreserved(renderMarkdown(placeholderFor(3)), []);
  assert.match(html, /\{\{markdown-compose-3\}\}/);
});

test("a placeholder on its own line survives block rendering", () => {
  const html = restorePreserved(renderMarkdown(placeholderFor(0)), ["<img src='x'>"]);
  assert.match(html, /<p style="[^"]*"><img src='x'><\/p>/);
});
