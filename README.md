# DataShare

Prototype (MVP) de plateforme de transfert sécurisé de fichiers pour freelances et petites
entreprises : dépôt avec compte, lien de téléchargement temporaire, protection par mot de
passe optionnelle, expiration automatique, historique et suppression.

## Statut du projet

🟢 **MVP fonctionnel** — les six user stories (US01 à US06) sont implémentées et vérifiées
de bout en bout : inscription, connexion JWT, dépôt de fichier avec lien de partage,
téléchargement public avec mot de passe optionnel, historique cloisonné par compte,
suppression.

Hors périmètre MVP : dépôt anonyme, tags, purge planifiée des fichiers expirés.

## Stack technique

| Couche | Choix |
|---|---|
| Back-end | Spring Boot 4.1 (Java 21) — Web MVC, Security, Validation, Data JPA |
| Front-end | React 19 + Vite + TypeScript, Redux Toolkit, React Router |
| Base de données | PostgreSQL 16, migrations Flyway |
| Stockage fichiers | Système de fichiers local (répertoire dédié) |
| Authentification | JWT (HS256) + BCrypt |

## Prérequis

- [Java 21+](https://adoptium.net/) (Maven fourni via le wrapper `./mvnw`)
- [Node.js 20+](https://nodejs.org/) et npm
- [Docker](https://www.docker.com/) + Docker Compose, pour PostgreSQL

> Sous Windows, **Docker Desktop doit être démarré** avant toute commande `docker compose`.

## Installation et lancement

Trois terminaux, dans cet ordre.

**1. Base de données**

```bash
docker compose -f deploy/docker-compose.yml up -d
docker ps            # vérifier que datashare-postgres tourne
```

**2. Back-end** — API sur http://localhost:8080

```bash
cd backend
./mvnw spring-boot:run
```

Les migrations Flyway créent les tables au démarrage. Vérification rapide :

```bash
curl http://localhost:8080/api/health
# {"status":"ok","timestamp":"..."}
```

**3. Front-end** — application sur http://localhost:5173

```bash
cd frontend
npm install
npm run dev
```

Vite redirige les appels `/api` vers le back-end : utilise bien l'adresse `localhost`
affichée, et non l'adresse réseau — la copie de lien dans le presse-papiers nécessite un
contexte sécurisé (`localhost` ou HTTPS).

> ⚠️ Spring Boot ne recharge pas le code Java à chaud : après toute modification du
> back-end, arrête (`Ctrl+C`) et relance `./mvnw spring-boot:run`.

## Utilisation

1. **Créer un compte** sur `/inscription` (mot de passe : 8 caractères minimum). La
   connexion est automatique dans la foulée.
2. **Déposer un fichier** depuis « Ajouter un fichier » : choisis la durée de validité
   (1, 3 ou 7 jours) et, si besoin, un mot de passe de protection.
3. **Partager le lien** affiché après le dépôt, de la forme
   `http://localhost:5173/d/<identifiant>`. Le bouton « Copier le lien » le place dans le
   presse-papiers.
4. **Télécharger** : le destinataire ouvre le lien sans compte, voit le nom et la taille du
   fichier, saisit le mot de passe s'il y en a un, puis télécharge.
5. **Suivre ses fichiers** sur `/mes-fichiers`, avec les onglets « Actifs » et « Expirés ».
6. **Supprimer** un fichier depuis cette même page, après confirmation.

Les extensions `exe`, `bat`, `sh`, `cmd` et `msi` sont refusées ; la taille maximale est de
1 Go.

## Tests

```bash
cd backend
./mvnw test
```

Couvre les fonctionnalités critiques : authentification (inscription, doublon, validation,
connexion), dépôt (extension interdite, accès sans jeton), consultation (lien expiré,
identifiant inconnu), téléchargement (avec et sans mot de passe), cloisonnement de
l'historique et suppression par un tiers.

Le rapport de couverture JaCoCo est généré à chaque exécution :

```
backend/target/site/jacoco/index.html
```

## Configuration

Les valeurs par défaut permettent de démarrer sans configuration. Pour les surcharger,
copie le fichier d'exemple :

```bash
cp deploy/.env.example deploy/.env
```

| Variable | Par défaut | Rôle |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `datashare` | Identifiants PostgreSQL |
| `JWT_SECRET` | valeur de développement | Clé de signature des jetons — **à changer hors développement** |
| `STORAGE_PATH` | `./storage` | Répertoire de stockage des fichiers déposés |

## Structure du dépôt

```
appFullStack/
  backend/          API Spring Boot (contrôleurs, services, entités, sécurité)
  frontend/         SPA React (pages, composants, services, store Redux)
  deploy/           docker-compose.yml + .env.example
  g.docs/           Documentation technique et fonctionnelle
```

## Documentation

| Document | Contenu |
|---|---|
| [g.docs/ARCHITECTURE.md](g.docs/ARCHITECTURE.md) | Briques techniques et flux principaux |
| [g.docs/DATA-MODEL.md](g.docs/DATA-MODEL.md) | MCD (Merise) et schéma relationnel PostgreSQL |
| [g.docs/openapi.yaml](g.docs/openapi.yaml) | Contrat d'interface front/back (OpenAPI 3) |
| [g.docs/USE-CASES.md](g.docs/USE-CASES.md) | Cas d'utilisation détaillés, règles de gestion, codes d'erreur |
| [g.docs/DECISIONS.md](g.docs/DECISIONS.md) | Choix techniques justifiés et alternatives écartées |
| [g.docs/AI-USAGE.md](g.docs/AI-USAGE.md) | Utilisation de l'IA et revue technique du code produit |
| [g.docs/use-cases.html](g.docs/use-cases.html) | Rendu visuel des cas d'utilisation |
| [g.docs/diagrams.html](g.docs/diagrams.html) | Rendu visuel de l'architecture et du modèle de données |

### Plan de suivi qualité et maintenance

| Document | Contenu |
|---|---|
| [TESTING.md](TESTING.md) | Stratégie de tests, cas couverts, couverture, limites |
| [SECURITY.md](SECURITY.md) | Modèle de menace, mesures en place, risques assumés |
| [PERF.md](PERF.md) | Mesures relevées, budget front-end, pistes d'optimisation |
| [MAINTENANCE.md](MAINTENANCE.md) | Procédures d'exploitation, migrations, diagnostic |

## Limites connues

Assumées à ce stade du prototype, détaillées dans
[g.docs/USE-CASES.md](g.docs/USE-CASES.md#écarts-constatés-entre-limplémentation-et-le-besoin) :

- Les fichiers expirés restent sur le disque : leur lien ne fonctionne plus, mais l'espace
  n'est pas libéré (purge planifiée hors périmètre MVP).
- Aucune limitation du nombre de tentatives de connexion.
- Le jeton JWT est conservé dans le stockage local du navigateur.
