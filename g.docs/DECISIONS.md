# Choix techniques — DataShare

Pour chaque décision structurante : le choix retenu, les alternatives écartées, et la raison
du départage. Le contexte est celui d'un **MVP démontrable en quatre semaines**, développé
par une seule personne, à présenter à des investisseurs.

---

## Back-end

### Spring Boot 4.1 (Java 21)

**Alternatives écartées** : Node.js/Express, Quarkus, Spring Boot 3.x.

Spring Boot apporte d'emblée sécurité, validation, accès aux données et migrations —
autant de briques à assembler soi-même avec Express. Sur un périmètre où
l'authentification et le contrôle d'accès sont centraux, ce socle intégré fait gagner
plusieurs jours.

Le choix de la **4.1 plutôt que la 3.x**, plus répandue, est assumé : le projet démarre
sans base de code existante, autant partir sur la version courante plutôt que de programmer
une migration. Ce choix a un coût réel, constaté pendant le développement — la
réorganisation des packages en 4.x a déplacé `AutoConfigureMockMvc`, et l'`ObjectMapper`
n'est plus exposé comme bean injectable. Les réponses trouvées en ligne, majoritairement
écrites pour la 3.x, ne s'appliquent pas toujours.

### PostgreSQL 16

**Alternatives écartées** : MySQL, MongoDB, H2 en mémoire.

Le modèle est fortement relationnel (un utilisateur, ses fichiers, une contrainte
d'intégrité entre les deux) : une base documentaire n'apporterait rien. PostgreSQL offre le
type `UUID` natif, `TIMESTAMPTZ` pour des dates d'expiration sans ambiguïté de fuseau, et
`gen_random_uuid()` sans extension.

H2 aurait simplifié les tests, mais au prix d'un écart entre environnement de test et de
production — précisément là où se cachent les bugs. Les tests utilisent donc la vraie base.

### Flyway pour les migrations

**Alternative écartée** : `hibernate.ddl-auto: update`.

Laisser Hibernate modifier le schéma est pratique mais opaque : on ne sait pas ce qui a été
appliqué, ni comment revenir en arrière. Flyway versionne chaque évolution dans un fichier
SQL relu et commité. Hibernate est configuré en `validate` : il refuse de démarrer si les
entités et les tables divergent — l'incohérence est détectée au démarrage, pas en production.

### JWT plutôt qu'une session serveur

**Alternative écartée** : session HTTP avec cookie.

L'API est sans état : aucune session à répliquer, montée en charge horizontale triviale, et
le front peut être hébergé séparément du back sans partage de session.

**Contrepartie assumée** : un jeton émis ne peut pas être révoqué avant son expiration. Avec
une durée de vie d'une heure, le risque est jugé acceptable pour un prototype. Une
déconnexion immédiate côté serveur exigerait une liste de révocation, ce qui rétablirait
l'état qu'on cherchait à éviter.

### BCrypt (coût 10)

**Alternatives écartées** : SHA-256, Argon2.

Un hachage rapide comme SHA-256 est inadapté aux mots de passe : sa vitesse profite à
l'attaquant. BCrypt est délibérément lent — environ 120 ms mesurées, ce qui freine
mécaniquement toute attaque par force brute. Argon2 est aujourd'hui préférable dans
l'absolu, mais BCrypt est fourni par Spring Security sans dépendance supplémentaire, et
reste parfaitement acceptable.

Le même mécanisme protège les mots de passe de fichier : la vérification est donc identique,
et le mot de passe d'un fichier n'est jamais récupérable, même par l'administrateur.

### Stockage des fichiers sur le disque local

**Alternatives écartées** : stockage objet (S3/MinIO), stockage en base (`BYTEA`).

Stocker des binaires en base alourdit les sauvegardes et sature le cache. Le stockage objet
serait le choix de production, mais impose un service supplémentaire à installer et
configurer — hors budget pour une démonstration locale.

Le disque local est encapsulé dans `FileStorageService` : basculer vers S3 revient à
réécrire cette seule classe.

**Point de sécurité** : le nom sur disque est un UUID généré par le serveur, jamais le nom
fourni par l'utilisateur. Un fichier nommé `../../etc/passwd` ne peut pas s'échapper du
répertoire de stockage.

### Gestion centralisée des erreurs

**Alternative écartée** : laisser Spring produire ses réponses d'erreur par défaut.

Le comportement par défaut fait transiter les erreurs par la route interne `/error`, ce qui
a causé un bug bloquant : cette route n'étant pas autorisée dans la configuration de
sécurité, **toutes** les erreurs métier étaient converties en `403` opaques. Un
`@RestControllerAdvice` intercepte désormais les exceptions en amont et produit un format
homogène `{ timestamp, status, message }`, directement affichable par le front.

---

## Front-end

### React 19 + Vite + TypeScript

**Alternatives écartées** : Vue, Angular, Next.js.

React est le standard le plus documenté, donc le plus économique en temps d'apprentissage.
Vite offre un démarrage quasi instantané et un rechargement à chaud, appréciable sur des
allers-retours fréquents. TypeScript détecte à la compilation les incohérences entre le
contrat d'API et son usage — précieux quand la même personne écrit les deux côtés.

Next.js apporterait le rendu côté serveur, sans intérêt ici : l'application est
majoritairement privée, derrière authentification, et n'a aucun enjeu de référencement.

### Redux Toolkit pour l'état d'authentification

**Alternatives écartées** : React Context, Zustand, aucun état global.

Seul l'état d'authentification est réellement global — jeton et identité, consommés par la
garde de route, l'en-tête et les appels API. Redux Toolkit apporte une structure explicite
(`createAsyncThunk` gère les états *en cours* / *réussi* / *échoué* sans code répétitif) et
des outils de débogage précieux.

C'est un choix un peu lourd pour un état aussi restreint : Context aurait suffi. Redux a été
retenu pour l'homogénéité du traitement des erreurs et parce qu'il absorbera sans
refonte l'état supplémentaire d'une future version.

L'état des fichiers, lui, reste **local à chaque page** : il n'est utilisé qu'à un seul
endroit, le remonter globalement aurait été une complication gratuite.

### Découpage du code

- `pages/` — un composant par écran, responsable des appels API et de l'état local
- `components/` — éléments réutilisables et sans logique métier (`Button`, `Alert`, `Card`,
  `Field`, `FileRow`)
- `services/` — accès HTTP, seul endroit connaissant les URL de l'API
- `store/` — état global
- `utils/` — fonctions pures, testables isolément

La règle appliquée : **un composant présentationnel ne connaît jamais l'API**. `FileRow`
affiche un fichier et remonte les intentions (`onDelete`, `onCopyLink`) à la page, qui
décide. Ce découplage permettrait de le réutiliser ou de le tester sans serveur.

### Appels API par `fetch` natif

**Alternative écartée** : Axios.

Un module `http.ts` d'une centaine de lignes couvre le besoin : injection du jeton,
traduction des codes HTTP en messages français, distinction JSON / multipart / binaire.
Axios apporterait des intercepteurs et une gestion d'erreur unifiée, au prix d'une
dépendance pour un gain marginal à cette échelle.

### Lien de partage construit côté front

Le serveur ignore l'URL publique du front : il renvoie un identifiant, et le front compose
`window.location.origin + /d/{id}`. L'application reste ainsi portable d'un environnement à
l'autre sans configuration.

**Limite reconnue** : l'API renvoie aussi un chemin `downloadUrl` que le front n'utilise
pas. Deux sources de vérité coexistent, dont une inutilisée — à unifier.

---

## Décisions de périmètre

| Écarté du MVP | Raison |
|---|---|
| Dépôt anonyme | Hors US01–US06 ; complexifierait le modèle de propriété |
| Tags sur les fichiers | Confort, sans valeur pour la démonstration |
| Purge planifiée des fichiers expirés | L'expiration est déjà appliquée à la lecture ; la purge n'est qu'une optimisation d'espace |
| Révocation des jetons | Nécessiterait un état serveur, contraire au choix JWT |
| Tests front-end | Arbitrage de temps au profit des tests back, où se concentrent les règles métier |
