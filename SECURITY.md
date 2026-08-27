# Sécurité — DataShare

État des mesures de sécurité du MVP, menaces considérées, et risques assumés.

Dernière revue : **21/08/2026**.

## Modèle de menace

DataShare manipule des fichiers potentiellement confidentiels, partagés par lien avec des
destinataires non authentifiés. Les menaces prioritaires sont donc :

| Menace | Impact | Traitement |
|---|---|---|
| Vol de compte | Accès à tous les fichiers du déposant | Mots de passe hachés, jeton signé et expirant |
| Accès aux fichiers d'autrui | Fuite de données confidentielles | Cloisonnement vérifié côté serveur, testé |
| Devinette d'un lien de partage | Fuite d'un fichier | Identifiants UUID v4 non séquentiels |
| Fichier hostile déposé puis partagé | Compromission d'un destinataire | Liste d'extensions interdites |
| Énumération de comptes | Préparation d'une attaque ciblée | Message d'erreur unique à la connexion |

## Mesures en place

### Authentification et mots de passe

- **BCrypt** (coût 10) pour les mots de passe utilisateur **et** les mots de passe de
  fichier. Aucun mot de passe n'est stocké ni journalisé en clair.
- **Jeton JWT signé en HS256**, valable 1 heure, portant l'identifiant utilisateur et
  l'email. La clé de signature est externalisée dans `JWT_SECRET`.
- **Message d'erreur identique** que le compte n'existe pas ou que le mot de passe soit
  faux — empêche l'énumération des comptes. Couvert par un test dédié.

### Contrôle d'accès

- Les routes `/api/files` (dépôt, historique, suppression) exigent un jeton valide.
- La vérification de propriété est faite **côté serveur** avant toute suppression, jamais
  seulement masquée dans l'interface.
- L'historique filtre sur le propriétaire extrait du jeton, pas sur un paramètre client.
- Deux tests d'intégration verrouillent ces deux points : un utilisateur ne peut ni lister
  ni supprimer les fichiers d'un autre en connaissant leur identifiant.

### Injections

- **SQL** : accès exclusivement via Spring Data JPA, requêtes paramétrées. Aucune
  concaténation de chaîne dans une requête.
- **Chemin de fichier** (*path traversal*) : le nom de stockage sur disque est un **UUID
  généré par le serveur**, jamais le nom fourni par l'utilisateur. Un fichier nommé
  `../../etc/passwd` est stocké sous `<uuid>.passwd` et ne peut pas sortir du répertoire.
- **XSS** : React échappe par défaut toute valeur insérée dans le DOM. Aucun
  `dangerouslySetInnerHTML` dans le code.

### Fichiers déposés

- Extensions refusées : `exe`, `bat`, `sh`, `cmd`, `msi` — configurables via
  `app.upload.forbidden-extensions`.
- Taille maximale : 1 Go.
- Mot de passe de protection : minimum 6 caractères, validé **côté serveur** — la
  vérification dans l'interface n'est qu'une aide à la saisie, jamais une mesure de sécurité.
- Durée d'expiration : bornée à 1–7 jours, toute valeur hors intervalle est rejetée.
- Téléchargement forcé en pièce jointe (`Content-Disposition: attachment`) : le contenu
  n'est jamais rendu dans le navigateur, ce qui neutralise un HTML piégé.
- Le mot de passe de fichier transite dans le **corps** d'une requête POST, jamais dans
  l'URL : il n'apparaît donc ni dans les journaux serveur, ni dans l'historique du
  navigateur, ni dans l'en-tête `Referer`.

### Expiration

L'expiration est revérifiée **à chaque appel**, consultation comme téléchargement. Un lien
ne peut pas être exploité après sa date limite, même si le fichier est encore sur le disque.

## Risques assumés

Ces points sont connus et acceptés au stade prototype. Ils devraient être traités avant
toute mise en production.

### 1. CSRF désactivé

`csrf().disable()` dans `SecurityConfig`. **Justification** : l'API est sans état et
l'authentification repose sur un en-tête `Authorization` explicite, jamais sur un cookie
envoyé automatiquement par le navigateur. Sans cookie d'authentification, une requête
inter-site ne peut pas emprunter l'identité de l'utilisateur. Le risque redeviendrait réel
si l'on migrait le jeton vers un cookie.

### 2. Jeton conservé dans `localStorage`

Lisible par tout script s'exécutant sur la page, donc exposé en cas de faille XSS.
L'alternative — un cookie `HttpOnly` + `SameSite` — protège du vol par script mais réintroduit
la problématique CSRF. Choix de simplicité assumé pour le MVP.

### 3. Aucune limitation des tentatives de connexion

`/api/auth/login` accepte un nombre illimité d'essais : une attaque par force brute est
possible. BCrypt ralentit chaque tentative (~130 ms mesurées), ce qui limite le débit sans
constituer une protection. **Correctif recommandé** : limitation par IP et par compte.

### 4. Fichiers expirés conservés sur le disque

Leur lien ne fonctionne plus, mais le contenu binaire reste présent. Ce n'est pas une fuite
directe — aucune route n'y donne accès — mais les données survivent au-delà de la durée
annoncée à l'utilisateur, ce qui est discutable sur le plan de la conformité. La purge
planifiée est hors périmètre MVP.

### 5. Secret JWT par défaut en développement

`application.yml` contient une valeur de repli lisible dans le dépôt. Elle n'est destinée
qu'au développement local ; toute autre exécution doit fournir `JWT_SECRET`.

### 6. Transport en clair

Le MVP tourne en HTTP local. Fichiers, mots de passe et jetons circuleraient en clair sur
un réseau non maîtrisé. **HTTPS est un prérequis absolu** à toute exposition publique.

## Vérifications réalisées

| Vérification | Méthode | Résultat |
|---|---|---|
| Cloisonnement des historiques | Test d'intégration automatisé | Conforme |
| Suppression par un tiers | Test d'intégration automatisé | Refus en `403` |
| Non-énumération des comptes | Test d'intégration automatisé | Messages identiques |
| Accès sans jeton | Test d'intégration automatisé | Refus en `403` |
| Validation serveur du mot de passe de fichier | Test d'intégration automatisé | Refus en `400` sous 6 caractères |
| Fuite de détails techniques en erreur | Revue du `GlobalExceptionHandler` | Les exceptions inattendues sont journalisées côté serveur, jamais renvoyées au client |

Aucun scan de dépendances automatisé n'est en place. `./mvnw dependency:tree` et
`npm audit` sont les premières étapes recommandées.
