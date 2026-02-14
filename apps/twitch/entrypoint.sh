#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Run database migrations
echo "Running database migrations..."
cd /usr/src/app/packages/db
npx prisma migrate deploy
cd /usr/src/app

# The exec "$@" command replaces the script with the CMD from the Dockerfile.
# This ensures your application becomes the main process (PID 1) and can receive OS signals correctly.
exec "$@"
