# Backend - Zentry (Node.js + Express + Sequelize + Postgres)

## 1. O que precisa baixar

1. Node.js 20+ (recomendado LTS)
2. npm 10+
3. Docker Desktop (recomendado para banco de teste local)
4. Git
5. VS Code (opcional)

## 2. Extensoes recomendadas (VS Code)

1. `ESLint` (dbaeumer.vscode-eslint)
2. `Prettier - Code formatter` (esbenp.prettier-vscode)
3. `Docker` (ms-azuretools.vscode-docker)
4. `SQLTools` (mtxr.sqltools)
5. `SQLTools PostgreSQL/Cockroach Driver` (mtxr.sqltools-driver-pg)
6. `EditorConfig for VS Code` (EditorConfig.EditorConfig)

## 3. Instalar dependencias

```bash
cd backend
npm install
```

## 4. Configurar ambiente (`.env`)

Crie `backend/.env` com os dados do banco principal (normalmente cloud):

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://usuario:senha@host:5432/nome_do_banco
JWT_SECRET=sua_chave_jwt
JWT_EXPIRES_IN=1d
DB_SSL=true
DB_SYNC_ALTER=false
```

Notas:

1. `DB_SSL=true` para bancos cloud.
2. Se usar Postgres local (`localhost`), use `DB_SSL=false`.
3. `DB_SYNC_ALTER` so use `true` quando souber exatamente o impacto.

## 5. Rodar backend em desenvolvimento

```bash
npm run dev
```

Health check:

```txt
GET http://localhost:3000/api/health
```

## 6. Banco de teste local (Docker)

### 6.1 Subir container Postgres de teste

```bash
docker run --name zentry-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=zentry_test -p 5433:5432 -d postgres:16
```

Se o container ja existir:

```bash
docker start zentry-test-pg
```

Verificar:

```bash
docker ps
```

### 6.2 Configurar `backend/.env.test`

```env
JWT_SECRET=test_secret_local
JWT_EXPIRES_IN=1d
DATABASE_URL=postgres://postgres:postgres@localhost:5433/zentry_test
DB_SSL=false
```

### 6.3 Rodar migracao SQL no banco de teste

Opcao A (com `psql` instalado localmente):

```bash
psql "postgres://postgres:postgres@localhost:5433/zentry_test" -f "E:\Projeto React\backend\sql\migrations\20260330_001_create_service_orders.sql"
```

Opcao B (sem `psql` local, usando o proprio container):

```bash
Get-Content "E:\Projeto React\backend\sql\migrations\20260330_001_create_service_orders.sql" | docker exec -i zentry-test-pg psql -U postgres -d zentry_test
```

## 7. Scripts uteis

```bash
npm run dev
npm run dev:test
npm run build
npm run start
npm run test
npm run test:watch
npm run test:coverage
```

### O que cada um faz

1. `dev`: usa `.env` (ambiente principal).
2. `dev:test`: usa `.env.test` (ambiente local de teste).
3. `test*`: roda Jest com `.env.test`.

## 8. Fluxo recomendado para novos devs

1. Clonar o projeto.
2. Rodar `npm install`.
3. Configurar `.env`.
4. Rodar `npm run dev`.
5. Para testes seguros sem custo cloud:
   1. Subir Postgres Docker local.
   2. Configurar `.env.test`.
   3. Rodar migracao SQL.
   4. Rodar `npm run dev:test` e `npm run test`.

