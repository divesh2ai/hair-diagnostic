Prisma Migration Guide — WhatsappSession
=====================================

This project added a `WhatsappSession` Prisma model to map WhatsApp IDs to internal sessions.

Two options to apply the migration to your Postgres DB:

1) Recommended — use Prisma Migrate (when you have a DB available)

   - Ensure `DATABASE_URL` in `.env` points to your Postgres instance.
   - Run:

```bash
npx prisma migrate dev --name add_whatsapp_session
npx prisma generate
```

   - This will create a migration and apply it to the DB. Use `--preview-feature` if older Prisma required it.

2) Run raw SQL (when you cannot run Prisma migrate)

   - The SQL file is at `prisma/migrations/0001_add_whatsapp_session/migration.sql`.
   - Apply it using `psql` or your DB client. Example:

```bash
# on Linux/macOS with psql available:
psql "$DATABASE_URL" -f prisma/migrations/0001_add_whatsapp_session/migration.sql

# or save DB creds and run via pg:psql
```

Notes
-----
- The Prisma model uses string IDs (cuid()). The raw SQL uses `TEXT` for compatibility.
- If your `Session` table has a different name or schema, adapt the foreign key reference accordingly.
- After applying the migration, run `npx prisma generate` so the Prisma Client has updated types.

Rollback
--------
- To revert the raw SQL change, drop the table:

```sql
DROP TABLE IF EXISTS "WhatsappSession";
```
