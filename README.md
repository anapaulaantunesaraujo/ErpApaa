# ErpApaa - Sistema Integrado de Gestão Empresarial (APAA Treinamento)

Sistema ERP desenvolvido para a **APAA Treinamento**, projetado com arquitetura moderna, escalável, conteinerizada em Docker e pronta para publicação em servidor Linux/Ubuntu com proxy reverso Nginx e banco de dados PostgreSQL.

---

## 🚀 Tecnologias Utilizadas

- **Frontend & Backend**: [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) (versão 16)
- **ORM & Migrations**: [Prisma ORM](https://www.prisma.io/)
- **Autenticação**:
  - Apenas colaboradores pré-cadastrados (sem logins sociais externos)
  - Hash seguro de senhas com `bcryptjs`
  - Sessão criptografada via tokens JWT com cookies `HttpOnly` e `SameSite=Lax`
- **Conteinerização**: Docker & Docker Compose com multi-stage build (saída *standalone* otimizada para baixo consumo de memória)
- **Servidor Web / Proxy Reverso**: Nginx

---

## 👤 Credenciais Iniciais de Administrador

O banco de dados é inicializado automaticamente com o perfil de acesso total:

- **E-mail**: `ana.antunes@apaatreinamento.net.br`
- **Senha**: `123`
- **Perfil**: `ADMIN` (Acesso total)

> O script de semente (`prisma/seed.js`) é executado automaticamente na subida dos contêineres Docker, garantindo que o usuário esteja criado caso ainda não exista.

---

## 🐳 Executando com Docker (Recomendado)

A aplicação já conta com `Dockerfile` e `docker-compose.yml` pré-configurados, incluindo o PostgreSQL com persistência de dados em volume e auto-migração de banco.

### 1. Clonar ou abrir o repositório
```bash
git clone <url-do-repositorio>
cd ErpApaa
```

### 2. Configurar variáveis de ambiente
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```
*(Edite o `.env` se desejar alterar senhas ou portas).*

### 3. Subir os contêineres
```bash
docker compose up -d --build
```

O comando irá:
1. Iniciar o contêiner do PostgreSQL e aguardar o status saudável (*healthcheck*).
2. Construir a imagem otimizada do Next.js.
3. Aplicar o schema do banco de dados automaticamente (`prisma db push`).
4. Executar o seed criando o usuário administrador inicial `ana.antunes@apaatreinamento.net.br`.
5. Disponibilizar a aplicação em `http://localhost:3000`.

---

## 🌐 Publicação no Servidor Ubuntu com Nginx

O projeto foi preparado para conviver harmoniosamente com outras aplicações no mesmo servidor Ubuntu.

### Passo 1: Ajustar a porta no `docker-compose.yml` (se necessário)
Caso a porta `3000` do host já esteja em uso por outro aplicativo no servidor Ubuntu, defina no seu arquivo `.env`:
```env
APP_PORT=3005
```

### Passo 2: Configurar o Proxy Reverso no Nginx
Crie o arquivo de configuração para o subdomínio do ERP no Ubuntu:

```bash
sudo nano /etc/nginx/sites-available/erp-apaa
```

Cole o modelo disponível em `nginx/erp-apaa.conf`:

```nginx
server {
    listen 80;
    server_name erp.apaatreinamento.net.br; # Seu domínio ou subdomínio

    location / {
        proxy_pass http://127.0.0.1:3000; # Ou a porta configurada em APP_PORT
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
    }

    # Cache estático de assets
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000/_next/static/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 365d;
        access_log off;
    }

    client_max_body_size 50M;
}
```

Ative o site e recarregue o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/erp-apaa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Passo 3: Ativar SSL gratuito com Let's Encrypt Certbot
```bash
sudo certbot --nginx -d erp.apaatreinamento.net.br
```

---

## 💻 Desenvolvimento Local sem Docker

Caso queira rodar o Next.js diretamente em sua máquina com Node.js:

1. Tenha uma instância PostgreSQL em execução e configure a URL no `.env`:
   ```env
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/erp_apaa?schema=public"
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Sincronize o banco e execute o seed:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000`.

---

## 📁 Estrutura de Diretórios

```
ErpApaa/
├── docker-compose.yml       # Configuração dos serviços Docker (Postgres + App)
├── Dockerfile               # Build multi-stage otimizado para produção
├── docker-entrypoint.sh     # Script de inicialização (migrations + seed + app)
├── nginx/
│   └── erp-apaa.conf        # Template de proxy reverso Nginx para Ubuntu
├── prisma/
│   ├── schema.prisma        # Modelo de dados (User, Role, etc.)
│   └── seed.js              # Criação automática do usuário admin inicial
├── src/
│   ├── app/
│   │   ├── api/auth/
│   │   │   ├── login/route.ts   # Autenticação de e-mail e senha
│   │   │   ├── logout/route.ts  # Encerramento de sessão
│   │   │   └── me/route.ts      # Dados do usuário logado
│   │   ├── login/
│   │   │   └── page.tsx         # Tela de login elegante e responsiva
│   │   ├── globals.css          # Estilos globais e Tailwind CSS
│   │   ├── layout.tsx           # Layout raiz com fontes do sistema
│   │   └── page.tsx             # Tela inicial (Início / Dashboard limpo)
│   ├── components/
│   │   └── UserNav.tsx          # Componente de topo com perfil e botão sair
│   ├── lib/
│   │   ├── auth.ts              # Utilitários de hash bcrypt e JWT
│   │   └── prisma.ts            # Cliente singleton do Prisma ORM
│   └── middleware.ts            # Proteção de rotas e redirecionamento de sessão
├── .env.example             # Exemplo de variáveis de ambiente
└── package.json
```
