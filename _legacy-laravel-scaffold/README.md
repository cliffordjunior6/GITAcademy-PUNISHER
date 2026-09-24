# Legacy Laravel scaffold (not used by the running app)

These files are leftover scaffolding from an earlier plan to build the backend
in Laravel: route declarations (`api.php`), a seeder, a test, CI config, and
Docker/Nginx config for a Laravel + MySQL stack.

**None of this ever ran.** There was no `composer.json`, no `vendor/`, no
`app/Http/Controllers`, and no `app/Models` — `api.php` referenced controller
classes that were never written, and its routes didn't even match the ones
the frontend (`api.js`) actually calls.

The real, working backend is the plain PHP + SQLite API in `/api` at the
project root (`api/index.php`, `api/schema.sql`, `api/seed.php`) — see the
main `README.md` for how to run it. These files are kept only for reference
in case a future contributor wants to migrate to Laravel + MySQL for a real
production deployment; `_all_migrations.php` in particular is a reasonably
complete schema reference. They are not wired into anything and can be
deleted safely.
