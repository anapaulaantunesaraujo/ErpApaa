#!/bin/sh
set -e

# Se DATABASE_URL estiver configurada, tenta aplicar migrações sem derrubar o contêiner em caso de falha de rede inicial
if [ -n "$DATABASE_URL" ]; then
  echo "==> Conexão com banco detectada. Sincronizando tabelas com Prisma..."
  npx prisma db push --skip-generate || echo "AVISO: Falha ao executar prisma db push na inicialização."

  echo "==> Executando seed de inicialização..."
  node prisma/seed.js || echo "AVISO: Falha ao executar seed na inicialização."
else
  echo "==> DATABASE_URL não definida, iniciando sem db push..."
fi

echo "==> Iniciando aplicação ErpApaa na porta ${PORT:-3000}..."
exec node server.js

