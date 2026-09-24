# TempoPoint

TempoPoint est le SaaS de gestion du temps de LFINFO pour les PME et leurs équipes de terrain.

Le [cahier des charges fonctionnel et technique](LFINFO_HOURS_CAHIER_DES_CHARGES.md)
constitue la source de vérité. Le lire intégralement avant toute modification et
respecter l'ordre des jalons. Les JALONS 0 à 2 constituent la fondation actuelle,
en version `0.1.0`.

## Prérequis et installation

- Node.js **24 LTS** (`.nvmrc`), pnpm **10.12.4**.
- Aucun PostgreSQL ni secret nécessaire pour ce jalon.

Depuis la racine du dépôt :

```sh
pnpm install --frozen-lockfile
```

Copier `.env.example` vers `.env` si des valeurs doivent être personnalisées
(`Copy-Item .env.example .env` sous PowerShell, `cp .env.example .env` sous Unix).
Le backend charge ce fichier depuis la racine, quel que soit le répertoire de
lancement. Les variables du processus ont priorité.

## Développement

```sh
pnpm dev
```

Ouvrir http://127.0.0.1:5173. Vite transmet `/api` au backend sur
`127.0.0.1:3000` (ou le `PORT` configuré). Le backend et Vite se rechargent
pendant le développement. Après modification du package `shared`, relancer
`pnpm dev` pour le recompiler.

## Build et exécution

```sh
pnpm build
pnpm pm2:start
```

Cette dernière commande exécute `pm2 start ecosystem.config.cjs` avec le PM2 local
au projet. Un seul processus Node en mode `fork` sert en production :

- http://localhost:3000/ : application React TempoPoint ;
- http://localhost:3000/api/health : `{"data":{"status":"ok","version":"0.1.0"}}` ;
- les assets compilés et les navigations React Router.

Le health check vérifie que le serveur répond ; aucune base de données n'est
encore connectée. Une route API ou un asset absent renvoie une erreur JSON 404.
Une navigation HTML vers une route inconnue charge React et sa page introuvable.
Un build frontend absent empêche le démarrage en production.

```sh
pnpm exec pm2 status
pnpm exec pm2 logs tempopoint
pnpm pm2:stop
```

Pour démarrer sans PM2, définir `NODE_ENV=production` puis lancer `pnpm start`.
PowerShell : `$env:NODE_ENV='production'; pnpm start`.
Unix : `NODE_ENV=production pnpm start`.

## Variables d'environnement

| Variable      | Valeur par défaut       | Usage                                                                     |
| ------------- | ----------------------- | ------------------------------------------------------------------------- |
| `NODE_ENV`    | `development`           | `development`, `test` ou `production` ; PM2 impose `production`.          |
| `HOST`        | `0.0.0.0`               | Adresse d'écoute du backend.                                              |
| `PORT`        | `3000`                  | Port entier de 1 à 65535 ; également utilisé par le proxy Vite.           |
| `APP_URL`     | `http://localhost:3000` | URL publique validée, réservée aux usages futurs.                         |
| `TRUST_PROXY` | `false`                 | Désactivé ou liste d'IP/CIDR de proxies fiables séparés par des virgules. |
| `LOG_LEVEL`   | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.             |

Configurer `TRUST_PROXY` avec les adresses réelles du reverse proxy avant un
déploiement derrière proxy ; `true` est volontairement refusé. Les valeurs de
production dépendent de l'infrastructure et ne sont pas présumées.

`DATABASE_URL`, `SESSION_SECRET` et `SMTP_*` sont des réservations pour les jalons
suivants, non consommées ici. Les valeurs inconnues restent `A_REMPLIR`.
Ne jamais versionner de secret ; aucune variable serveur n'est exposée via
un préfixe `VITE_`.

## Vérifications

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:dev
pnpm test:pm2
git diff --check
```

`pnpm test` compile les trois packages puis teste health, les assets, le fallback,
les erreurs et la validation de configuration. Les tests Playwright vérifient
le rendu React, l'API, les liens profonds et l'état d'indisponibilité sur desktop
et mobile ; `test:dev` teste les mêmes parcours à travers le proxy Vite.

Le test PM2 démarre une instance isolée (`PM2_HOME` dans `test-results`), vérifie
le processus unique et les réponses HTTP, puis arrête son propre daemon.
Libérer les ports 3000, 3001 et 5173 avant les tests qui les utilisent.
Les navigateurs mobiles sont émulés ; aucun smartphone physique n'est requis
pour ce jalon.

## Organisation et périmètre

- `frontend/` : React, React Router, TanStack Query, Tailwind CSS et Vite.
- `backend/` : Fastify, configuration validée avec Zod, service statique.
- `shared/` : contrat health partagé, schéma Zod et type TypeScript.
- `tests/` : tests Vitest, Playwright et vérification PM2.

TypeScript strict est activé sur les trois packages et les tests.
L'authentification, Prisma/PostgreSQL, l'isolation multi-tenant et la PWA/offline
appartiennent aux jalons suivants. Cette fondation ne manipule aucune donnée
métier et ne constitue pas encore une application prête pour des clients.

## Base de données et isolation tenant

Le JALON 2 utilise PostgreSQL et Prisma. Les migrations versionnées sont dans
`backend/prisma/migrations/`; aucun serveur ne se connecte à la base tant qu’une
fonctionnalité métier ne l’exige. Pour une base configurée, renseigner une URL
PostgreSQL dans `.env`, puis exécuter :

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Le seed de développement crée les sociétés sentinelles A et B et leurs rôles
ADMIN, MANAGER et WORKER. Les données tenant sont protégées par repositories
server-side et par PostgreSQL RLS. Consulter
[la documentation d’isolation](docs/tenant-isolation.md) avant toute évolution
métier ou de schéma.

```sh
pnpm test:integration
```

Cette commande démarre un PostgreSQL vierge via Docker, applique les migrations,
exécute le seed et prouve l’isolation A/B avec un rôle applicatif non privilégié.
Docker Desktop doit être démarré ; les identifiants de test sont éphémères.
