# Юмилия Studio

Archive + configurable card gacha, with a GitHub Pages admin and an optional server-backed admin studio. Requires Node.js 22 or newer. There are no third-party runtime dependencies.

## GitHub Pages

- Main site: https://mrmayo1980.github.io/Yumiliyawebsite/
- Admin: https://mrmayo1980.github.io/Yumiliyawebsite/admin.html
- Standalone game: https://mrmayo1980.github.io/Yumiliyawebsite/gacha_game.html

Pages publishes **main → /docs**. `npm run build:pages` creates that public directory from an explicit file allowlist. It includes the archive, game, and admin, with relative paths that work beneath `/Yumiliyawebsite/`. The generated `.nojekyll` disables Jekyll processing. Credentials, server code, tests, private drafts, and unpublished uploads are excluded.

The Pages admin uses a **shared password** checked by a private Cloudflare Worker. Editors need no GitHub account, GitHub token, or Cloudflare account. The owner's publishing credential and the password hash are stored only in Cloudflare, never in Pages files or browser drafts.

One-time owner setup (Cloudflare Workers Free and D1 Free):

```bash
npm ci
npm run cloudflare:login
npm run cloudflare:deploy
```

Sign in to the free Cloudflare account in the browser. Deployment creates the D1 authentication database, applies its schema, installs encrypted Worker secrets, deploys the service, checks that anonymous requests are rejected, and builds Pages with its public address. The deployment uses the owner's existing GitHub CLI authorization automatically; it never asks editors to create or paste a token. If that authorization is revoked, the owner must refresh the service's publishing secret. These scripts do not subscribe to a paid plan.

The initial shared password is stored privately in `.data/cloudflare-initial-password.txt`. Share it only with intended editors. Change it in **Доступ** after login. Changing the password revokes all sessions; the new hash persists in D1 across Worker deployments. Re-running deployment does not reset a changed password. The private initial-password file is a record of the first password, not a current-password recovery mechanism.

After deployment, commit and push the reviewed root files, `data/hosting.json`, `wrangler.jsonc`, and generated `/docs` to update GitHub Pages. The hosting JSON contains only the public Worker address. Do not commit `.data`, `.wrangler`, `.dev.vars`, or credentials. The build allows browser connections only to the configured password-service origin. Sessions stay in memory and expire after eight hours; reloading requires signing in again. Login throttling and revocation are stored in D1 rather than in a temporary Worker instance.

Drafts and unpublished uploads are saved in IndexedDB in the current browser. Preview works without publishing. **Опубликовать** creates one GitHub commit containing the public settings and referenced uploaded files in both the repository source and `/docs`. GitHub Pages then rebuilds; allow a few minutes for the public site to update. Existing files outside those changes are preserved, and the branch is never force-pushed. If another editor published a newer revision, the old draft is retained for export instead of overwriting their changes. Use **Копии и история → Загрузить опубликованную версию** to reload the current GitHub version deliberately.

`data/site-state.json` is the versioned public configuration. Only referenced uploads are committed, as `assets/media/…`; files removed from a draft stay private. The Pages history panel shows up to 10 earlier publications from Git history. The JSON export is a settings backup, not a bundled backup of unpublished binary uploads; publish wanted uploads or keep their originals before clearing a browser draft.

To change application code: pull the latest `main` first, edit the root source, run tests and `npm run build:pages`, then commit and push the root source and generated `/docs` together. Publication through the admin also advances `main`, so pulling first prevents overwriting those changes. `node scripts/build-pages.mjs --use-local-published` deliberately exports the local server's published content instead of the repository snapshot; it never exports a private draft.

## Start locally

```bash
cd /home/reinis-asv/Yumiliyawebsite
npm run setup
npm start
```

- Site: http://127.0.0.1:8000/
- Admin: http://127.0.0.1:8000/admin.html
- The generated initial password is in `.data/initial-admin-password.txt`. Open it locally, sign in, then change the password under **Доступ**.
- `npm run setup` generates a new password and replaces the old hash. Restart the server afterwards to invalidate existing sessions. For automated provisioning, setup also accepts an `ADMIN_PASSWORD` environment variable.

Open the local password-based studio through this server. `file://` pages cannot run it. The generated GitHub Pages version uses the private Cloudflare password service instead of this local server API.

## Editing

1. **Архив:** upload photos, GIFs, and videos (up to 40 MB); search, rename, move to the beginning, or hide selected items.
2. **Коллекции:** create, duplicate, reorder, enable or disable collections; change their names, descriptions, covers, prices, rarity rates, guarantees, and featured SR card. Keep collection IDs stable where possible.
3. **Карты:** create, duplicate, edit, or remove cards; upload artwork, select the collection and rarity, set a relative weight within the rarity, and hide cards without deleting them. Card IDs stay stable for existing player saves.
4. **Правила и награды:** starting balances, daily spins, sale prices, duplicate shards, currency prizes, shard roulette costs/weighted rewards/guarantees, and 2048 rewards and daily caps. Starting balances only affect new players. Baseline rules can be copied to all collections explicitly.
5. **Оформление:** game title, font, colors, background, card back, balance panels, summon button, width, card corners, sound volume, animation durations, flashes, and vibration.
6. **Тексты и справка:** main navigation/button labels and editable, ordered help sections. Help placeholders automatically reflect the selected collection's rules.
Frames can be uploaded under **Оформление → Рамки карт**, separately for N, R, and SR. The image sits above the card artwork; use a transparent PNG or WEBP with a clear center. **Отступ изображения внутри рамки** adjusts how the artwork fits inside it. Each card also has an optional **Индивидуальная рамка** and a **Накладывать рамку** switch. Empty individual frames inherit the rarity frame; turn the switch off for artwork that already includes a frame, such as the original cards. Frames follow cards through banners, the reel, results, collection, and detail view; locked collection cards retain the card back.

7. **Копии и история:** import/export the full draft, edit the configuration JSON, or restore a prior publication to a draft.

8. **Оформление сайта:** public site title and navigation labels (including the admin button), footer and archive messages, palette, background image, fonts, header spacing, gallery width, column counts, gaps, corners, original or cropped media ratios, masonry or grid layout, visibility switches, and muted video autoplay.
9. **Экран входа:** login branding, welcome text, form labels and error text, logo and artwork, background image and palette, fonts, split or centered layout, and an optional welcome block. These settings change presentation only; authentication remains server-controlled.

Both sections have their own draft preview with phone/full-width options. Website previews also use the draft archive and draft game. Login previews are read-only. Publish to apply the appearance to public pages and future sign-ins. Existing exports and publication history from before appearance customization receive the original display defaults when restored.

Use **Сохранить черновик** to persist edits. **Предпросмотр** plays the saved draft in a separate save slot and offers a reset for test progress. **Опубликовать** validates the draft and updates the public site. Refresh an already open public game to load a new publication. Invalid configurations cannot be published. Concurrent draft edits are detected instead of silently overwriting each other.

Undo and redo apply to the current editing session. Unsaved edits are not persisted automatically. Publication history is stored on the server; the admin displays the latest 50 versions. Restoring a version changes the draft until it is published again.

## Existing archive

`data/legacy-gallery.json` is a snapshot of the existing 321 Cloudinary files. The website no longer scans manifests written through the former unsigned upload preset. New files go to the protected server's `uploads/` directory. Hiding files removes them from the displayed archive; originals remain available for history and recovery.

Disable the old `gallery_unsigned` preset in your Cloudinary account. Removing it from the website does not revoke the preset at Cloudinary or remove it from earlier Git commits. A new admin password has been generated; the old embedded password should be considered exposed.

`node server/import-legacy.mjs` is a one-time migration tool, not part of normal server startup. It replaces the archive snapshot with the current remote manifests, so use it deliberately if migrating additional legacy content.

## Deployment and storage

For the optional password-based server deployment, run one instance of this Node server behind an HTTPS reverse proxy on hosting with a persistent disk. Configure:

```text
NODE_ENV=production
PUBLIC_ORIGIN=https://your-domain.example
HOST=127.0.0.1
PORT=8000
```

`PUBLIC_ORIGIN` must match the public hostname and scheme. The proxy must preserve the public `Host` header and forward to the local server. Use `HOST=0.0.0.0` only when the hosting platform needs it; expose the application through HTTPS. Production refuses to start without an HTTPS `PUBLIC_ORIGIN` and uses Secure cookies. Without `PUBLIC_ORIGIN`, the server accepts only localhost hostnames.

Optional `DATA_DIR` relocates private state. `.env.example` shows the supported settings. To use a local `.env`, start with `node --env-file=.env server/main.mjs`.

Back up **`.data/` and `uploads/` together**, plus the repository's `assets/` and `data/`. The JSON export does not embed uploaded files. `.data` and `uploads` are deliberately excluded from Git; use a persistent disk when deploying and copy them when moving the service. Do not use a generic static server to serve the entire repository, since it would not enforce the private-file allowlist.

Authentication uses a salted scrypt password hash, opaque in-memory sessions, HttpOnly / SameSite cookies, same-origin checks, CSRF tokens, and login throttling. Password changes revoke all sessions. Only explicit public files are served; credentials, source code, Git metadata, and draft/history storage are private. Server restarts require signing in again. This is a single-admin, single-process file-backed application; it does not provide shared sessions across multiple replicas.

Game progress remains in each player's browser. This protects site administration; it does not make player currency tamper-proof. New settings preserve existing inventories and balances on the same origin. Existing `file://` saves cannot automatically transfer to `http://` or to a new domain: export a backup from the old game and restore it on the new site.

## Verification

```bash
npm test
```

Tests cover password verification, authentication/CSRF/origin checks, login throttling, session revocation, private-file protection, draft isolation, publishing/history, stale-edit rejection, uploads, configuration validation, and game behavior driven by custom settings.

Cloudflare deployment uses the documented free-tier limits. The public site stays on GitHub Pages; Worker/D1 outages or exhausted limits can temporarily prevent editing. No paid storage service is required. Uploads are buffered in the editor’s browser until publication; the Worker streams the encoded files to the repository and stores only authentication/upload metadata in D1.

Authentication design references: [Node crypto](https://nodejs.org/api/crypto.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
