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

## Downscale pasted images

Images are capped for display, but they are still sent at whatever resolution
they arrived at. A phone screenshot can be several megabytes, and base64 adds
another third on top. Resampling would fix the size of the message itself rather
than only the size it appears at.

The bytes come from one particular paste. Copying from a web page puts
`text/html` on the clipboard with remote `<img>` sources, and `src/paste.js`
already turns those into short Markdown links. A screenshot tool instead puts an
`image/png` blob on the clipboard with no HTML flavour, so `paste.js` returns
early, Thunderbird's own paste inserts a `data:` URI, and that is the large case.
The existing listener is already sitting on the right event; it declines to act.

Handling it means extending that listener to look for an image item on the
clipboard, taking the blob synchronously before `clipboardData` is neutered, and
resampling it:

- Read the intrinsic size with `createImageBitmap()`. Leave images already under
  the cap exactly as they are rather than re-encoding for nothing.
- Draw to a canvas at the reduced size. A second cap is needed here, separate
  from `MAX_IMAGE_WIDTH` in `src/style.js` and roughly twice it, so the stored
  image still has pixels to spare on a high resolution screen. `imageHtml()`
  then lays the result out at the display width as it does today.
- Encode as both PNG and JPEG and keep the smaller. JPEG wins on photographs and
  leaves visible artefacts around text in a screenshot, and at these dimensions
  both encodes are cheap. WebP compresses better than either but mail client
  support does not justify it yet.

Inserting is the awkward part, because the paste handler cannot wait for the
resampling without risking a misplaced insertion if typing continues. Inserting
the original immediately with a marker attribute, then swapping the source when
the resampled version is ready, keeps the paste responsive. The trade is that the
swap is not itself an undo step.

Pastes are not the only way an image arrives; drag and drop, the image dialog,
and drafts that already hold one all bypass the event. Those would need a pass
over `preserved` in the `onBeforeSend` listener, which can be async and can do
the same work. Worth adding only if the gap proves to matter, since paste time
also keeps drafts small and the compose window responsive while editing. Note
that a canvas holding a remote image is tainted and cannot be read back, so any
such pass applies to `data:` sources alone.

The judgement to make first is what the cap costs. Resampling is lossy and the
recipient cannot undo it, so a screenshot shared precisely because of its fine
detail is the case that would be let down. That argues for either a generous cap
or a preference, and for skipping images whose saving would be small anyway.
