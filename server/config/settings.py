"""
Django settings for Neida's portfolio admin.

Defaults are chosen so this runs with no configuration at all — SQLite, media
on local disk — while every deployment-specific value reads from the
environment. Moving to Postgres and a mounted volume is then configuration
rather than a code change.
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# --- core -------------------------------------------------------------------

# Generated per-install. Set DJANGO_SECRET_KEY in any environment that matters:
# without it the fallback below is regenerated on every start, which silently
# logs everyone out on each deploy.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-not-for-deployment")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "")

INSTALLED_APPS = [
    # Unfold must precede django.contrib.admin: it overrides the admin's own
    # templates, and the first app to provide a template wins.
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "portfolio",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- data -------------------------------------------------------------------

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- locale -----------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

# --- files ------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "media/"
# Uploads live outside the code tree so a deployment can mount a volume here
# without the app's own files getting in the way.
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", BASE_DIR / "media"))

# Absolute base for URLs handed to the front end. The front end runs on a
# different origin, so relative media paths would resolve against Nuxt and 404.
PUBLIC_BASE_URL = os.environ.get("DJANGO_PUBLIC_BASE_URL", "http://127.0.0.1:8000")

# --- the front end ----------------------------------------------------------

# The API is read-only and public, so this is not protecting anything secret —
# it just keeps the browser from complaining during local development.
CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)

# --- admin ------------------------------------------------------------------

UNFOLD = {
    "SITE_TITLE": "Neida's portfolio",
    "SITE_HEADER": "Neida's portfolio",
    "SITE_SUBHEADER": "Add and edit what appears on the site",
    "SITE_URL": os.environ.get("SITE_URL", "http://localhost:3000"),
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "COLORS": {
        # The site's own terracotta, so the admin feels like part of the project.
        "primary": {
            "50": "250 245 242", "100": "244 232 226", "200": "233 209 197",
            "300": "222 185 167", "400": "200 138 109", "500": "181 103 74",
            "600": "163 93 67", "700": "136 77 55", "800": "109 62 44",
            "900": "89 51 36", "950": "48 27 19",
        },
    },
    "SIDEBAR": {
        "show_search": False,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Your site",
                "separator": False,
                "items": [
                    {
                        "title": "Your details",
                        "icon": "person",
                        "link": lambda request: "/admin/portfolio/siteinfo/",
                    },
                    {
                        "title": "Sections",
                        "icon": "eco",
                        "link": lambda request: "/admin/portfolio/section/",
                    },
                    {
                        "title": "Pictures",
                        "icon": "photo_library",
                        "link": lambda request: "/admin/portfolio/piece/",
                    },
                ],
            },
            {
                "title": "Account",
                "separator": True,
                "items": [
                    {
                        "title": "People who can sign in",
                        "icon": "key",
                        "link": lambda request: "/admin/auth/user/",
                    },
                ],
            },
        ],
    },
}
