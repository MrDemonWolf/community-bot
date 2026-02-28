#!/bin/sh

# Database migrations are handled by the Twitch bot entrypoint.
# The web app only needs to start the Next.js server.

exec "$@"
