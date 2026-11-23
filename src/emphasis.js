"use strict";

/**
 * Bold and italic shortcuts that write Markdown.
 *
 * String in, string out: no Thunderbird APIs and no DOM, so this file can be
 * exercised from Node with `node --test`. src/paste.js supplies the selection
 * and performs the insertion.
 */

/** The marker each shortcut key writes. */
const EMPHASIS_MARKERS = { b: "**", i: "_" };

/**
 * The selection wrapped in an emphasis marker, or unwrapped if it already is.
 *
 * @param {string} selected The compose window's selection, as text.
 * @param {string} marker `**` or `_`.
 * @returns {string|null} The replacement text, or null to leave the selection
 *   alone.
 */
function emphasisMarkdown(selected, marker) {
  const text = selected ?? "";
  // Emphasis cannot cross a paragraph, and wrapping each line is a guess.
  if (/[\r\n]/.test(text)) return null;

  // Whitespace the selection picked up stays outside the markers, because
  // `** word**` is not emphasis.
  const [, lead, phrase, trail] = /^(\s*)(.*?)(\s*)$/.exec(text);
  if (!phrase) return null;

  const wrapped =
    phrase.length > 2 * marker.length &&
    phrase.startsWith(marker) &&
    phrase.endsWith(marker);
  const inner = wrapped
    ? phrase.slice(marker.length, -marker.length)
    : `${marker}${phrase}${marker}`;
  return `${lead}${inner}${trail}`;
}
