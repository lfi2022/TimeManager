# TempoPoint --- Cahier des charges fonctionnel et technique

> **Document maître du projet --- Version 0.1**
>
> **Date :** 24 septembre 2026\
> **Produit :** TempoPoint\
> **Éditeur :** LFINFO\
> **Statut :** spécification initiale avant développement\
> **Principe :** ce fichier est la source de vérité fonctionnelle et
> technique du projet.

------------------------------------------------------------------------

## 0. Instructions impératives pour Codex

Codex doit lire **l'intégralité de ce fichier avant toute
modification**.

### 0.1 Règles de travail

-   Ne jamais implémenter plusieurs jalons à la fois sauf demande
    explicite.
-   Travailler dans l'ordre des jalons.
-   Avant un jalon, analyser le code existant et vérifier les
    dépendances avec les jalons précédents.
-   Ne jamais marquer une tâche terminée sans l'avoir réellement
    implémentée et vérifiée.
-   Utiliser les cases Markdown :
    -   `[ ]` = non implémenté ;
    -   `[x]` = implémenté et vérifié.
-   Après chaque fonctionnalité terminée, mettre à jour les cases
    correspondantes dans **ce fichier**.
-   Ne pas supprimer les exigences ou tâches terminées.
-   Ajouter une courte note sous une tâche uniquement si une décision
    technique importante doit être conservée.
-   Ne jamais stocker de secret dans Git.
-   Ne jamais inventer une valeur de production.
-   Toute variable inconnue dans `.env.example` doit utiliser une valeur
    factice explicite ou `A_REMPLIR`.
-   Chaque jalon doit se terminer avec les tests correspondants.
-   `git diff --check` doit être propre avant chaque commit.
-   Chaque jalon doit produire **son propre commit Git**.
-   Ne pas commencer le jalon suivant avant que le jalon courant soit
    fonctionnel.
-   Si un jalon nécessite plusieurs commits pour raison de
    sécurité/récupération, ils sont autorisés, mais un commit final de
    jalon doit exister.
-   Ne jamais contourner un test de sécurité pour faire passer la suite.
-   Une fuite inter-entreprises est un défaut bloquant.
-   Le frontend et le backend doivent rester fortement typés.
-   Toute entrée externe doit être validée côté backend.
-   Les contrôles frontend ne sont jamais considérés comme une sécurité.
-   Les calculs de temps officiels sont effectués côté backend.
-   Les opérations sensibles doivent être auditables.
-   Une prestation validée ou clôturée ne doit pas être modifiée
    silencieusement.

### 0.2 Convention de commit

À la fin de chaque jalon :

``` text
milestone(<numéro>): <description courte>
```

Exemples :

``` text
milestone(1): initialize lfinfo hours foundation
milestone(2): implement authentication and tenant security
milestone(5): implement work entry workflow
```

Le commit doit inclure la mise à jour des cases `[x]` du présent
fichier.

### 0.3 Definition of Done d'un jalon

Un jalon n'est terminé que si :

-   [ ] toutes ses tâches obligatoires sont implémentées ;
-   [ ] les migrations nécessaires fonctionnent sur une base vierge ;
-   [ ] les tests du jalon passent ;
-   [ ] les tests des jalons précédents passent toujours ;
-   [ ] les contrôles d'isolation multi-tenant concernés sont testés ;
-   [ ] le lint/typecheck passe ;
-   [ ] `git diff --check` ne retourne aucune erreur ;
-   [ ] le présent fichier est mis à jour ;
-   [ ] le commit du jalon est créé.

------------------------------------------------------------------------

# 1. Vision du produit

TempoPoint est un SaaS de gestion du temps destiné principalement aux
PME disposant de personnel de terrain : maintenance, électricité, HVAC,
construction, installation, nettoyage, espaces verts, garages,
techniciens et métiers similaires.

Le produit doit remplacer les feuilles papier et tableaux Excel utilisés
pour :

-   encoder les journées ;
-   suivre les heures réellement prestées ;
-   comparer heures prévues et heures réalisées ;
-   calculer les écarts ;
-   gérer un pot d'heures ;
-   contrôler les prestations ;
-   valider les prestations ;
-   préparer les données nécessaires à la paie ;
-   suivre les équipes et chantiers.

TempoPoint n'est pas un ERP généraliste.

La V1 ne doit pas intégrer :

-   facturation client ;
-   devis ;
-   CRM ;
-   comptabilité ;
-   gestion de stock ;
-   achats ;
-   gestion commerciale complète.

Le principe commercial et UX est :

> **Les heures de vos équipes, sans les tableaux Excel.**

------------------------------------------------------------------------

# 2. Utilisateurs cibles

## 2.1 Travailleur

Le travailleur doit pouvoir utiliser l'application presque exclusivement
depuis son téléphone.

Il doit pouvoir :

-   encoder ou pointer sa journée ;
-   sélectionner un chantier ;
-   encoder une pause ;
-   ajouter une remarque ;
-   consulter ses prestations ;
-   consulter leur statut ;
-   consulter son pot d'heures ;
-   consulter son horaire ;
-   recevoir les informations importantes relatives à ses prestations.

## 2.2 Manager

Le manager gère une ou plusieurs équipes.

Il doit pouvoir :

-   voir les travailleurs qu'il supervise ;
-   consulter leurs prestations ;
-   encoder une prestation pour eux si autorisé ;
-   corriger une prestation si autorisé ;
-   approuver ou rejeter une prestation ;
-   consulter les anomalies ;
-   consulter les pots d'heures de son périmètre ;
-   consulter les chantiers nécessaires à son périmètre.

## 2.3 Administrateur d'entreprise

Il administre uniquement sa propre entreprise.

Il doit pouvoir :

-   gérer les utilisateurs ;
-   gérer les équipes ;
-   affecter les managers ;
-   gérer les chantiers ;
-   gérer les horaires ;
-   gérer les règles de calcul ;
-   gérer les jours fériés/configurations applicables ;
-   gérer les prestations ;
-   gérer les corrections ;
-   clôturer des périodes ;
-   exporter les données ;
-   consulter l'audit de son entreprise ;
-   configurer les paramètres disponibles.

## 2.4 Administrateur plateforme LFINFO

L'administration plateforme est séparée des comptes clients.

Un administrateur LFINFO doit pouvoir :

-   créer une entreprise ;
-   activer/désactiver une entreprise ;
-   consulter l'état de l'abonnement ;
-   gérer les paramètres plateforme ;
-   accéder à des fonctions de support explicites ;
-   sélectionner explicitement une entreprise lorsqu'un accès support à
    ses données est nécessaire ;
-   consulter les journaux plateforme autorisés.

Il ne doit jamais être automatiquement assimilé à un utilisateur d'une
entreprise cliente.

------------------------------------------------------------------------

# 3. Stack technique imposée

## 3.1 Frontend

-   React ;
-   TypeScript ;
-   Vite ;
-   React Router ;
-   Tailwind CSS ;
-   shadcn/ui lorsque pertinent ;
-   TanStack Query ;
-   React Hook Form si nécessaire ;
-   Zod pour les schémas partagés ;
-   vite-plugin-pwa ;
-   IndexedDB via Dexie pour les données offline.

## 3.2 Backend

-   Node.js LTS ;
-   TypeScript strict ;
-   Fastify ;
-   Prisma ;
-   Zod ;
-   PostgreSQL ;
-   cookies/sessions sécurisés pour l'authentification ;
-   API REST JSON.

## 3.3 Qualité

-   Vitest ;
-   Playwright ;
-   ESLint ;
-   Prettier ;
-   TypeScript strict ;
-   migrations Prisma versionnées.

## 3.4 Production

Un seul processus Node doit servir :

-   l'API ;
-   le frontend React compilé ;
-   les assets statiques nécessaires.

Port par défaut :

``` text
3000
```

Exemple :

``` text
Reverse proxy HTTPS
        |
        v
10.0.150.6:3000
        |
        +-- Fastify
             +-- /api/*
             +-- /assets/*
             +-- /*
                  -> React
```

Le déploiement doit pouvoir fonctionner avec un seul processus PM2 :

``` text
pm2 start ecosystem.config.cjs
```

Le TLS est normalement terminé par le reverse proxy.

Fastify doit être configuré correctement derrière proxy (`trustProxy`).

------------------------------------------------------------------------

# 4. Architecture du dépôt

Structure cible :

``` text
lfinfo-hours/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── pwa/
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── companies/
│   │   │   ├── users/
│   │   │   ├── teams/
│   │   │   ├── worksites/
│   │   │   ├── schedules/
│   │   │   ├── work-entries/
│   │   │   ├── time-balance/
│   │   │   ├── approvals/
│   │   │   ├── reports/
│   │   │   └── audit/
│   │   ├── plugins/
│   │   ├── security/
│   │   ├── shared/
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── package.json
│
├── shared/
│   ├── schemas/
│   ├── types/
│   └── package.json
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── ecosystem.config.cjs
├── .env.example
├── .gitignore
└── README.md
```

Le projet utilise `pnpm workspaces`.

------------------------------------------------------------------------

# 5. Architecture multi-tenant

## 5.1 Principe

Chaque donnée métier appartenant à une entreprise doit porter ou dériver
sans ambiguïté un `companyId`.

Aucune requête cliente ne peut choisir arbitrairement son `companyId`.

Le tenant actif d'un utilisateur authentifié provient de son identité
serveur.

Exemple conceptuel :

``` ts
request.auth = {
  userId: "...",
  companyId: "...",
  role: "MANAGER"
}
```

Un `companyId` envoyé par le navigateur ne doit jamais permettre de
changer de tenant.

## 5.2 Isolation

L'isolation doit être appliquée en profondeur :

1.  authentification ;
2.  contexte tenant backend ;
3.  services/repositories tenant-aware ;
4.  autorisations ;
5.  validation des relations ;
6.  contraintes DB ;
7.  PostgreSQL Row Level Security lorsque l'architecture retenue le
    permet ;
8.  tests automatiques d'isolation.

Il est interdit de dépendre uniquement d'un filtre dans l'interface.

## 5.3 RLS PostgreSQL

L'objectif est d'utiliser PostgreSQL Row Level Security comme seconde
barrière.

La conception exacte doit être testée avec Prisma avant généralisation.

Si RLS est activé :

-   le contexte de tenant DB doit être défini pour chaque
    transaction/requête concernée ;
-   l'absence de contexte doit échouer de manière fermée ;
-   les migrations et opérations plateforme doivent disposer d'un
    mécanisme explicite ;
-   les tests doivent prouver que des requêtes non filtrées ne révèlent
    pas un autre tenant.

------------------------------------------------------------------------

# 6. Identité, authentification et sécurité

## 6.1 Modèles distincts

Prévoir au minimum :

``` text
PlatformUser
Company
User
```

`PlatformUser` n'appartient pas à une entreprise cliente.

`User` appartient obligatoirement à une `Company`.

## 6.2 Rôles entreprise

``` text
ADMIN
MANAGER
WORKER
```

Les permissions doivent être vérifiées côté backend.

## 6.3 Authentification

Privilégier une session serveur ou un mécanisme de session sécurisé
utilisant un cookie :

-   `HttpOnly` ;
-   `Secure` en production ;
-   `SameSite=Lax` par défaut ;
-   durée de session configurable ;
-   rotation/invalidation appropriée ;
-   protection CSRF pour les opérations concernées.

Ne pas stocker un token d'authentification longue durée dans
`localStorage`.

## 6.4 Mots de passe

-   hash moderne et sûr ;
-   jamais de mot de passe en clair ;
-   politique minimale configurable ;
-   protection contre brute force ;
-   limitation des tentatives ;
-   journalisation des événements de sécurité pertinents ;
-   mécanisme de réinitialisation par jeton à durée limitée.

## 6.5 Support plateforme

Tout accès support aux données d'un client doit être :

-   explicite ;
-   limité à une entreprise sélectionnée ;
-   journalisé ;
-   visible dans l'audit plateforme ;
-   impossible sans contexte entreprise.

------------------------------------------------------------------------

# 7. Modèle de données cible

Les noms exacts peuvent évoluer, mais les concepts ne doivent pas être
supprimés sans décision documentée.

## 7.1 Company

Champs principaux :

``` text
id
name
slug
active
timezone
locale
createdAt
updatedAt
```

Relations :

``` text
users
teams
worksites
schedules
workRules
workEntries
timeBalanceTransactions
auditEvents
```

## 7.2 PlatformUser

``` text
id
email
passwordHash
active
createdAt
updatedAt
lastLoginAt
```

## 7.3 User

``` text
id
companyId
email
passwordHash
firstName
lastName
role
active
employeeNumber?
phone?
timezone?
locale?
createdAt
updatedAt
```

Contrainte :

``` text
UNIQUE(companyId, email)
```

## 7.4 Team

``` text
id
companyId
name
description?
active
createdAt
updatedAt
```

## 7.5 TeamMember

``` text
id
companyId
teamId
userId
isManager
createdAt
```

Une relation TeamMember ne peut jamais relier deux tenants.

## 7.6 Worksite

Un chantier/site représente l'endroit ou le contexte de travail.

``` text
id
companyId
name
code?
description?
address?
active
createdAt
updatedAt
```

## 7.7 Schedule

Permet de définir l'horaire attendu.

``` text
id
companyId
name
weeklyMinutes?
active
createdAt
updatedAt
```

## 7.8 ScheduleDay

``` text
id
companyId
scheduleId
dayOfWeek
expectedMinutes
defaultStartTime?
defaultEndTime?
defaultBreakMinutes?
```

## 7.9 UserScheduleAssignment

Permet de conserver l'historique des horaires.

``` text
id
companyId
userId
scheduleId
validFrom
validUntil?
```

## 7.10 WorkRule

Les règles de calcul ne doivent pas supposer qu'une seule règle légale
convient à toutes les entreprises.

``` text
id
companyId
name
active
dailyExpectedMode
roundingRule?
minimumBreakRule?
overtimeRule?
weekendRule?
nightRule?
configurationJson
createdAt
updatedAt
```

Les règles légales/sociales doivent rester configurables et validables
pour le contexte du client.

## 7.11 WorkEntry

Une prestation conserve les données sources.

``` text
id
companyId
userId
worksiteId?
date
startTime?
endTime?
breakMinutes
workedMinutes
expectedMinutes
differenceMinutes
status
note?
source
createdByUserId?
updatedByUserId?
submittedAt?
approvedAt?
approvedByUserId?
rejectedAt?
rejectedByUserId?
rejectionReason?
createdAt
updatedAt
```

Statuts :

``` text
DRAFT
SUBMITTED
APPROVED
REJECTED
LOCKED
```

Sources possibles :

``` text
MANUAL
CLOCK
OFFLINE_SYNC
MANAGER
IMPORT
```

## 7.12 TimeBalanceTransaction

Le pot d'heures est un **ledger**, pas un simple compteur modifiable.

``` text
id
companyId
userId
workEntryId?
minutes
type
reason?
createdByUserId?
createdAt
```

Types initiaux :

``` text
OVERTIME
RECOVERY
MANUAL_ADJUSTMENT
CORRECTION
OPENING_BALANCE
```

Le solde est calculé à partir des transactions.

Une transaction existante ne doit normalement pas être modifiée pour
changer l'historique. Une correction crée un nouveau mouvement.

## 7.13 AuditEvent

``` text
id
companyId?
platformUserId?
actorUserId?
action
entityType
entityId?
metadataJson
ipAddress?
userAgent?
createdAt
```

Ne jamais stocker de mot de passe, cookie de session ou secret dans
l'audit.

## 7.14 PeriodLock

Pour empêcher la modification silencieuse de périodes déjà
transmises/clôturées.

``` text
id
companyId
startDate
endDate
lockedAt
lockedByUserId
reason?
```

------------------------------------------------------------------------

# 8. Moteur de calcul du temps

Le frontend peut afficher des estimations, mais **le backend est
l'autorité**.

Exemple :

``` text
Début       07:00
Fin         16:30
Pause       00:30
-----------------
Presté      09:00
Prévu       08:00
Différence  +01:00
```

Toutes les durées doivent être stockées/calculées en unités entières,
idéalement en minutes.

Éviter les nombres flottants pour représenter les heures.

Exemple :

``` text
1h30 = 90 minutes
```

Le moteur doit pouvoir évoluer vers :

-   arrondi ;
-   tolérance ;
-   pauses automatiques ;
-   nuit ;
-   week-end ;
-   jours fériés ;
-   récupération ;
-   horaires variables ;
-   temps de déplacement ;
-   astreinte.

Ces extensions ne doivent pas nécessairement être dans la V1.

------------------------------------------------------------------------

# 9. Pot d'heures

Exemple :

``` text
24/09  Heures supplémentaires   +60 min
25/09  Heures supplémentaires   +45 min
28/09  Récupération            -240 min
30/09  Correction               +30 min
```

Le solde correspond à :

``` text
SUM(TimeBalanceTransaction.minutes)
```

Exigences :

-   historique complet ;
-   motif obligatoire pour ajustement manuel ;
-   acteur enregistré ;
-   lien avec WorkEntry lorsqu'applicable ;
-   transaction corrective plutôt qu'écrasement ;
-   permissions strictes ;
-   affichage lisible en heures/minutes.

------------------------------------------------------------------------

# 10. Workflow des prestations

Workflow normal :

``` text
DRAFT
  |
  v
SUBMITTED
  |
  +----> REJECTED
  |         |
  |         v
  |       DRAFT / correction
  |
  v
APPROVED
  |
  v
LOCKED
```

Un travailleur peut préparer/encoder sa journée.

Une entreprise peut choisir ultérieurement entre validation obligatoire
et validation simplifiée.

Une prestation approuvée doit nécessiter une action autorisée pour être
corrigée.

Une période verrouillée doit empêcher les modifications normales.

------------------------------------------------------------------------

# 11. Expérience PWA travailleur

## 11.1 Accueil

L'accueil mobile doit montrer principalement :

-   nom/prénom ;
-   date ;
-   état de la journée ;
-   chantier ;
-   bouton de démarrage ou formulaire rapide ;
-   heures du jour ;
-   pot d'heures ;
-   éventuelle anomalie/action nécessaire.

## 11.2 Mode pointage

Exemple :

``` text
Bonjour Thomas

Chantier
[ Site Bastogne       v ]

[ DÉBUTER MA JOURNÉE ]

Journée démarrée à 07:02

[ TERMINER ]

Fin : 16:21
Pause : 30 min
Travail : 8h49

[ CONFIRMER ]
```

## 11.3 Mode manuel

L'entreprise peut autoriser l'encodage manuel :

``` text
Date
Chantier
Heure de début
Heure de fin
Pause
Commentaire
```

## 11.4 Historique personnel

Le travailleur peut voir :

-   jours ;
-   durée ;
-   chantier ;
-   statut ;
-   écart ;
-   commentaire ;
-   détail.

Il ne peut jamais voir les prestations d'un autre travailleur sauf
permission explicite liée à un autre rôle.

------------------------------------------------------------------------

# 12. Fonctionnement offline

La PWA doit pouvoir survivre à une perte temporaire de réseau.

IndexedDB conserve :

-   action de début ;
-   action de fin ;
-   prestation en attente ;
-   identifiant client idempotent ;
-   date de création locale ;
-   statut de synchronisation.

Chaque mutation offline doit disposer d'un identifiant unique permettant
au backend de garantir l'idempotence.

Exemple :

``` text
Téléphone
   |
   +-- IndexedDB
   |
réseau absent
   |
   +-- queue locale
   |
réseau disponible
   |
   v
/api/sync
   |
   v
validation backend
```

Le serveur reste l'autorité.

Les conflits doivent être signalés, jamais résolus silencieusement
lorsqu'ils changent une prestation déjà modifiée côté serveur.

Ne jamais considérer l'heure du téléphone comme une preuve absolue.

------------------------------------------------------------------------

# 13. Interface Manager

Dashboard manager :

``` text
Équipe aujourd'hui

Thomas       07:00 -> 16:30    9h00   +1h00   APPROUVÉ
Jonathan     08:00 -> 16:00    7h30    0h00   SOUMIS
Pierre       --                 --      --     MANQUANT
```

Fonctions :

-   filtre date ;
-   filtre équipe ;
-   filtre utilisateur ;
-   filtre statut ;
-   anomalies ;
-   prestations manquantes ;
-   validation unitaire ;
-   validation multiple ;
-   rejet avec motif ;
-   correction selon permission ;
-   création pour un travailleur selon permission ;
-   consultation du pot d'heures.

------------------------------------------------------------------------

# 14. Interface Admin entreprise

Sections prévues :

``` text
Dashboard
Prestations
Équipes
Utilisateurs
Chantiers
Horaires
Pot d'heures
Rapports
Exports
Audit
Paramètres
```

L'ADMIN ne doit jamais voir les entreprises voisines.

------------------------------------------------------------------------

# 15. Interface plateforme LFINFO

Sections prévues :

``` text
Entreprises
Abonnements
État plateforme
Support
Audit plateforme
Paramètres plateforme
```

Une entreprise désactivée ne doit plus permettre la connexion normale de
ses utilisateurs.

Les données ne doivent pas être supprimées lors d'une simple
désactivation.

------------------------------------------------------------------------

# 16. API V1 cible

Préfixe obligatoire :

``` text
/api
```

## 16.1 Auth

``` text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/me
```

## 16.2 Utilisateurs

``` text
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
POST   /api/users/:id/activate
POST   /api/users/:id/deactivate
```

## 16.3 Équipes

``` text
GET    /api/teams
POST   /api/teams
GET    /api/teams/:id
PATCH  /api/teams/:id
DELETE /api/teams/:id
POST   /api/teams/:id/members
DELETE /api/teams/:id/members/:userId
```

## 16.4 Chantiers

``` text
GET    /api/worksites
POST   /api/worksites
GET    /api/worksites/:id
PATCH  /api/worksites/:id
POST   /api/worksites/:id/archive
```

## 16.5 Horaires

``` text
GET    /api/schedules
POST   /api/schedules
GET    /api/schedules/:id
PATCH  /api/schedules/:id
POST   /api/users/:id/schedule-assignments
```

## 16.6 Prestations

``` text
GET    /api/work-entries
POST   /api/work-entries
GET    /api/work-entries/:id
PATCH  /api/work-entries/:id
POST   /api/work-entries/:id/submit
POST   /api/work-entries/:id/approve
POST   /api/work-entries/:id/reject
```

## 16.7 Pointage

``` text
POST /api/clock/start
POST /api/clock/stop
GET  /api/clock/status
```

## 16.8 Synchronisation PWA

``` text
POST /api/sync
```

## 16.9 Pot d'heures

``` text
GET  /api/time-balance/me
GET  /api/time-balance/users/:id
GET  /api/time-balance/users/:id/history
POST /api/time-balance/users/:id/adjustments
```

## 16.10 Rapports

``` text
GET /api/reports/daily
GET /api/reports/weekly
GET /api/reports/monthly
```

## 16.11 Exports

``` text
POST /api/exports
GET  /api/exports/:id
```

Les exports longs pourront devenir asynchrones dans une version
ultérieure.

------------------------------------------------------------------------

# 17. Validation des entrées

Chaque endpoint modifiant des données doit posséder un schéma Zod.

Les schémas pouvant être partagés avec React doivent vivre dans
`shared`.

Le backend ne doit jamais faire confiance :

-   aux IDs envoyés ;
-   au rôle envoyé ;
-   au companyId envoyé ;
-   aux minutes calculées par le frontend ;
-   au statut envoyé sans validation de transition ;
-   aux dates/heures non validées.

------------------------------------------------------------------------

# 18. Autorisations

Matrice initiale :

  --------------------------------------------------------------------------
  Action                 WORKER        MANAGER          ADMIN       PLATFORM
  -------------- -------------- -------------- -------------- --------------
  Voir son                  Oui            Oui            Oui            N/A
  profil

  Voir ses                  Oui            Oui            Oui       Contexte
  prestations                                                        support

  Encoder ses               Oui            Oui            Oui            Non
  heures

  Voir son pot              Oui            Oui            Oui       Contexte
                                                                     support

  Voir équipe               Non            Oui            Oui       Contexte
  gérée                                                              support

  Modifier                  Non          Selon            Oui       Contexte
  équipe gérée                      permission                       support

  Approuver                 Non            Oui            Oui Non par défaut
  prestations

  Gérer                     Non Non par défaut            Oui       Contexte
  utilisateurs                                                       support

  Gérer horaires            Non Non par défaut            Oui       Contexte
                                                                     support

  Ajuster pot               Non          Selon            Oui Non par défaut
                                    permission
                                        future

  Gérer                     Non            Non            Non            Oui
  entreprises
  --------------------------------------------------------------------------

Les permissions manager pourront devenir configurables après la V1.

------------------------------------------------------------------------

# 19. Audit

Doivent notamment être auditables :

-   connexion sensible/échecs significatifs ;
-   création utilisateur ;
-   changement de rôle ;
-   activation/désactivation ;
-   création/modification équipe ;
-   changement d'horaire ;
-   création/modification prestation par un tiers ;
-   approbation ;
-   rejet ;
-   correction ;
-   ajustement du pot ;
-   verrouillage/déverrouillage de période ;
-   accès support plateforme ;
-   changement de configuration sensible.

L'audit doit être append-oriented.

------------------------------------------------------------------------

# 20. Rapports et exports V1

Rapport mensuel par travailleur :

``` text
Date
Chantier
Début
Fin
Pause
Presté
Prévu
Écart
Statut
```

Résumé :

``` text
Total prévu
Total presté
Écart période
Mouvements du pot
Solde du pot
```

Formats souhaités :

-   CSV obligatoire ;
-   Excel souhaité ;
-   PDF souhaité.

La première implémentation peut commencer par CSV si le jalon le
prévoit.

------------------------------------------------------------------------

# 21. Périodes et clôture

Un administrateur doit pouvoir verrouiller une période.

Exemple :

``` text
01/09/2026 -> 30/09/2026
LOCKED
```

Après verrouillage :

-   les travailleurs ne modifient plus les prestations ;
-   les managers ne les modifient plus normalement ;
-   une correction administrative doit être explicite ;
-   la correction doit être auditée ;
-   le système ne doit pas réécrire silencieusement l'historique.

------------------------------------------------------------------------

# 22. Notifications

La V1 doit prévoir une abstraction de notification, même si toutes les
notifications ne sont pas immédiatement implémentées.

Cas futurs :

-   prestation rejetée ;
-   prestation à valider ;
-   oubli d'encodage ;
-   période bientôt clôturée ;
-   modification administrative ;
-   invitation utilisateur.

Canaux possibles :

-   in-app ;
-   e-mail ;
-   push PWA ultérieurement.

------------------------------------------------------------------------

# 23. Design et UX

Identité visuelle LFINFO :

-   moderne ;
-   professionnelle ;
-   claire ;
-   adaptée aux environnements professionnels ;
-   mobile-first pour Worker ;
-   desktop efficace pour Manager/Admin ;
-   dark mode envisageable.

Principes :

-   gros boutons tactiles sur mobile ;
-   pas de tableaux desktop illisibles sur smartphone ;
-   erreurs compréhensibles ;
-   confirmation pour actions destructrices ;
-   feedback immédiat ;
-   états de chargement ;
-   états offline visibles ;
-   statut de synchronisation visible ;
-   accessibilité raisonnable dès la V1.

------------------------------------------------------------------------

# 24. Sécurité

Exigences minimales :

-   headers HTTP de sécurité ;
-   cookies sécurisés ;
-   CSRF selon mécanisme de session ;
-   rate limiting ;
-   validation Zod ;
-   contrôle RBAC ;
-   isolation tenant ;
-   RLS si validé techniquement ;
-   requêtes paramétrées via ORM ;
-   logs sans secrets ;
-   mots de passe hashés ;
-   secrets via environnement ;
-   aucune stack trace sensible exposée en production ;
-   upload sécurisé si ajouté ;
-   dépendances auditées ;
-   sauvegarde PostgreSQL ;
-   procédure de restauration documentée.

Les erreurs d'autorisation doivent éviter de révéler inutilement
l'existence d'une ressource étrangère.

------------------------------------------------------------------------

# 25. Observabilité

Prévoir :

-   logs structurés ;
-   request ID ;
-   actor/user ID lorsque pertinent ;
-   company ID lorsque pertinent ;
-   niveau de log configurable ;
-   endpoint health ;
-   endpoint readiness si utile ;
-   version applicative exposable dans l'administration ;
-   gestion centralisée des erreurs.

Ne jamais logger :

-   mots de passe ;
-   cookies complets ;
-   secrets ;
-   tokens de reset complets.

------------------------------------------------------------------------

# 26. Variables d'environnement

Prévoir `.env.example`.

Exemples :

``` dotenv
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

DATABASE_URL=A_REMPLIR

SESSION_SECRET=A_REMPLIR
APP_URL=http://localhost:3000

TRUST_PROXY=false

LOG_LEVEL=info

SMTP_HOST=A_REMPLIR
SMTP_PORT=587
SMTP_USER=A_REMPLIR
SMTP_PASSWORD=A_REMPLIR
SMTP_FROM=A_REMPLIR
```

Ne jamais mettre de vrai secret dans `.env.example`.

------------------------------------------------------------------------

# 27. Sauvegarde et restauration

Avant mise en production :

-   stratégie PostgreSQL documentée ;
-   sauvegardes automatiques ;
-   rétention définie ;
-   restauration testée ;
-   sauvegarde des éventuels fichiers persistants ;
-   procédure de disaster recovery minimale.

------------------------------------------------------------------------

# 28. Modèle commercial cible

Le logiciel est un SaaS par abonnement.

Hypothèse initiale à valider commercialement :

``` text
Starter     9,90 €/mois     jusqu'à 5 travailleurs
Team       24,90 €/mois     jusqu'à 15 travailleurs
Business   49,90 €/mois     jusqu'à 40 travailleurs
Au-delà    supplément/utilisateur ou offre personnalisée
Enterprise sur devis
```

Les limites exactes ne doivent pas être codées en dur dans le cœur
métier.

Prévoir un modèle permettant :

``` text
Plan
Subscription
SubscriptionLimit
```

La facturation SaaS automatique n'est pas obligatoire dans le MVP.

LFINFO doit pouvoir affecter manuellement un plan à une entreprise dans
un premier temps.

------------------------------------------------------------------------

# 29. Hors périmètre MVP

Ne pas implémenter sans demande explicite :

-   facturation client ;
-   devis ;
-   CRM ;
-   stock ;
-   comptabilité ;
-   géolocalisation permanente ;
-   surveillance permanente des travailleurs ;
-   reconnaissance faciale ;
-   paie complète ;
-   connexion directe à tous les secrétariats sociaux ;
-   application native iOS/Android ;
-   microservices ;
-   Kubernetes ;
-   Kafka ;
-   architecture distribuée inutile.

------------------------------------------------------------------------

# 30. Jalons de développement

------------------------------------------------------------------------

## JALON 0 --- Document fondateur et dépôt

**Objectif :** figer les règles avant génération du projet.

-   [x] Conserver ce fichier comme source de vérité.
-   [x] Initialiser le dépôt Git.
-   [x] Créer la branche principale.
-   [x] Ajouter `.gitignore`.
-   [x] Créer un README minimal renvoyant vers ce cahier.
-   [x] Vérifier qu'aucun secret n'est présent.
-   [x] Commit du jalon.

**Commit attendu :**

``` text
milestone(0): initialize project specification
```

------------------------------------------------------------------------

## JALON 1 --- Fondation technique

**Objectif :** application vide compilable et déployable.

-   [x] Créer le workspace pnpm.
-   [x] Créer frontend React + TypeScript + Vite.
-   [x] Créer backend Fastify + TypeScript.
-   [x] Créer package `shared`.
-   [x] Activer TypeScript strict.
-   [x] Configurer ESLint.
-   [x] Configurer Prettier.
-   [x] Configurer variables d'environnement.
-   [x] Configurer Fastify sur port 3000.
-   [x] Ajouter `/api/health`.
-   [x] Configurer build frontend.
-   [x] Faire servir le build React par Fastify en production.
-   [x] Ajouter fallback React Router.
-   [x] Configurer proxy Vite `/api` en développement.
-   [x] Créer `ecosystem.config.cjs`.
-   [x] Vérifier démarrage PM2.
-   [x] Ajouter page React temporaire TempoPoint.
-   [x] Ajouter tests minimum health/build.
-   [x] Commit du jalon.

**Critère principal :**

``` text
http://localhost:3000/
```

affiche React et :

``` text
http://localhost:3000/api/health
```

retourne un état JSON valide depuis **le même processus Node**.

**Commit attendu :**

``` text
milestone(1): initialize lfinfo hours foundation
```

------------------------------------------------------------------------

## JALON 2 --- PostgreSQL, Prisma et multi-tenant

**Objectif :** fondation de données sécurisée.

-   [ ] Installer/configurer Prisma.
-   [ ] Configurer PostgreSQL.
-   [ ] Créer `Company`.
-   [ ] Créer `PlatformUser`.
-   [ ] Créer `User`.
-   [ ] Ajouter rôles ADMIN/MANAGER/WORKER.
-   [ ] Créer contexte tenant backend.
-   [ ] Interdire companyId arbitraire depuis le client.
-   [ ] Créer repositories/services tenant-aware.
-   [ ] Étudier puis implémenter RLS PostgreSQL si compatible avec
    l'architecture Prisma retenue.
-   [ ] Fail closed en absence de contexte tenant pour données métier.
-   [ ] Créer seed développement.
-   [ ] Créer deux sociétés de test A/B.
-   [ ] Créer utilisateurs A/B.
-   [ ] Tests de migration base vierge.
-   [ ] Tests d'isolation A -\> B.
-   [ ] Tests d'isolation B -\> A.
-   [ ] Test de requête par ID étranger.
-   [ ] Test d'absence de contexte.
-   [ ] Commit du jalon.

**Défaut bloquant :** toute fuite entre Company A et Company B.

**Commit attendu :**

``` text
milestone(2): implement tenant data foundation
```

------------------------------------------------------------------------

## JALON 3 --- Authentification et autorisations

**Objectif :** authentification sûre des utilisateurs et plateforme.

-   [ ] Login User.
-   [ ] Logout User.
-   [ ] Endpoint `/api/me`.
-   [ ] Login PlatformUser séparé.
-   [ ] Cookie HttpOnly.
-   [ ] Secure en production.
-   [ ] SameSite approprié.
-   [ ] Sessions invalidables.
-   [ ] Hash sécurisé des mots de passe.
-   [ ] Rate limiting login.
-   [ ] RBAC WORKER/MANAGER/ADMIN.
-   [ ] Protection CSRF adaptée.
-   [ ] Reset password.
-   [ ] Désactivation utilisateur.
-   [ ] Désactivation entreprise bloque les connexions client.
-   [ ] Tests de permissions.
-   [ ] Tests tenant + auth.
-   [ ] Tests PlatformUser séparé.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(3): implement authentication and authorization
```

------------------------------------------------------------------------

## JALON 4 --- Entreprises, utilisateurs et équipes

**Objectif :** administration organisationnelle.

-   [ ] CRUD Company côté plateforme.
-   [ ] Activation/désactivation Company.
-   [ ] CRUD User côté ADMIN.
-   [ ] Un ADMIN ne gère que sa Company.
-   [ ] Un ADMIN ne peut pas créer un PlatformUser.
-   [ ] CRUD Team.
-   [ ] Affectation User -\> Team.
-   [ ] Affectation Manager -\> Team.
-   [ ] Validation anti-relation cross-tenant.
-   [ ] Interface admin responsive.
-   [ ] Interface plateforme Companies.
-   [ ] Audit des changements sensibles.
-   [ ] Tests direct ID étrangers.
-   [ ] Tests POST manipulés.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(4): implement companies users and teams
```

------------------------------------------------------------------------

## JALON 5 --- Chantiers et horaires

**Objectif :** définir où et combien le personnel est censé travailler.

-   [ ] CRUD Worksite.
-   [ ] Archivage Worksite.
-   [ ] CRUD Schedule.
-   [ ] ScheduleDay.
-   [ ] Affectation historique UserScheduleAssignment.
-   [ ] Calcul du temps attendu par jour.
-   [ ] Gestion timezone entreprise.
-   [ ] Interface chantiers.
-   [ ] Interface horaires.
-   [ ] Isolation tenant.
-   [ ] Audit.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(5): implement worksites and schedules
```

------------------------------------------------------------------------

## JALON 6 --- Prestations manuelles

**Objectif :** premier workflow métier complet.

-   [ ] Créer WorkEntry.
-   [ ] Édition DRAFT.
-   [ ] Calcul minutes travaillées backend.
-   [ ] Calcul minutes prévues backend.
-   [ ] Calcul différence backend.
-   [ ] Gestion pause.
-   [ ] Association Worksite.
-   [ ] Note.
-   [ ] Historique personnel.
-   [ ] Soumission.
-   [ ] Validation des transitions de statut.
-   [ ] Vue Worker mobile-first.
-   [ ] Vue Manager.
-   [ ] ADMIN peut encoder/corriger selon règles.
-   [ ] Contrôles de dates/heures.
-   [ ] Isolation tenant.
-   [ ] Tests métier.
-   [ ] Tests sécurité.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(6): implement manual work entries
```

------------------------------------------------------------------------

## JALON 7 --- Validation Manager

**Objectif :** contrôle des feuilles d'heures.

-   [ ] Liste des prestations SUBMITTED.
-   [ ] Filtre équipe.
-   [ ] Filtre utilisateur.
-   [ ] Filtre date.
-   [ ] Filtre statut.
-   [ ] Approbation.
-   [ ] Rejet.
-   [ ] Motif de rejet.
-   [ ] Validation multiple sécurisée.
-   [ ] Worker voit le statut.
-   [ ] Worker voit le motif de rejet.
-   [ ] Audit approve/reject.
-   [ ] Manager limité à son périmètre.
-   [ ] ADMIN accès entreprise complète.
-   [ ] Tests Manager équipe A / équipe B.
-   [ ] Tests tenant.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(7): implement work entry approval workflow
```

------------------------------------------------------------------------

## JALON 8 --- Pot d'heures

**Objectif :** ledger fiable et auditable.

-   [ ] Créer TimeBalanceTransaction.
-   [ ] Générer OVERTIME selon règles V1.
-   [ ] Support RECOVERY.
-   [ ] Support OPENING_BALANCE.
-   [ ] Support MANUAL_ADJUSTMENT.
-   [ ] Support CORRECTION.
-   [ ] Calcul du solde par SUM.
-   [ ] Historique Worker.
-   [ ] Historique Manager/Admin selon permissions.
-   [ ] Motif obligatoire pour ajustement.
-   [ ] Acteur enregistré.
-   [ ] Ne jamais écraser silencieusement l'historique.
-   [ ] Idempotence des transactions générées depuis WorkEntry.
-   [ ] Recalcul/correction maîtrisé lors d'une modification autorisée.
-   [ ] Tests comptables du ledger.
-   [ ] Tests tenant.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(8): implement time balance ledger
```

------------------------------------------------------------------------

## JALON 9 --- Pointage début/fin

**Objectif :** expérience terrain ultra rapide.

-   [ ] `/api/clock/start`.
-   [ ] `/api/clock/stop`.
-   [ ] `/api/clock/status`.
-   [ ] Empêcher plusieurs pointages actifs incompatibles.
-   [ ] Sélection Worksite.
-   [ ] Écran Worker « Débuter ».
-   [ ] Écran Worker « Terminer ».
-   [ ] Confirmation finale.
-   [ ] Pause.
-   [ ] Conversion en WorkEntry.
-   [ ] Calcul backend.
-   [ ] Audit.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(9): implement worker clock workflow
```

------------------------------------------------------------------------

## JALON 10 --- PWA et offline

**Objectif :** fonctionner sur chantier avec réseau instable.

-   [ ] Manifest PWA.
-   [ ] Service Worker.
-   [ ] Installation mobile.
-   [ ] Cache du shell applicatif.
-   [ ] IndexedDB/Dexie.
-   [ ] Queue de mutations.
-   [ ] UUID/idempotency key client.
-   [ ] Synchronisation `/api/sync`.
-   [ ] Retry.
-   [ ] État « en attente de synchronisation ».
-   [ ] État offline visible.
-   [ ] Détection de conflit.
-   [ ] Aucun écrasement silencieux.
-   [ ] Test coupure réseau.
-   [ ] Test double envoi.
-   [ ] Test reconnexion.
-   [ ] Tests E2E PWA pertinents.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(10): implement pwa offline synchronization
```

------------------------------------------------------------------------

## JALON 11 --- Dashboard Manager/Admin

**Objectif :** supervision opérationnelle.

-   [ ] Vue équipe aujourd'hui.
-   [ ] Présents/encodés.
-   [ ] Prestations manquantes.
-   [ ] Prestations à valider.
-   [ ] Anomalies.
-   [ ] Totaux du jour.
-   [ ] Navigation vers travailleur.
-   [ ] Navigation vers prestation.
-   [ ] Pot d'heures visible selon rôle.
-   [ ] Responsive desktop/tablette.
-   [ ] Tests de permissions.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(11): implement management dashboard
```

------------------------------------------------------------------------

## JALON 12 --- Audit complet

**Objectif :** traçabilité administrative.

-   [ ] Créer AuditEvent.
-   [ ] Centraliser service d'audit.
-   [ ] Audit utilisateurs.
-   [ ] Audit équipes.
-   [ ] Audit horaires.
-   [ ] Audit prestations.
-   [ ] Audit validations/rejets.
-   [ ] Audit pot.
-   [ ] Audit accès support.
-   [ ] Interface audit ADMIN.
-   [ ] Interface audit plateforme.
-   [ ] Filtres.
-   [ ] Aucun secret dans metadata.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(12): implement audit trail
```

------------------------------------------------------------------------

## JALON 13 --- Rapports et exports

**Objectif :** fournir des données exploitables administrativement.

-   [ ] Rapport journalier.
-   [ ] Rapport hebdomadaire.
-   [ ] Rapport mensuel.
-   [ ] Totaux prévus.
-   [ ] Totaux prestés.
-   [ ] Écarts.
-   [ ] Pot.
-   [ ] Export CSV.
-   [ ] Export Excel si retenu pour V1.
-   [ ] Export PDF si retenu pour V1.
-   [ ] Isolation tenant dans exports.
-   [ ] Aucun ID étranger exploitable.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(13): implement reports and exports
```

------------------------------------------------------------------------

## JALON 14 --- Clôture des périodes

**Objectif :** figer les périodes transmises.

-   [ ] Créer PeriodLock.
-   [ ] Verrouiller plage de dates.
-   [ ] Interdire édition Worker.
-   [ ] Interdire édition Manager normale.
-   [ ] Correction ADMIN explicite.
-   [ ] Audit de correction.
-   [ ] Impact pot correctement corrigé.
-   [ ] Déverrouillage exceptionnel audité si autorisé.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(14): implement period locking
```

------------------------------------------------------------------------

## JALON 15 --- Administration plateforme et abonnement

**Objectif :** rendre le SaaS exploitable par LFINFO.

-   [ ] Créer Plan.
-   [ ] Créer Subscription.
-   [ ] Affectation manuelle d'un plan.
-   [ ] Limites non codées en dur.
-   [ ] Nombre d'utilisateurs actifs.
-   [ ] État abonnement.
-   [ ] Suspension contrôlée.
-   [ ] Dashboard plateforme.
-   [ ] Sélection explicite contexte support.
-   [ ] Audit support.
-   [ ] Aucun accès cross-tenant hors contexte.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(15): implement platform subscription administration
```

------------------------------------------------------------------------

## JALON 16 --- Notifications et e-mail

**Objectif :** communication essentielle.

-   [ ] Abstraction NotificationService.
-   [ ] Configuration SMTP.
-   [ ] Invitation utilisateur.
-   [ ] Reset password.
-   [ ] Notification prestation rejetée.
-   [ ] Notification in-app minimale.
-   [ ] Templates TempoPoint.
-   [ ] Pas de secret dans logs.
-   [ ] Tests.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(16): implement notifications
```

------------------------------------------------------------------------

## JALON 17 --- Sécurité et hardening pré-production

**Objectif :** audit complet avant pilote.

-   [ ] Revue de toutes les routes API.
-   [ ] Revue RBAC.
-   [ ] Revue tenant.
-   [ ] Revue RLS.
-   [ ] Tests Company A/B complets.
-   [ ] Tests IDs directs.
-   [ ] Tests POST manipulés.
-   [ ] Tests exports.
-   [ ] Tests rapports.
-   [ ] Tests offline cross-tenant.
-   [ ] Tests sessions.
-   [ ] Tests CSRF.
-   [ ] Tests rate limit.
-   [ ] Headers sécurité.
-   [ ] Vérification logs/secrets.
-   [ ] Audit dépendances.
-   [ ] Vérification erreurs production.
-   [ ] Vérification cookies production.
-   [ ] Playwright E2E parcours Worker.
-   [ ] Playwright E2E parcours Manager.
-   [ ] Playwright E2E parcours Admin.
-   [ ] Tests plateforme.
-   [ ] `git diff --check`.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(17): harden lfinfo hours security
```

------------------------------------------------------------------------

## JALON 18 --- Déploiement et exploitation

**Objectif :** procédure reproductible de production.

-   [ ] Build production.
-   [ ] Frontend servi par Fastify.
-   [ ] PM2.
-   [ ] `ecosystem.config.cjs`.
-   [ ] Variables production documentées.
-   [ ] `.env.example` exhaustif.
-   [ ] `A_REMPLIR` pour valeurs inconnues.
-   [ ] Reverse proxy documenté.
-   [ ] `trustProxy`.
-   [ ] PostgreSQL production.
-   [ ] Migrations.
-   [ ] Seed uniquement si approprié.
-   [ ] Sauvegarde.
-   [ ] Restauration testée.
-   [ ] Health check.
-   [ ] Logs.
-   [ ] PM2 startup/save.
-   [ ] Procédure upgrade.
-   [ ] Procédure rollback.
-   [ ] Procédure redémarrage A à Z.
-   [ ] Vérification installation vierge.
-   [ ] Commit du jalon.

**Commit attendu :**

``` text
milestone(18): prepare production deployment
```

------------------------------------------------------------------------

## JALON 19 --- Pilote

**Objectif :** utilisation réelle contrôlée.

-   [ ] Créer entreprise pilote.
-   [ ] Créer utilisateurs pilotes.
-   [ ] Tester smartphones Android.
-   [ ] Tester PWA installée.
-   [ ] Tester desktop.
-   [ ] Tester réseau faible/offline.
-   [ ] Tester semaine complète.
-   [ ] Tester validation.
-   [ ] Tester pot.
-   [ ] Tester export mensuel.
-   [ ] Recueillir retours.
-   [ ] Classer bugs bloquants/majeurs/mineurs.
-   [ ] Corriger les bloquants.
-   [ ] Documenter décisions produit.
-   [ ] Commit de stabilisation du jalon.

**Commit attendu :**

``` text
milestone(19): stabilize pilot release
```

------------------------------------------------------------------------

# 31. Backlog post-MVP

Ne pas implémenter automatiquement. Ces éléments sont des pistes V2+ :

-   [ ] congés ;
-   [ ] absences ;
-   [ ] maladie ;
-   [ ] jours fériés avancés ;
-   [ ] temps de déplacement ;
-   [ ] indemnités ;
-   [ ] travail de nuit ;
-   [ ] règles week-end ;
-   [ ] astreintes ;
-   [ ] horaires cycliques ;
-   [ ] planning ;
-   [ ] notifications push ;
-   [ ] approbation à plusieurs niveaux ;
-   [ ] signatures ;
-   [ ] pièces jointes ;
-   [ ] photos chantier ;
-   [ ] QR code chantier ;
-   [ ] import utilisateurs ;
-   [ ] SSO ;
-   [ ] MFA ;
-   [ ] API publique ;
-   [ ] webhooks ;
-   [ ] intégrations secrétariats sociaux ;
-   [ ] exports spécifiques paie ;
-   [ ] application native si besoin réel ;
-   [ ] facturation automatique de l'abonnement TempoPoint.

------------------------------------------------------------------------

# 32. Tests multi-tenant obligatoires

Créer au minimum :

``` text
Company A
  adminA
  managerA
  workerA
  teamA
  worksiteA
  scheduleA
  workEntryA

Company B
  adminB
  managerB
  workerB
  teamB
  worksiteB
  scheduleB
  workEntryB
```

Sentinelles recommandées :

``` text
SECRET-COMPANY-A
SECRET-COMPANY-B
```

Les tests doivent prouver notamment :

-   [ ] workerA ne voit jamais B ;
-   [ ] managerA ne voit jamais B ;
-   [ ] adminA ne voit jamais B ;
-   [ ] l'inverse est également vrai ;
-   [ ] un ID direct B demandé par A est refusé ;
-   [ ] un POST A contenant userId B est refusé ;
-   [ ] un POST A contenant worksiteId B est refusé ;
-   [ ] une équipe A ne peut contenir userB ;
-   [ ] un horaire A ne peut être affecté à userB ;
-   [ ] un export A ne contient aucune sentinelle B ;
-   [ ] un rapport A ne contient aucune sentinelle B ;
-   [ ] la recherche A ne retourne aucune donnée B ;
-   [ ] la synchronisation offline A ne peut injecter de relation B ;
-   [ ] les actions plateforme nécessitant un contexte client sont
    explicites ;
-   [ ] l'absence de contexte échoue fermement.

Toute violation est **bloquante pour la mise en production**.

------------------------------------------------------------------------

# 33. Règles de calcul et droit social

TempoPoint doit fournir un moteur configurable.

Le logiciel ne doit pas présenter une règle générique comme étant
automatiquement conforme à toutes les conventions collectives,
commissions paritaires ou législations.

L'entreprise cliente reste responsable de la configuration correcte de
ses règles, sauf lorsqu'une règle officiellement prise en charge et
maintenue est explicitement fournie.

Les versions futures pourront fournir des profils de règles.

------------------------------------------------------------------------

# 34. RGPD et confidentialité

Prévoir dès la conception :

-   minimisation des données ;
-   finalité claire ;
-   durée de conservation configurable/documentée ;
-   droit d'accès/export lorsque requis ;
-   procédure de suppression/anonymisation lorsque légalement applicable
    ;
-   sous-traitants documentables ;
-   hébergement documenté ;
-   accès support audité ;
-   pas de géolocalisation permanente par défaut ;
-   pas de surveillance cachée.

------------------------------------------------------------------------

# 35. Performance

Objectifs initiaux raisonnables :

-   interface Worker rapide sur smartphone ;
-   API courante avec latence faible sur infrastructure normale ;
-   pagination obligatoire pour grandes listes ;
-   aucun chargement de tous les utilisateurs d'une grosse entreprise
    sans nécessité ;
-   index DB sur clés tenant et colonnes de recherche importantes ;
-   éviter N+1 ;
-   exports lourds conçus pour pouvoir devenir asynchrones.

Index à envisager systématiquement :

``` text
companyId
(companyId, userId)
(companyId, date)
(companyId, status)
(companyId, teamId)
```

------------------------------------------------------------------------

# 36. Gestion des dates et heures

Règles impératives :

-   entreprise avec timezone explicite ;
-   stockage des timestamps de manière cohérente ;
-   calculs métier conscients de la timezone ;
-   dates de journée de travail distinctes des timestamps techniques ;
-   gestion correcte des changements heure été/hiver ;
-   durée en minutes entières ;
-   tests DST.

------------------------------------------------------------------------

# 37. Idempotence

Les opérations sensibles à la répétition doivent être idempotentes
lorsque nécessaire :

-   synchronisation offline ;
-   arrêt/démarrage de pointage ;
-   génération de mouvements du pot ;
-   approbations multiples ;
-   imports futurs.

Une reconnexion ou un double clic ne doit pas doubler les heures ou le
pot.

------------------------------------------------------------------------

# 38. Concurrence

Le backend doit prévoir les modifications concurrentes.

Pour les objets sensibles, utiliser une stratégie appropriée :

-   version ;
-   `updatedAt` contrôlé ;
-   transaction DB ;
-   verrou logique si nécessaire.

Une correction concurrente ne doit pas écraser silencieusement une autre
correction.

------------------------------------------------------------------------

# 39. API et conventions

Réponses JSON cohérentes.

Exemple succès :

``` json
{
  "data": {}
}
```

Erreur :

``` json
{
  "error": {
    "code": "WORK_ENTRY_LOCKED",
    "message": "Cette prestation est verrouillée."
  }
}
```

Les codes d'erreur doivent être stables et exploitables par le frontend.

Ne pas exposer les erreurs Prisma brutes au client.

------------------------------------------------------------------------

# 40. Versionnage

Commencer en :

``` text
0.1.0
```

Avant pilote :

``` text
0.x
```

Première version commerciale stable :

``` text
1.0.0
```

Utiliser Semantic Versioning autant que possible.

------------------------------------------------------------------------

# 41. Documentation attendue à terme

Avant production, le dépôt doit contenir :

-   README ;
-   installation développement ;
-   architecture ;
-   sécurité multi-tenant ;
-   modèle de permissions ;
-   règles de calcul ;
-   PWA/offline ;
-   migrations ;
-   sauvegarde/restauration ;
-   déploiement ;
-   procédure PM2 ;
-   procédure reverse proxy ;
-   procédure upgrade ;
-   procédure rollback ;
-   variables d'environnement ;
-   guide administrateur minimal.

------------------------------------------------------------------------

# 42. Critères de réussite MVP

Le MVP est considéré fonctionnel lorsqu'une PME peut :

1.  être créée par LFINFO ;
2.  créer ses utilisateurs ;
3.  créer ses équipes ;
4.  créer ses chantiers ;
5.  définir les horaires ;
6.  donner accès à ses travailleurs ;
7.  permettre l'encodage mobile ;
8.  permettre le pointage ;
9.  fonctionner temporairement offline ;
10. calculer temps prévu/presté ;
11. gérer le pot d'heures ;
12. permettre au manager de valider ;
13. verrouiller une période ;
14. produire un export mensuel ;
15. garantir l'isolation avec toutes les autres entreprises.

------------------------------------------------------------------------

# 43. Principe final pour Codex

Lorsqu'une demande de développement est donnée, Codex doit :

``` text
1. Lire ce fichier
2. Identifier le jalon demandé
3. Examiner l'état Git et le code existant
4. Ne travailler que sur le périmètre demandé
5. Implémenter
6. Tester
7. Corriger jusqu'à réussite
8. Mettre [x] uniquement sur ce qui est réellement validé
9. Exécuter les contrôles qualité
10. Créer le commit du jalon
11. Résumer précisément :
    - fichiers modifiés
    - fonctionnalités terminées
    - tests exécutés
    - résultats
    - risques/restes éventuels
    - hash du commit
12. S'arrêter avant le jalon suivant sauf instruction explicite
```

**La sécurité multi-tenant prime sur la rapidité de développement.**

**Aucune fonctionnalité métier ne doit être considérée terminée si son
isolation entre entreprises n'a pas été testée.**


JALON FINAL — Domaines & personnalisation

[ ] tempopoint.lfinfo.be reste le domaine canonique
[ ] Sous-domaines clients optionnels
[ ] Domaines personnalisés
[ ] Vérification de propriété DNS
[ ] Gestion TLS
[ ] Association hostname → Company
[ ] Logo client
[ ] Couleurs client
[ ] Page de connexion personnalisée
[ ] Branding PWA
[ ] Option "Powered by TempoPoint — LFINFO"
[ ] Tests anti-usurpation de hostname
[ ] Tests isolation tenant via domaines
[ ] Documentation DNS client