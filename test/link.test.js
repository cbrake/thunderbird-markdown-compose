"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the link rules the way Thunderbird does: a plain script in a shared
// global scope. src/paste.js, which calls into them, needs the compose window
// and is verified by hand instead.
const context = vm.createContext({});
const filename = path.join(__dirname, "..", "src/link.js");
vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
const { pastedUrl, linkMarkdown } = context;

test("recognises a clipboard holding one URL", () => {
  assert.equal(pastedUrl("https://example.com/docs"), "https://example.com/docs");
  assert.equal(pastedUrl("http://example.com/"), "http://example.com/");
  assert.equal(pastedUrl("mailto:someone@example.com"), "mailto:someone@example.com");
  assert.equal(pastedUrl("  https://example.com \n"), "https://example.com");
});

test("declines clipboards that are not a lone URL", () => {
  assert.equal(pastedUrl("example.com"), "");
  assert.equal(pastedUrl("See https://example.com for more"), "");
  assert.equal(pastedUrl("https://example.com https://example.org"), "");
  assert.equal(pastedUrl("   "), "");
  assert.equal(pastedUrl(""), "");
});

test("wraps the selection in a link", () => {
  assert.equal(
    linkMarkdown("the docs", "https://example.com/docs"),
    "[the docs](https://example.com/docs)",
  );
});

test("escapes brackets in the selected text", () => {
  assert.equal(
    linkMarkdown("a [draft] note", "https://example.com"),
    "[a \\[draft\\] note](https://example.com)",
  );
});

test("uses the angle form for a URL containing parentheses", () => {
  assert.equal(
    linkMarkdown("the article", "https://en.wikipedia.org/wiki/Mercury_(planet)"),
    "[the article](<https://en.wikipedia.org/wiki/Mercury_(planet)>)",
  );
});

test("leaves whitespace the selection picked up outside the link", () => {
  assert.equal(
    linkMarkdown(" the docs ", "https://example.com"),
    " [the docs](https://example.com) ",
  );
});

test("declines a selection it should not link", () => {
  const url = "https://example.com";
  assert.equal(linkMarkdown("", url), "", "nothing selected");
  assert.equal(linkMarkdown("   ", url), "", "only whitespace selected");
  assert.equal(linkMarkdown("two\nlines", url), "", "a block rather than a phrase");
  assert.equal(linkMarkdown("[a](https://example.org)", url), "", "already a link");
});

test("declines a URL no link form can carry", () => {
  assert.equal(linkMarkdown("the docs", "https://example.com/<a>"), "");
  assert.equal(linkMarkdown("the docs", ""), "");
});
