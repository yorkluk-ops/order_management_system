#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and start with docker compose." >&2
  exit 1
fi

echo "Waiting for MySQL..."
node --input-type=module <<'EOF'
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
for (let attempt = 1; attempt <= 30; attempt++) {
  try {
    const connection = await mysql.createConnection(url);
    await connection.query("select 1");
    await connection.end();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`database not ready (${attempt}/30): ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
console.error("database did not become ready");
process.exit(1);
EOF

echo "Applying database migrations..."
node ./node_modules/drizzle-kit/bin.cjs migrate

echo "Starting OMS on 0.0.0.0:${PORT:-3000}"
exec node dist/index.js
