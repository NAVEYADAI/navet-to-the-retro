#!/bin/sh
# Dev container only (Dockerfile.dev): regenerate the Prisma client AND bring the DEVELOPMENT database in line with
# prisma/schema.prisma — at container start and whenever schema.prisma changes (nodemon). Production is never touched
# here: push-dev refuses unless APP_ENV=development, and refuses a host equal to PROD_DATABASE_URL.
# It never blocks the server from starting: on a refusal or a data-loss-prone change it says so and carries on.
npx prisma generate
if ! node scripts/schema-sync.js push-dev; then
  echo "⚠  Development schema sync did NOT run (reason above). The server starts anyway — fix it, or run: npm run schema:plan:dev --prefix backend"
fi
exit 0
