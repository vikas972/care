-- Local Postgres bootstrap for this app (role + database).
-- If `psql` is not installed, use Python instead: see scripts/init_local_postgres.py
--
-- With psql (as a superuser), e.g.:
--   psql -h 127.0.0.1 -U postgres -d postgres -f scripts/init_local_postgres.sql
--
-- Then set `.env` DATABASE_URL to:
--   postgresql+psycopg2://smartcall:smartcall@127.0.0.1:5432/smartcall
-- and run: alembic upgrade head

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartcall') THEN
    CREATE ROLE smartcall WITH LOGIN PASSWORD 'smartcall';
  END IF;
END
$$;

-- If this errors with "database already exists", ignore it and continue to migrations.
CREATE DATABASE smartcall OWNER smartcall;
