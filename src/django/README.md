# The admin

Django + [Unfold](https://unfoldadmin.com/), so Neida can add photos and edit
text without touching files. The front end reads from it live: she saves, she
refreshes, it's there — no publish step, no rebuild.

## Running it

From the project root:

```bash
./etc/start.sh                  # creates the venv, migrates, serves :8000
cd src/site && npm run dev      # the site on :3000
```

Admin at http://127.0.0.1:8000/admin/ · feed at `/api/content/`. Both need to be
running.

> A virtualenv hardcodes an absolute path into every script it contains, so
> moving or cloning the project leaves one that looks fine but cannot run — and
> the error is misleading, because the shebang is truncated at the kernel's
> length limit and names a path that never existed. `start.sh` checks the venv
> actually runs, not just that the folder is there, and rebuilds it if not.

## Making Neida an account

```bash
cd src/django
./.venv/bin/python manage.py createsuperuser
```

It asks for a username, an email and a password — type the password you want her
to have, then tell her to change it from the admin once she's in. Nothing in this
repo contains a password, and nothing should.

If she ever forgets it:

```bash
cd src/django && ./.venv/bin/python manage.py changepassword <her-username>
```

**The deployed site has its own separate database.** An account made locally
cannot sign in there. For the live one, create it inside the container:

```bash
docker compose -f etc/docker/docker-compose.yml \
  --env-file etc/docker/.env.production \
  exec web python manage.py createsuperuser
```

## What she can edit

- **Your details** — name, the line beneath it, the intro, the About text,
  contact and footer links.
- **Sections** — one per leaf on the vine. Heading, tagline, opening paragraph,
  and whether it's visible at all. Photos, publications and workshops are edited
  on the section itself, since a photograph only means anything in context.
- **Pictures** — every photo across every section, for finding one without
  remembering where it lives.

Anything blank is omitted from the page rather than rendered empty, so a
half-finished section still looks deliberate.

### What she can't, on purpose

A section's **leaf, layout, colour and order** sit collapsed under "Fixed by the
drawing". Each section is a leaf on Neida's artwork, and the leaves' positions
are measured by hand in `app/components/vine-leaves.ts`. Inventing a ninth
section would produce something with no leaf to click, so the leaf field is a
fixed list of the eight that exist. A genuinely new discipline needs new artwork
and a new measured position — a developer job.

## Deploying

Everything environment-specific reads from env vars; see `.env.example`. Defaults
are SQLite and local-disk media so it runs with no configuration at all.

Recommended: **Railway** — it runs both services, Postgres is one click, and a
mounted volume handles uploads without needing S3 at this scale. Render is
equivalent. Whichever you pick:

- Set `DJANGO_SECRET_KEY`. Without it the fallback regenerates on every start,
  which silently signs everyone out on each deploy.
- Set `DJANGO_DEBUG=0`, and `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS`
  to the admin's domain.
- Set `DJANGO_PUBLIC_BASE_URL` to this service's public address — uploaded image
  URLs are built from it, so getting it wrong shows broken pictures.
- Set `DJANGO_CORS_ALLOWED_ORIGINS` to the site's address, or the browser blocks
  the front end from reading the feed.
- Point `DJANGO_MEDIA_ROOT` at a mounted volume, or uploads vanish on redeploy.
- Set `NUXT_PUBLIC_API_BASE` on the front end to this service's address.
