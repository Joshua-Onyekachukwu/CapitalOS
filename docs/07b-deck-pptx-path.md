# PPTX Generation Path — Capital OS Deck

*Last updated: 2026-10-31*

---

## Current state

PptxGenJS is available (`node -e "require('pptxgenjs')"` succeeds). A deck-generator scaffold
(`src/lib/services/deck/generator.ts`) and an API route (`src/app/api/deck/generate/route.ts`)
already exist. They currently assemble a slide-by-slide PPTX from a content outline and write it
to disk.

---

## What is generated

- A `.pptx` file built slide-by-slide from `PITCH-DECK-CONTENT.md`-style content.
- Each slide has: a title, bullet content or two-column content, optional speaker notes, optional
  branding (Capital OS colors, logo placeholder), and optional screenshots from the live deployment.
- Speaker notes are included where `PITCH-DECK-CONTENT.md` or `CAPITAL-OS-INVESTOR-PITCH.md §19`
  carry them, so the deck can be presented directly rather than reinterpreted.

---

## Deck content source

- Primary content outline: `PITCH-DECK-CONTENT.md`
- Speaker notes, timing, and anticipated Q&A: `CAPITAL-OS-INVESTOR-PITCH.md` §19 (slide-by-slide outline with speaker notes, timing, and anticipated investor questions)
- The 3-pillar pricing model is already present in both docs and in the generator's slide content.
- Platform screenshots from the live deployment are inserted on the demo/proof slides (investor
  search, fit scoring, email drafting, pipeline board, pitch deck generator) where they exist.

---

## Generation flow

1. Author or refresh the slide-by-slide content in `PITCH-DECK-CONTENT.md` and the notes/Q&A in
   `CAPITAL-OS-INVESTOR-PITCH.md`.
2. Run the generator (either the API route or the scripted offline path) to produce a `.pptx`.
3. The output is a presentable deck, not a visual mock; the generator uses the same content the
   founder would speak, with notes attached.
4. When platform screenshots are available from the live deployment, attach them to the proof slides
   so the deck shows the product, not just claims about it.

---

## Integration notes

- The PPTX path is intentionally separate from the live product. The deck generator is a content
  artifact for fundraising, not a feature exposed to end users.
- For a live investor meeting, generate the deck from the current docs, verify the slide count and
  notes land correctly, and use that file. Recreate it after any significant content change.
- If the deck generator is not yet fully wired, the same content can be rendered manually through
  PptxGenJS using the slide outline in `PITCH-DECK-CONTENT.md` and the notes in
  `CAPITAL-OS-INVESTOR-PITCH.md` §19.

---

## Open work

- Confirm the generator produces a complete deck with speaker notes attached.
- Insert real platform screenshots on the relevant proof slides once the live deployment has stable
  screenshots to use.
- Re-run after any pricing/model/doc change that affects slide content.

---

*Last updated: 2026-10-31*
