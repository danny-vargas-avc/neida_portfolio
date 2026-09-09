# Neida Rodriguez — portfolio

A single-page portfolio built around Neida's hand-drawn vine. Each leaf on the
drawing is a section of her work; choosing one opens that section below.

Nuxt 4 · Vue 3 · TypeScript · GSAP, reading from a Django + Unfold admin.

Built as a static SPA and served by nginx, with no Node process in production —
the same shape as the graze deployment. Content is fetched from the admin at
runtime, so Neida saves a change and refreshes to see it; there is no publish
step and no rebuild.

```
src/
  django/    the admin and the read-only API it feeds the site
  site/      the Nuxt front end
etc/
  docker/    Dockerfile, compose, nginx
  start.sh   local development (Django)
  build.sh   build the image on the VPS
  deploy.sh  bring it up on the VPS
```

## Running it locally

Two processes, in two terminals:

```bash
./etc/start.sh                  # admin + API on :8000
cd src/site && npm run dev      # the site on :3000
```

The site proxies `/api` and `/media` to `:8000`, so everything is one origin in
development exactly as it is behind nginx in production — which is why there is
no CORS configuration to get wrong.

> **Note:** `npm install` needs `--legacy-peer-deps` on npm 11.5.x, which has a
> bug resolving Nuxt's peer graph (`Cannot read properties of null (reading
> 'edgesOut')`).

---

## For Neida: editing the site

Everything lives in an admin at `/admin/` — no files, no code. See
[server/README.md](server/README.md) for running it and for creating her
account.

The site reads from it live: save, refresh, it's there.

**Both servers must be running:** `npm run dev` here, and the Django one in
`server/`.

---

## The artwork

`public/media/carousel.svg` is the traced scan of the vine — **drop replacement
artwork there**. It is a potrace trace: filled paths, no strokes, no groups, on
a full sheet of paper with a lot of blank margin and a scattering of scan dust.

```bash
node scripts/clean-vine.mjs      # drops scan noise, crops to the ink
node scripts/leaf-overlay.mjs .  # renders the leaf hit areas over the art
```

`clean-vine.mjs` keeps 49 of the scan's 176 paths — the rest is dust. Its
thresholds can be swept via `MIN_THICKNESS` / `MIN_EXTENT` env vars; past about
1.4 / 5 the count plateaus and it starts eating real linework instead.

`clean-vine.mjs` writes `app/assets/art/vine.svg` (what the app imports) and
prints the cropped viewBox to paste into `app/components/vine-leaves.ts`. It
leaves path coordinates alone, so existing leaf positions stay valid.

If Neida redraws the vine with leaves in new places, re-measure them: run
`leaf-overlay.mjs`, compare, and adjust the ellipses in `vine-leaves.ts` until
they sit on the leaves.

### How the animations work

**Animation policy: opacity and transform only.** Those two are handled by the
compositor, so they stay smooth no matter how intricate the drawing is.

- **Entrance** — the vine fades and settles in. Plain CSS animations
  (`vine-fade` + `vine-settle` in `app/assets/css/base.css`) on a single element.
  Change the speed with the `--vine-enter` token in `tokens.css`, in seconds.

  It is gated on a `vine-ready` class that the inline head script adds on
  `load` + a frame. Without that gate the animation starts as soon as the
  element is styled and runs on wall-clock time regardless of whether the main
  thread is free — the vine was already 40% faded in by `DOMContentLoaded` and
  visually finished before anyone saw it, which is why a 4.5s fade looked
  instant. Opacity and scale are also separate animations: sharing one ease-out
  put 84% of the fade in the first third of the run.
- **Lighting a leaf** — hovering, or selecting on touch, fades in a second copy
  of the drawing clipped to that blade, tinted with the section's accent and
  stroked at `3.2` so its line weight roughly doubles. The artwork is fine pen
  line, so recolouring alone was far too quiet to notice; the weight is what
  makes it obvious. The clip never moves, only opacity does.
- **Idle spin** — the vine turns slowly clockwise (one revolution per
  `SPIN_SECONDS`). Hovering a leaf eases it to a stop; leaving resumes it. Done
  by tweening the tween's `timeScale`, not by pausing it, which stops dead
  mid-motion. It rotates an inner wrapper so it never fights the entrance over
  the same transform. Gated on `prefers-reduced-motion`.

This is deliberately much less clever than it once was. Earlier versions
revealed the artwork by animating an SVG `<mask>` — a wide stroke walking a
route through the leaves, with per-leaf hold-backs to control their order — and
also tried growing each leaf out of its stem. Both stuttered badly and neither
was salvageable: **changing anything inside a mask forces the browser to
re-rasterise the mask and the artwork beneath it on every frame**, and this
artwork is fifty filled paths. If you are tempted to animate a mask, clip, or
filter over this drawing, that is the reason not to.

The leaf clips are lens-shaped outlines built from each blade's stem-to-tip
axis, not the hit-area ellipse: cake and florals sit inside the ring, where an
ellipse also encloses lengths of vine and would colour them along with the leaf.

---

## Placeholders

The galleries are empty until Neida uploads photographs through the admin. That
is the intended starting state: blank sections are omitted rather than rendered
empty, so the site looks deliberate while she fills it in.

`scripts/generate-placeholders.mjs` and `public/media/<section>/placeholder-*.svg`
are left over from before the admin existed and can be deleted — nothing reads
them any more.

---

## Checks

```bash
npm run dev                       # in one terminal
node scripts/verify-ui.mjs /tmp   # in another
```

`verify-ui.mjs` drives a real browser and asserts what static output can't show:
the entrance runs and finishes, nothing is selected on load, a lit leaf shows its
own colour, selecting swaps the panel, arrow keys move selection and focus, and
the lightbox traps focus and restores it on Escape.

Two things it has to get right, learned the hard way:

- Headless Chrome throttles `requestAnimationFrame` to a few frames a second,
  which freezes every GSAP tween and makes working animations look broken. The
  launch flags in the script keep the ticker running.
- The entrance is pure CSS, so it completes whether or not Vue has hydrated.
  Waiting on it is not a readiness signal — clicks fired on the strength of it
  silently did nothing. `selectLeaf()` retries until a click actually sticks.

Also worth checking by hand: turn on **System Settings → Accessibility → Reduce
Motion** and reload. The vine should appear without the sweep, hold still, and
navigate instantly.

---

## Deploying

Two containers on the VPS — `web` (Django + gunicorn, serving the API and the
admin) and `nginx` (serving the built site, the uploads, and proxying the rest).
Cloudflare in front, as with graze.

```
Cloudflare → VPS:80 → nginx ─┬─ /              → Nuxt static build
                              ├─ /api/, /admin/ → gunicorn
                              ├─ /static/       → gunicorn (WhiteNoise)
                              └─ /media/        → nginx, straight off the volume
```

```bash
cp etc/docker/.env.production.example etc/docker/.env.production   # then fill it in
./etc/build.sh      # ssh, git pull, docker build
./etc/deploy.sh     # ssh, docker compose up -d
```

Two helpers wrap docker compose so the long invocation is not repeated:
`./etc/compose.sh` runs it here, `./etc/remote.sh` runs it on the VPS. Both take
any subcommand and work from any directory.

```bash
./etc/compose.sh up -d                 # locally
./etc/remote.sh ps                     # on the VPS
./etc/remote.sh logs web --tail 50
./etc/remote.sh exec web python manage.py createsuperuser
```

### First-time VPS setup

1. Clone to `/opt/neida`, and add a `neida` host to your `~/.ssh/config`.
   (Both are overridable: `VPS_HOST` and `DEPLOY_PATH`.)
2. Fill in the environment:
   ```bash
   cp etc/docker/.env.production.example etc/docker/.env.production
   ```
   `DJANGO_SECRET_KEY` at minimum, and the real domain in
   `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS` — Django rejects
   requests whose Host it does not recognise.
3. Build and start:
   ```bash
   ./etc/build.sh
   ./etc/deploy.sh
   ```
4. Create Neida's account — on the VPS, since that database is its own:
   ```bash
   ./etc/remote.sh exec web python manage.py createsuperuser
   ```
5. Cloudflare Tunnel, so this needs no inbound port and graze keeps :80:
   Zero Trust → Networks → Tunnels → create one, add a public hostname for
   `neidarodriguez.com` pointing at `http://nginx:80`, and put the token in
   `CLOUDFLARE_TUNNEL_TOKEN`. The deploy scripts start it; a local
   `./etc/compose.sh up` does not.

   No DNS record to add by hand — the tunnel creates it.

There is no data import step. The sections are created by the entrypoint, and
everything else is entered through the admin — so nothing needs migrating from
your machine, and nothing you typed locally while testing follows you into
production.

**TLS.** Cloudflare terminates it and reaches the stack through the tunnel, so
nothing needs a certificate on the VPS and no port is exposed. nginx passes the
scheme the visitor actually used through to Django, without which Django treats
the request as insecure and rejects the admin login on CSRF.

**Sharing graze's VPS.** The tunnel is what makes this safe: nothing binds a
public port, so graze's nginx keeps :80 and neither project's config touches the
other. `HTTP_BIND` stays on localhost, for curling the stack from the box.

### Updating

```bash
git push
./etc/build.sh      # pulls and rebuilds on the VPS
./etc/deploy.sh     # restarts; migrations run on start
```

Both scripts take `VPS_HOST` and `DEPLOY_PATH` from the environment, defaulting
to `neida` and `/opt/neida`.

**Sharing a VPS.** This stack binds host port 80 by default, and so does graze —
two of them on one box will not both start. Set `HTTP_BIND=127.0.0.1:8081` in
`.env.production` and route by hostname from a proxy in front, or give it its
own VPS.

**No Postgres.** Graze needs it; this does not — eight sections, a few hundred
photographs, one editor. SQLite on a volume is ample, is one less service to run
and upgrade, and backing it up is copying a single file.

Three volumes, and the reason for each: `db_data` and `media_data` hold the only
things that cannot be rebuilt from the repo, and `frontend_dist` hands the built
site from the web container to nginx.
