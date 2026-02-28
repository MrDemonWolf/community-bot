#!/bin/sh

# Run database migrations (non-fatal: app starts even if migrations fail)
echo "Running database migrations..."
cd /usr/src/app/packages/db
if npx prisma migrate deploy; then
  echo "Database migrations completed successfully."
else
  echo "WARNING: Database migrations failed. The app will still start."
  echo "Check your DATABASE_URL and ensure the database is reachable."
fi
cd /usr/src/app

# Log the setup URL if first-time setup hasn't been completed
node scripts/log-setup-url.mjs || true

# Start the Next.js server
exec "$@"
