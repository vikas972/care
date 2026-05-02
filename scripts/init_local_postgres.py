#!/usr/bin/env python3
"""
Create local role `smartcall` + database `smartcall` (no `psql` required).

Requires psycopg2 (same venv as the API): pip install -r requirements.txt

Usage (one of):

  export POSTGRES_ADMIN_URL='postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres'
  # optional: export SMARTCALL_DB_PASSWORD='your_app_password'  # must match DATABASE_URL
  python scripts/init_local_postgres.py

Or add POSTGRES_ADMIN_URL to `.env` (do not commit it), then:

  python scripts/init_local_postgres.py

Then set DATABASE_URL in `.env` to (password must match SMARTCALL_DB_PASSWORD, default `smartcall`):
  postgresql+psycopg2://smartcall:smartcall@127.0.0.1:5432/smartcall
and run: alembic upgrade head

If alembic says "password authentication failed for user smartcall", the role may exist
with a different password — run this script again; it will ALTER ROLE to match.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def main() -> int:
    _load_dotenv()
    app_password = (os.environ.get("SMARTCALL_DB_PASSWORD") or "smartcall").strip() or "smartcall"
    url = (os.environ.get("POSTGRES_ADMIN_URL") or "").strip()
    if not url:
        print(
            "POSTGRES_ADMIN_URL is not set.\n"
            "Use your Postgres superuser (often `postgres`), e.g.:\n"
            "  export POSTGRES_ADMIN_URL='postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres'\n"
            "  python scripts/init_local_postgres.py",
            file=sys.stderr,
        )
        return 1

    try:
        import psycopg2
    except ImportError as e:
        print("psycopg2 is required: pip install psycopg2-binary", file=sys.stderr)
        raise SystemExit(1) from e

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", ("smartcall",))
        if not cur.fetchone():
            cur.execute(
                "CREATE ROLE smartcall WITH LOGIN PASSWORD %s",
                (app_password,),
            )
            print("Created role smartcall")
        else:
            # Ensure password matches .env (fixes "FATAL: password authentication failed for user smartcall")
            cur.execute("ALTER ROLE smartcall WITH PASSWORD %s", (app_password,))
            print("Role smartcall exists — password updated to match SMARTCALL_DB_PASSWORD (default: smartcall)")

        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("smartcall",))
        if not cur.fetchone():
            cur.execute("CREATE DATABASE smartcall OWNER smartcall")
            print("Created database smartcall")
        else:
            print("Database smartcall already exists")
    finally:
        cur.close()
        conn.close()

    print("Done. Next: alembic upgrade head")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
