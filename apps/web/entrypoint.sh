#!/bin/sh

# Run database migrations (non-fatal: app starts even if migrations fail)
echo "Running database migrations..."
if prisma migrate deploy --schema packages/db/prisma/schema; then
  echo "Database migrations completed successfully."
else
  echo "WARNING: Database migrations failed. The app will still start."
  echo "Check your DATABASE_URL and ensure the database is reachable."
fi

# Start the Next.js server (setup URL is logged by the instrumentation hook)
exec "$@"
