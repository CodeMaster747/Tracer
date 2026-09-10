# Deploying & Updating Tracer

Everything you need to push code changes to production.

- **Live app:** https://tracer-137d2.web.app
- **Repo:** https://github.com/CodeMaster747/Tracer
- **Firebase project:** `tracer-137d2`
- **Hosting:** Firebase Hosting, deployed automatically by GitHub Actions

---

## TL;DR — the everyday update flow

Make your code changes, then:

```bash
# 1. (Recommended) verify locally before pushing
npm run typecheck && npm run lint && npm run build

# 2. Stage, commit, and push to main
git add -A
git commit -m "Describe what you changed"
git push
```

Pushing to `main` automatically:
1. Runs **CI** (typecheck → lint → build)
2. Runs **Deploy** — builds the app and publishes it to https://tracer-137d2.web.app

No manual deploy command needed. Your changes are live ~1–2 minutes after the push completes.

---

## Watching a deploy

```bash
# List recent runs (CI + Deploy)
gh run list --repo CodeMaster747/Tracer --limit 5

# Follow the latest run live until it finishes
gh run watch --repo CodeMaster747/Tracer
```

Or watch in the browser: https://github.com/CodeMaster747/Tracer/actions

A successful deploy ends with `Deploy to Firebase Hosting (live)` checked green.

---

## Local development

```bash
npm run dev       # start the dev server (http://localhost:5173)
npm run build     # production build into dist/
npm run preview   # serve the production build locally to sanity-check it
npm run typecheck # tsc --noEmit, no files emitted
npm run lint      # eslint
```

Always good to run `npm run build` locally before pushing — it catches the
same failures CI would, but faster (no waiting on a runner).

---

## Recommended: use a branch + Pull Request

Instead of committing straight to `main`, you can work on a branch and open a
PR. This gives you a **preview deploy** (a temporary, shareable URL) before
anything touches production.

```bash
# Start a feature branch
git checkout -b my-change

# ...make changes...
git add -A
git commit -m "Describe what you changed"
git push -u origin my-change

# Open a PR against main
gh pr create --fill
```

On the PR:
- **CI** runs (typecheck, lint, build).
- A **preview deploy** is published to a temporary channel and the URL is
  posted as a comment on the PR (it auto-expires after 7 days).

When you merge the PR into `main`, the normal deploy runs and the change goes
live.

```bash
gh pr merge --squash   # merge when you're ready (also: --merge or --rebase)
```

---

## Manually triggering a deploy

If you ever need to redeploy `main` without pushing a new commit (e.g. after
changing a GitHub secret), trigger the deploy workflow directly:

```bash
gh workflow run "Deploy to Firebase Hosting on merge" \
  --repo CodeMaster747/Tracer --ref main
```

Or from the browser: Actions → "Deploy to Firebase Hosting on merge" → **Run workflow**.

---

## Re-running a failed deploy

If a deploy failed for a transient reason (network blip, etc.), re-run it:

```bash
# Find the failed run's ID
gh run list --repo CodeMaster747/Tracer --limit 5

# Re-run it
gh run rerun <RUN_ID> --repo CodeMaster747/Tracer
```

---

## Rolling back a bad deploy

The fastest rollback is through the Firebase console — it keeps previous
releases and lets you re-publish one instantly:

1. Open https://console.firebase.google.com/project/tracer-137d2/hosting
2. Under **Release history**, find the last good release
3. Click the `⋮` menu → **Roll back**

Alternatively, revert the offending commit in git and push — that triggers a
fresh deploy of the reverted code:

```bash
git revert <bad-commit-sha>
git push
```

---

## What's configured (reference)

| Thing | Where | Notes |
|-------|-------|-------|
| CI (typecheck/lint/build) | `.github/workflows/ci.yml` | Runs on push to `main` and on PRs |
| Live deploy | `.github/workflows/firebase-hosting-merge.yml` | Runs on push to `main` (and manual dispatch) |
| PR preview deploy | `.github/workflows/firebase-hosting-pull-request.yml` | Runs on PRs; posts a temp URL |
| Hosting config | `firebase.json` | SPA rewrite + asset caching headers |
| Firebase project alias | `.firebaserc` | `default` → `tracer-137d2` |
| Build-time env vars | `.env.production` | Firebase **web** config (public values only) |
| Deploy credential | GitHub secret `FIREBASE_SERVICE_ACCOUNT_TRACER_137D2` | Service account JSON; set once |

### Environment variables

Vite bakes `VITE_*` values into the bundle **at build time**. Production builds
read `.env.production` (committed — these Firebase web values are public and
safe to commit). Local `npm run dev` reads `.env`.

> **Never** put real secrets (server keys, admin SDK creds) in `.env.production`
> — it's committed to the repo. Those belong in GitHub Actions secrets and
> should be injected at build time via the workflow.

---

## Common issues

- **Deploy failed: `Input required and not supplied: firebaseServiceAccount`**
  The `FIREBASE_SERVICE_ACCOUNT_TRACER_137D2` secret is missing/empty. Re-add it:
  ```bash
  gh secret set FIREBASE_SERVICE_ACCOUNT_TRACER_137D2 \
    --repo CodeMaster747/Tracer \
    --body "$(cat /path/to/service-account.json)"
  ```

- **CI failed on lint/typecheck/build** — run the same command locally
  (`npm run lint`, `npm run typecheck`, `npm run build`), fix the error, commit,
  and push again.

- **Changes not showing after a successful deploy** — hard refresh
  (Cmd+Shift+R). HTML is served with `no-cache`, but your browser may still be
  holding the old page.
