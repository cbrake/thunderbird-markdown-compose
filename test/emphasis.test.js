"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the emphasis rules the way Thunderbird does: a plain script in a shared
// global scope. src/paste.js, which calls into them, needs the compose window
// and is verified by hand instead.
const context = vm.createContext({});
const filename = path.join(__dirname, "..", "src/emphasis.js");
vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
const { emphasisMarkdown } = context;

test("wraps a selection in the marker", () => {
  assert.equal(emphasisMarkdown("word", "**"), "**word**");
  assert.equal(emphasisMarkdown("two words", "_"), "_two words_");
});

test("keeps surrounding whitespace outside the markers", () => {
  assert.equal(emphasisMarkdown(" word ", "**"), " **word** ");
});

test("unwraps a selection that is already emphasised", () => {
  assert.equal(emphasisMarkdown("**word**", "**"), "word");
  assert.equal(emphasisMarkdown("_word_", "_"), "word");
});

test("wraps a lone marker rather than unwrapping it", () => {
  assert.equal(emphasisMarkdown("****", "**"), "********");
  assert.equal(emphasisMarkdown("__", "_"), "____");
});

test("leaves empty, blank, and multi-line selections alone", () => {
  assert.equal(emphasisMarkdown("", "**"), null);
  assert.equal(emphasisMarkdown("   ", "**"), null);
  assert.equal(emphasisMarkdown("one\ntwo", "**"), null);
});
