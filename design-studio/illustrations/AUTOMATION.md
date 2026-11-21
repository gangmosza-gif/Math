# Instructions for an AI agent that generates the illustrations (ChatGPT or any other)

You are generating illustrations for the Lai Studio design app. Follow these rules exactly.

## What to read
- `design-studio/illustrations/prompts.json` → `items`: one entry per image.
  Fields: `file` (exact file name to save), `batch` (folder), `style` (S1/S2/S3), `aspect` (1:1, 3:2 or 2:3),
  `kind` (`sticker` = transparent background, `scene` = full-bleed), `th` (Thai name), `subject`, `space`.
- The full prompt text for every image is in `design-studio/illustrations/batches/<batch>-*.md`
  (section whose "ไฟล์:" line equals the file name). Use that prompt text **unchanged**.

## Order (do batches in this order; inside a batch, top to bottom)
`batch-00` (style anchors) → 01, 02, 03, 04, 05, 06 → 29, 32 → 07, 08, 09, 10 → 11, 12, 13, 14, 15, 16 → 30, 31 → 25, 26, 27, 28 → 17, 18, 19, 20, 21, 22, 23, 24

Skip an item when its file already exists in `design-studio/illustrations/inbox/<batch>/` (it was done before).

## For every image
1. Generate **one image per request** from that item's prompt text. Never put several items in one request.
2. Style consistency: for every batch after `batch-00`, give the image model the anchor images of the same style
   from `design-studio/illustrations/inbox/batch-00/` (`s1-anchor-*.png`, `s2-anchor-*.png` or `s3-anchor-*.png`) as the style reference.
3. Size: 1:1 → 1024×1024, 3:2 → 1536×1024, 2:3 → 1024×1536. PNG.
   Stickers: transparent background if possible, otherwise plain white #FFFFFF.
4. Before saving, look at the image yourself and regenerate (max 3 tries) if: any text/letters/numbers appear
   (except the single digit in `batch-27` number items), the subject is cut off at the edge, the number of people/objects is
   wrong, hands or faces are deformed, or it does not match the subject.
5. Save it as `design-studio/illustrations/inbox/<batch>/<file>` — exact file name, nothing else in that folder.
   (If an image arrives as `.jpg`/`.webp` or with different letter case, the checker renames and converts it to the
   expected `.png` name automatically — but always aim for the exact name.)
6. Commit with message `illustration: <file>` and push. One image per commit (or one batch per commit).

## Do NOT
- Edit, rename or delete any other file in the repository (code, prompts, tests, `public/`).
- Change the prompt text or invent new items.
- Put files into `public/illustrations/` — only humans/Claude import approved images there after checking.

## After a batch is complete
Every push to `illustrations/inbox/**` runs the GitHub Action **"Check illustrations"**. Its summary lists each image as
ok / fix / warn / fail. Images marked `fail` must be regenerated (use the matching prompt from
`inbox/<batch>/_check/regenerate.md` once it exists, or the original prompt plus "Problems to fix: …").
Final approval and import into the app are done by a visual review (Claude) — not by the agent.
