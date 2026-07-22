# Ideas

Things worth considering, with enough context to pick up later. Nothing here is
committed to, and an idea that stays unclaimed is evidence it was not needed.

## Render point-by-point replies written inside a quote

Interleaved replying, where you answer a message by writing between its quoted
paragraphs, is currently passed through as plain text. The segmenting in
`src/source.js` works on the top level of the compose body, so anything inside a
`<blockquote type="cite">` belongs to that block, and nothing in the markup
separates your interjection from the text you are quoting.

Guessing is the wrong approach. A reply that reformats part of someone's quoted
message would be worse than one that renders nothing.

A convention would make the intent explicit. Marking your own lines inside the
quote, for example with a leading `>>` or a blank line and a chosen prefix, gives
a rule that can be applied without inference. The work is roughly:

- Choose the marker, favouring something that survives the editor and reads
  sensibly to a recipient whose client shows the raw text.
- Extend segmenting to descend into quoted blocks and split them on the marker,
  producing the same segment sequence the top level already produces.
- Keep the rest untouched. Rendering, preview, and send already handle any
  number of segments in any order.

The open question is whether interleaved replying matters enough to justify
teaching the segmenter about nesting, which is the one part of the codebase that
would become meaningfully harder to reason about.
