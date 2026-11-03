# Melchizedek — private reading site

The site in `docs/` is AES-256 encrypted (StatiCrypt). The readable story
(`english/`, `farsi/`, `media/`) stays on this computer only: it is in
`.gitignore`, and a pre-commit hook blocks it if it is ever staged.

## Rebuild after editing the story

Each part has its own password (English and Farsi of a part share it).
The contents page (index.html) is open and shows only "Part 1 … Part 8".
Put the passwords in `tools/.env` (gitignored):

    PART1_PASSWORD='...'
    ...
    PART8_PASSWORD='...'

Then:

    cd tools
    npm install            # first time only
    node build.mjs

Then commit and push only `docs/`:

    git add docs tools/build.mjs tools/package*.json tools/.staticrypt.json
    git commit -m "Update reading draft" && git push

Changing a part's password logs readers out of that part only.

## GitHub Pages (one time)

Repo → Settings → Pages → Source: "Deploy from a branch" → Branch `main`,
folder `/docs` → Save.

## Weekly release

Part 1 opens Sat 7 Nov 2026, then one part every Saturday at midnight US Central
(Part 8 on 26 Dec). Change `FIRST_RELEASE` in `tools/build.mjs` to move it.
Before its date a card shows a lock and the release date (Persian calendar in
Farsi). The real protection is still each part's password: share Part N's
password on its release day. Preview all cards yourself with `index.html?all`.
