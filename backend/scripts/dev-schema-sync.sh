#!/bin/sh
# Dev container only (Dockerfile.dev): regenerate the Prisma client AND apply pending migrations to the DEVELOPMENT
# database — at container start and whenever schema.prisma or a migration changes (nodemon). Production is never touched
# here: `dev` refuses unless APP_ENV=development, and refuses a host equal to PROD_DATABASE_URL.
# It never blocks the server from starting: on a refusal it says so and carries on.
npx prisma generate
if ! node scripts/db-migrate.js dev; then
  echo "⚠  Development migrations did NOT run (reason above). The server starts anyway — fix it, then: npm run migrate:dev --prefix backend"
fi
exit 0
