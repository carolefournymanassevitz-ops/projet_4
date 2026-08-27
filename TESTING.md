# Plan de tests — DataShare

Ce document décrit la stratégie de tests du MVP, les cas couverts, la procédure d'exécution
et les limites assumées à ce stade.

Dernière exécution : **21/08/2026** — 22 tests, 0 échec, 0 erreur.

## Stratégie

Le prototype privilégie des **tests d'intégration** plutôt que des tests unitaires isolés.
Ce choix est délibéré : les bugs rencontrés sur ce projet ne venaient pas de la logique
métier prise isolément, mais des **interactions entre couches** — configuration de sécurité,
sérialisation des erreurs, filtre JWT. Un test unitaire de `AuthService` avec des mocks
n'aurait détecté aucun d'entre eux.

Chaque test traverse donc la pile complète : requête HTTP → filtre de sécurité → contrôleur
→ service → base PostgreSQL réelle.

| Aspect | Choix | Raison |
|---|---|---|
| Portée | Intégration via `MockMvc` | Couvre la configuration de sécurité, souvent en cause |
| Base de données | PostgreSQL réelle (Docker) | Le schéma utilise `UUID`, `TIMESTAMPTZ` et `gen_random_uuid()`, non reproductibles en base embarquée |
| Isolation | `@Transactional` sur chaque classe | Annule les écritures : la base de développement n'est jamais polluée |
| Stockage fichiers | Redirigé vers `target/test-storage` | `mvn clean` suffit à faire le ménage |

## Exécution

Prérequis : Docker Desktop démarré (les tests utilisent la base PostgreSQL du projet).
Le back-end peut rester lancé, les tests n'ouvrent aucun port.

```bash
cd backend
./mvnw test
```

Rapport de couverture généré automatiquement :

```
backend/target/site/jacoco/index.html
```

## Cas couverts

### Authentification — `AuthControllerTest` (7 tests)

| Cas testé | Attendu |
|---|---|
| Inscription avec données valides | `201` + compte présent en base |
| Inscription avec email déjà utilisé | `409` « Email déjà utilisé » |
| Inscription avec mot de passe < 8 caractères | `400` + message de validation |
| Inscription avec email malformé | `400` |
| Connexion avec identifiants valides | `200` + jeton, `userId`, `expiresIn` |
| Connexion avec mot de passe incorrect | `401` « Identifiants invalides » |
| Connexion sur un compte inexistant | `401`, **message strictement identique** |

Le dernier cas vérifie la règle **RG05** : si les deux échecs renvoyaient des messages
différents, un attaquant pourrait énumérer les comptes existants.

### Cycle de vie des fichiers — `FileControllerTest` (14 tests)

| Cas testé | Attendu |
|---|---|
| Dépôt d'un fichier valide | `201` + identifiant et date d'expiration |
| Dépôt avec extension interdite (`.exe`) | `400` « Type de fichier interdit » |
| Dépôt avec mot de passe de fichier < 6 caractères | `400` + message de validation |
| Dépôt avec durée d'expiration hors bornes | `400` « L'expiration doit être comprise entre 1 et 7 jours » |
| Dépôt sans jeton | `403` |
| Historique avec deux comptes distincts | Seuls les fichiers du demandeur sont renvoyés |
| Consultation d'un lien expiré | `410` « Ce lien a expiré » |
| Consultation d'un identifiant inconnu | `404` « Fichier introuvable » |
| Consultation d'un fichier protégé | `200` + `passwordProtected: true`, **sans authentification** |
| Téléchargement sans mot de passe requis | `401` « Mot de passe requis ou incorrect » |
| Téléchargement avec le bon mot de passe | `200` + contenu exact |
| Téléchargement d'un fichier libre | `200` sans compte |
| Suppression par le propriétaire | `204` + disparition de l'historique |
| Suppression par un autre utilisateur | `403` « Ce fichier ne vous appartient pas » |

Le test de cloisonnement de l'historique et celui de suppression par un tiers sont les deux
plus importants du point de vue sécurité : ils vérifient qu'un utilisateur ne peut ni voir
ni supprimer les fichiers d'un autre, **même en connaissant leur identifiant**.

### Démarrage — `DataShareApplicationTests` (1 test)

Vérifie que le contexte Spring se construit : détecte les erreurs de configuration, de
migration Flyway ou d'injection de dépendances.

## Couverture

| Indicateur | Valeur |
|---|---|
| Instructions | **93,6 %** (993 / 1061) |
| Branches | **68,3 %** (41 / 60) |

Classes à 100 % : `AuthService`, `JwtService`, `SecurityConfig`, `FileUpload`,
`RegisterRequest`, `LoginRequest` et l'ensemble des DTO.

L'écart entre instructions et branches s'explique par les chemins d'erreur peu sollicités :
gestion des exceptions d'entrées/sorties dans `FileStorageService`, et cas de repli du
`GlobalExceptionHandler` (erreur inattendue, accès refusé).

## Anomalies détectées par les tests

| Anomalie | Détection | Correction |
|---|---|---|
| Aucun bean `ObjectMapper` injectable | Première exécution : 12 erreurs de contexte | Extraction JSON par `JsonPath`, sans dépendance au bean |
| Import `AutoConfigureMockMvc` déplacé en Spring Boot 4 | Vérification du classpath avant écriture | `org.springframework.boot.webmvc.test.autoconfigure` |

## Limites assumées

Ces manques sont volontaires au stade MVP, et documentés plutôt que passés sous silence.

- **Aucun test front-end.** Ni test de composant, ni test end-to-end. Le parcours est
  vérifié manuellement. Une suite Vitest + Testing Library serait la première extension.
- **Aucun test de charge.** Les mesures de `PERF.md` sont des relevés à vide, pas des tests
  de montée en charge.
- **Le fichier de 1 Go n'est pas testé.** La limite est configurée mais jamais éprouvée.
- **Branches d'erreur d'entrées/sorties non couvertes** : disque plein, fichier absent au
  téléchargement, permissions insuffisantes.
