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

# The exec "$@" command replaces the script with the CMD from the Dockerfile.
# This ensures your application becomes the main process (PID 1) and can receive OS signals correctly.
exec "$@"
