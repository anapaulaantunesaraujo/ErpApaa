#!/bin/sh
set -e

echo "==> Aguardando PostgreSQL e aplicando migrações do Prisma..."
npx prisma db push --skip-generate

echo "==> Executando seed de inicialização (usuário administrador)..."
node prisma/seed.js

echo "==> Iniciando aplicação ErpApaa..."
exec node server.js

