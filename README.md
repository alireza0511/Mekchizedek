# Melchizedek — private reading site

The site in `docs/` is AES-256 encrypted (StatiCrypt). The readable story
(`english/`, `farsi/`, `media/`) stays on this computer only: it is in
`.gitignore`, and a pre-commit hook blocks it if it is ever staged.

## Rebuild after editing the story

    cd tools
    npm install            # first time only
    STATICRYPT_PASSWORD='your-long-password' node build.mjs

(or put `STATICRYPT_PASSWORD=...` in `tools/.env`, which is gitignored)

Then commit and push only `docs/`:

    git add docs tools/build.mjs tools/package*.json tools/.staticrypt.json
    git commit -m "Update reading draft" && git push

Keep `tools/.staticrypt.json` the same across builds. It holds the salt that
lets one login unlock every page. Changing the password logs everyone out.

## GitHub Pages (one time)

Repo → Settings → Pages → Source: "Deploy from a branch" → Branch `main`,
folder `/docs` → Save.
