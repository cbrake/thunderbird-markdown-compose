"use strict";

/**
 * When a pasted URL should wrap the selection.
 *
 * String in, string out: no Thunderbird APIs and no DOM, so this file can be
 * exercised from Node with `node --test`. src/paste.js supplies the clipboard
 * text and the selection, and performs the insertion.
 */

/**
 * A clipboard holding a link and nothing else.
 *
 * The scheme is required. Accepting a bare `example.com` would mean an ordinary
 * word paste occasionally rewrites the selection into a link, which is worse
 * than declining to help, because it happens silently and has to be undone.
 */
const PASTED_URL = /^(?:https?:\/\/|mailto:)\S+$/;

/**
 * The URL a paste consists of.
 *
 * @param {string} text The clipboard's `text/plain` flavour.
 * @returns {string} The URL, or an empty string if the paste is anything else.
 */
function pastedUrl(text) {
  const trimmed = (text ?? "").trim();
  return PASTED_URL.test(trimmed) ? trimmed : "";
}

/**
 * A Markdown link made from the selected text and a pasted URL.
 *
 * Anything the rules do not clearly cover returns an empty string, which leaves
 * the paste to the behaviour it would have had otherwise.
 *
 * @param {string} selected The compose window's selection, as text.
 * @param {string} url A URL, as returned by pastedUrl().
 * @returns {string} Markdown, or an empty string.
 */
function linkMarkdown(selected, url) {
  // Neither link form can carry these unescaped.
  if (!url || /[<>]/.test(url)) return "";

  const text = selected ?? "";
  // A line break means a block of text rather than a phrase, and a selection
  // already holding a link is being replaced rather than linked.
  if (!text.trim() || /[\r\n]/.test(text) || text.includes("](")) return "";

  // Whitespace the selection picked up, from a double click for example, is
  // left outside the link so its text ends at the word.
  const [, lead, phrase, trail] = /^(\s*)(.*?)(\s*)$/.exec(text);
  // An unbalanced parenthesis ends the destination early, and the angle form
  // has no such reading. Brackets would end the link text the same way.
  const destination = /[()]/.test(url) ? `<${url}>` : url;
  return `${lead}[${phrase.replace(/[[\]]/g, "\\$&")}](${destination})${trail}`;
}
