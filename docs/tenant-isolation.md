# Isolation multi-tenant

Le JALON 2 applique l'isolation à deux niveaux.

1. Les repositories tenant-aware n'acceptent jamais de `companyId` en entrée.
   Ils le dérivent exclusivement du `TenantContext` fourni par la future
   authentification serveur.
2. PostgreSQL RLS protège `Company` et `User`. Chaque opération passe par
   `withTenant`, qui exécute `set_config('app.company_id', …, true)` dans
   une transaction Prisma. La valeur est donc locale à la transaction et ne
   fuit pas par le pool de connexions.

Sans contexte, les politiques RLS ne renvoient aucune ligne. Une tentative
d'accéder à un identifiant d'une autre entreprise retourne également une absence
de ressource, sans confirmer son existence.

`PlatformUser` n'est pas une donnée tenant : il demeure hors des repositories
tenant-aware. Son authentification et ses autorisations séparées sont prévues au
JALON 3.

## Test réel

`pnpm test:integration` lance un PostgreSQL 16 vierge dans un projet Docker
éphémère, déploie les migrations, crée un rôle applicatif sans privilège
`BYPASSRLS`, exécute le seed A/B, puis teste l'isolation via ce rôle.
Les mots de passe de ce test sont générés en mémoire et ne sont jamais écrits
dans Git. Docker Desktop doit être démarré.
