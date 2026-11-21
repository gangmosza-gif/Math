// Thai-aware line wrapping for Fabric textboxes.
//
// Fabric wraps a Textbox only at spaces, but Thai is written without spaces between words, so a Thai
// sentence never wrapped: the box stretched to the whole sentence (often past the page). Here every
// textbox wraps in "grapheme" mode (no characters are dropped at a soft break, so cursor, selection
// and per-character styles keep their positions), but the pieces it may break between are words found
// by the browser's Thai dictionary (Intl.Segmenter). Punctuation and spaces stay on the word before
// them; a single word wider than the box widens the box, as before.
import { Textbox } from 'fabric';

const words = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
const OPENERS = /^[([{"'“‘«]/;

/** Break opportunities of one line: words with the punctuation/spaces that follow them. */
export function wrapPieces(line) {
  if (!words) return null;
  const out = [];
  for (const s of words.segment(line)) {
    const piece = s.segment;
    if (out.length && !s.isWordLike && !OPENERS.test(piece)) out[out.length - 1] += piece;
    else if (out.length && OPENERS.test(out[out.length - 1]) && out[out.length - 1].length === 1) out[out.length - 1] += piece; // "(คำ" stays together
    else out.push(piece);
  }
  return out;
}

if (words) {
  // every textbox (new, pasted or loaded from a saved design) uses the no-drop wrapping mode
  Textbox.ownDefaults.splitByGrapheme = true;
  const fromObject = Textbox.fromObject;
  Textbox.fromObject = function (object, options) {
    return fromObject.call(this, { ...object, splitByGrapheme: true }, options);
  };

  const original = Textbox.prototype.getGraphemeDataForRender;
  Textbox.prototype.getGraphemeDataForRender = function (lines) {
    if (!this.splitByGrapheme) return original.call(this, lines);
    let largestWordWidth = 0;
    const wordsData = lines.map((line, lineIndex) => {
      const pieces = wrapPieces(line);
      if (!pieces || !pieces.length) return [{ word: [], width: 0 }];
      const res = [];
      let offset = 0;
      const push = (g) => {
        const w = this._measureWord(g, lineIndex, offset);
        res.push({ word: g, width: w });
        largestWordWidth = Math.max(largestWordWidth, w);
        offset += g.length;
      };
      // a single word wider than the box widens the box (as Fabric always did) instead of being cut
      for (const p of pieces) push(this.graphemeSplit(p));
      return res;
    });
    return { wordsData, largestWordWidth };
  };
}
