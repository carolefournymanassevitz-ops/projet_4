# Cas d'utilisation — DataShare (MVP)

Ce document décrit les cas d'utilisation du prototype DataShare, plateforme de transfert
sécurisé de fichiers pour freelances et petites entreprises.

**Périmètre** : US01 à US06 du cahier des charges. Les fonctionnalités avancées (tags,
dépôt anonyme, purge automatique par tâche planifiée) sont hors périmètre MVP.

**Source** : ces cas d'usage décrivent le comportement **réellement implémenté**, relevé
dans le code le 21/08/2026 — pas une cible théorique. Chaque règle de gestion est traçable
jusqu'à une ligne de code.

**Documents liés** : [ARCHITECTURE.md](ARCHITECTURE.md) · [DATA-MODEL.md](DATA-MODEL.md) ·
[openapi.yaml](openapi.yaml) (contrat d'interface)

---

## Acteurs

| Acteur | Description | Authentification |
|---|---|---|
| **Visiteur** | Internaute sans compte. Peut s'inscrire, se connecter, et télécharger un fichier s'il détient un lien de partage. | Aucune |
| **Utilisateur inscrit** (déposant) | Titulaire d'un compte. Dépose des fichiers, consulte son historique, supprime ses fichiers. | JWT obligatoire |
| **Destinataire** | Personne à qui le déposant transmet un lien. Techniquement un Visiteur : aucun compte n'est requis pour télécharger. | Aucune |
| **Système** | API DataShare (Spring Boot) + stockage disque + PostgreSQL. | — |

---

## Vue d'ensemble

| Réf. | Cas d'utilisation | US | Acteur | Compte requis |
|---|---|---|---|---|
| UC01 | Créer un compte | US01 | Visiteur | Non |
| UC02 | Se connecter | US01 | Visiteur | Non |
| UC03 | Déposer un fichier et obtenir un lien | US02 | Utilisateur inscrit | **Oui** |
| UC04 | Télécharger un fichier via un lien | US03/US04 | Destinataire | Non |
| UC05 | Consulter l'historique de ses fichiers | US05 | Utilisateur inscrit | **Oui** |
| UC06 | Supprimer un fichier | US06 | Utilisateur inscrit | **Oui** |

---

## UC01 — Créer un compte

**Objectif** : permettre à un visiteur d'ouvrir un compte pour pouvoir déposer des fichiers.

**Acteur principal** : Visiteur
**Déclencheur** : le visiteur clique sur « Créer un compte »
**Écran** : `/inscription` · **Endpoint** : `POST /api/auth/register`

**Préconditions**
- L'adresse email n'est pas déjà rattachée à un compte.

### Scénario nominal

1. Le visiteur ouvre la page d'inscription.
2. Il saisit une adresse email et un mot de passe d'au moins 8 caractères.
3. Il valide le formulaire.
4. Le front envoie `POST /api/auth/register` avec `{ email, password }`.
5. Le système valide le format de l'email et la longueur du mot de passe.
6. Le système vérifie qu'aucun compte n'existe pour cet email.
7. Le système hache le mot de passe (BCrypt) et enregistre l'utilisateur.
8. Le système répond `201 Created` (corps vide).
9. **Le front enchaîne automatiquement la connexion** (`POST /api/auth/login`) afin
   d'éviter une ressaisie des identifiants.
10. Le jeton est stocké et l'utilisateur est redirigé vers « Mes fichiers ».

### Scénarios d'exception

| Cas | Code | Message affiché |
|---|---|---|
| Email déjà rattaché à un compte | `409` | Email déjà utilisé |
| Format d'email invalide | `400` | Le format de l'email est invalide. |
| Mot de passe < 8 caractères | `400` | Le mot de passe doit contenir au moins 8 caractères. |
| Email ou mot de passe vide | `400` | L'email est obligatoire. / Le mot de passe est obligatoire. |
| API injoignable | — | Le service est momentanément indisponible. Réessayez plus tard. |

**Postconditions** : une ligne est créée dans `users` (identifiant UUID, email unique,
empreinte BCrypt, date de création). L'utilisateur est connecté.

### Règles de gestion

- **RG01** — L'email est unique : contrainte `UNIQUE` en base **et** contrôle applicatif
  préalable renvoyant un 409 explicite.
- **RG02** — Le mot de passe fait au minimum 8 caractères.
- **RG03** — Le mot de passe n'est **jamais** stocké en clair : empreinte BCrypt (coût 10,
  60 caractères) dans `users.password_hash`.
- **RG04** — L'inscription réussie enchaîne systématiquement sur la connexion.

---

## UC02 — Se connecter

**Objectif** : ouvrir une session authentifiée donnant accès aux fonctions réservées.

**Acteur principal** : Visiteur disposant d'un compte
**Déclencheur** : le visiteur clique sur « Se connecter »
**Écran** : `/connexion` · **Endpoint** : `POST /api/auth/login`

### Scénario nominal

1. Le visiteur saisit son email et son mot de passe.
2. Le front envoie `POST /api/auth/login`.
3. Le système recherche le compte par email.
4. Le système compare le mot de passe fourni à l'empreinte BCrypt enregistrée.
5. Le système génère un jeton JWT et répond `200` avec
   `{ token, expiresIn, userId, email }`.
6. Le front conserve le jeton et l'identité en stockage local du navigateur.
7. L'utilisateur est redirigé vers « Mes fichiers ».

### Scénarios d'exception

| Cas | Code | Message affiché |
|---|---|---|
| Compte inexistant | `401` | Identifiants invalides |
| Mot de passe incorrect | `401` | Identifiants invalides |
| Champ vide ou email malformé | `400` | Message de validation correspondant |

**Postconditions** : jeton JWT valable **1 heure**. La session survit à un rafraîchissement
de page. Une déconnexion purge le stockage local.

### Règles de gestion

- **RG05** — Le message d'erreur est **volontairement identique** pour un compte inexistant
  et un mot de passe incorrect : révéler la différence permettrait d'énumérer les comptes
  existants.
- **RG06** — Le jeton JWT (HS256) porte l'identifiant utilisateur, l'email, la date
  d'émission et la date d'expiration.
- **RG07** — Toute requête vers une ressource protégée transporte l'en-tête
  `Authorization: Bearer <token>`.
- **RG08** — Un jeton absent, expiré ou altéré n'interrompt pas la requête : elle poursuit
  son chemin en tant qu'anonyme, et c'est la configuration de sécurité qui tranche.

---

## UC03 — Déposer un fichier et obtenir un lien de partage

**Objectif** : téléverser un fichier et récupérer un lien temporaire à transmettre.

**Acteur principal** : Utilisateur inscrit
**Déclencheur** : clic sur « Ajouter un fichier »
**Écran** : `/televersement` · **Endpoint** : `POST /api/files` (multipart)

**Préconditions**
- L'utilisateur est authentifié (sinon redirection automatique vers `/connexion`).

### Scénario nominal

1. L'utilisateur ouvre la page de téléversement et sélectionne un fichier.
2. L'écran affiche le nom et la taille du fichier choisi.
3. L'utilisateur renseigne, **optionnellement**, un mot de passe de protection.
4. Il choisit une durée de validité : 1 jour, 3 jours ou 7 jours (7 par défaut).
5. Il valide le téléversement.
6. Le front envoie le fichier en multipart avec l'en-tête d'authentification.
7. Le système contrôle l'extension du fichier.
8. Le système borne la durée demandée entre 1 et 7 jours.
9. Le système écrit le fichier sur le disque sous un nom technique distinct du nom
   d'origine.
10. Le système hache le mot de passe s'il a été fourni, calcule la date d'expiration, et
    enregistre la ligne en base.
11. Le système répond `201 Created` avec l'identifiant et la date d'expiration.
12. Le front compose le lien de partage et l'affiche avec un bouton « Copier le lien ».

### Scénarios alternatifs

- **A1 — Changer de fichier** : avant validation, l'utilisateur peut revenir à la sélection.
- **A2 — Copie du lien impossible** : si le presse-papiers est indisponible (navigation hors
  `localhost`/HTTPS), un message invite à copier le lien affiché à la main.

### Scénarios d'exception

| Cas | Code | Message affiché |
|---|---|---|
| Extension interdite (`exe`, `bat`, `sh`, `cmd`, `msi`) | `400` | Type de fichier interdit : .xxx |
| Fichier supérieur à 1 Go | `413` | Le fichier est trop volumineux (1 Go maximum). |
| Jeton absent ou expiré | `403` | Vous n'avez pas accès à cette ressource. |

**Postconditions** : le fichier est présent sur le disque, une ligne existe dans `files`,
et un lien de partage est disponible.

### Règles de gestion

- **RG09** — La durée de validité est comprise entre 1 et 7 jours ; une valeur hors bornes
  est **ramenée silencieusement** dans l'intervalle (voir *Écarts constatés*).
- **RG10** — En l'absence de durée précisée, la valeur par défaut est 7 jours.
- **RG11** — Le mot de passe de fichier est facultatif ; s'il est fourni, il est haché en
  BCrypt et n'est jamais renvoyé par l'API.
- **RG12** — Les extensions interdites sont configurables sans recompilation.
- **RG13** — La taille maximale acceptée est de 1 Go.
- **RG14** — Le nom de stockage sur disque diffère du nom d'origine : cela évite les
  collisions et neutralise les noms de fichiers hostiles.

---

## UC04 — Télécharger un fichier via un lien

**Objectif** : permettre à un destinataire, **sans compte**, de consulter les
caractéristiques d'un fichier puis de le télécharger.

**Acteur principal** : Destinataire
**Déclencheur** : ouverture du lien de partage reçu
**Écran** : `/d/{id}` · **Endpoints** : `GET /api/files/{id}/info` puis
`POST /api/files/{id}/download`

### Scénario nominal

1. Le destinataire ouvre le lien reçu.
2. Le front interroge les métadonnées du fichier, **sans authentification**.
3. Le système vérifie que le fichier existe et n'a pas expiré.
4. La page affiche le nom, la taille, et indique si le fichier est protégé par mot de passe
   — **avant** tout téléchargement, conformément à US04.
5. Si le fichier est protégé, le destinataire saisit le mot de passe.
6. Il lance le téléchargement.
7. Le système contrôle à nouveau l'expiration puis, le cas échéant, le mot de passe.
8. Le système renvoie le flux binaire, en imposant un téléchargement plutôt qu'un affichage
   dans le navigateur.
9. Le fichier est enregistré sous son nom d'origine.

### Scénarios d'exception

| Cas | Code | Message affiché |
|---|---|---|
| Identifiant inconnu | `404` | Fichier introuvable |
| Lien expiré (consultation) | `410` | Ce lien a expiré |
| Lien expiré (téléchargement) | `410` | Ce lien a expiré |
| Mot de passe absent ou incorrect | `401` | Mot de passe requis ou incorrect |

**Postconditions** : le fichier est enregistré sur le poste du destinataire. Aucune trace
nominative n'est conservée côté serveur (pas de journal de téléchargement en MVP).

### Règles de gestion

- **RG15** — Les routes de consultation et de téléchargement sont **publiques** : la
  possession du lien fait foi.
- **RG16** — Les métadonnées sont consultables avant téléchargement, y compris l'information
  « protégé par mot de passe ».
- **RG17** — L'expiration est revérifiée **à chaque appel**, y compris au moment du
  téléchargement : un lien ne peut pas être exploité après sa date limite.
- **RG18** — Le mot de passe transite dans le corps de la requête (méthode POST), jamais
  dans l'URL, afin de ne pas se retrouver dans les journaux serveur ou l'historique.
- **RG19** — Le statut « actif / expiré » n'est pas une colonne : il se déduit de la
  comparaison entre la date d'expiration et l'instant courant.

---

## UC05 — Consulter l'historique de ses fichiers

**Objectif** : retrouver les fichiers déposés, leur statut et leur date d'expiration.

**Acteur principal** : Utilisateur inscrit
**Écran** : `/mes-fichiers` · **Endpoint** : `GET /api/files`

**Préconditions** : utilisateur authentifié.

### Scénario nominal

1. L'utilisateur ouvre « Mes fichiers ».
2. Le front appelle l'API avec le jeton.
3. Le système extrait l'identifiant utilisateur du jeton et ne retourne **que** les fichiers
   dont il est propriétaire.
4. La liste affiche, pour chaque fichier : nom, taille, date d'envoi, date d'expiration,
   pastille « Actif » ou « Expiré », et un cadenas si le fichier est protégé.
5. L'utilisateur peut basculer entre les onglets « Actifs » et « Expirés ».
6. Pour un fichier actif, il peut copier le lien de partage en un clic.

### Scénarios alternatifs

- **A1 — Aucun fichier** : un message explicite remplace la liste.
- **A2 — Copie du lien** : un retour visuel « Lien copié ✓ » confirme l'action pendant deux
  secondes ; en cas d'échec, un message d'erreur est affiché.

### Scénarios d'exception

| Cas | Code | Message affiché |
|---|---|---|
| Jeton absent ou expiré | `403` | Vous n'avez pas accès à cette ressource. |
| API injoignable | — | Impossible de charger tes fichiers. |

### Règles de gestion

- **RG20** — **Cloisonnement strict** : la requête filtre sur le propriétaire issu du jeton.
  Un utilisateur ne peut pas voir les fichiers d'un autre, même en connaissant leur
  identifiant.
- **RG21** — Les fichiers expirés restent visibles dans l'onglet dédié : l'utilisateur garde
  la trace de ce qu'il a envoyé.
- **RG22** — Le bouton de copie de lien est masqué pour les fichiers expirés, dont le lien
  ne fonctionne plus.

---

## UC06 — Supprimer un fichier

**Objectif** : retirer définitivement un fichier avant son expiration naturelle.

**Acteur principal** : Utilisateur inscrit
**Écran** : `/mes-fichiers` · **Endpoint** : `DELETE /api/files/{id}`

**Préconditions** : utilisateur authentifié et propriétaire du fichier.

### Scénario nominal

1. L'utilisateur clique sur « Supprimer » en face du fichier concerné.
2. Une **confirmation** rappelant le nom du fichier est demandée.
3. L'utilisateur confirme.
4. Le front envoie la requête de suppression avec le jeton.
5. Le système vérifie que le demandeur est bien le propriétaire.
6. Le système efface le fichier du disque, puis la ligne en base.
7. Le système répond `204 No Content`.
8. La ligne disparaît de la liste sans rechargement de la page.

### Scénarios alternatifs

- **A1 — Annulation** : si l'utilisateur refuse la confirmation, aucune requête n'est émise.

### Scénarios d'exception

| Cas | Code | Message affiché |
|---|---|---|
| Fichier appartenant à un autre utilisateur | `403` | Ce fichier ne vous appartient pas |
| Fichier déjà supprimé | `404` | Fichier introuvable |
| Jeton absent ou expiré | `403` | Vous n'avez pas accès à cette ressource. |

**Postconditions** : le fichier n'existe plus ni sur le disque ni en base. Tout lien
précédemment partagé renvoie désormais une erreur « Fichier introuvable ».

### Règles de gestion

- **RG23** — La confirmation est **obligatoire** : l'opération est irréversible.
- **RG24** — Seul le propriétaire peut supprimer un fichier ; la vérification est faite
  **côté serveur**, jamais uniquement dans l'interface.
- **RG25** — La suppression est physique : disque **et** base, dans cet ordre.
- **RG26** — Un fichier expiré reste supprimable, ce qui permet à l'utilisateur de faire le
  ménage dans son historique.

---

## Matrice des droits d'accès

| Route | Méthode | Authentification | Cas d'usage |
|---|---|---|---|
| `/api/health` | GET | Publique | Supervision |
| `/api/auth/register` | POST | Publique | UC01 |
| `/api/auth/login` | POST | Publique | UC02 |
| `/api/files` | POST | **Requise** | UC03 |
| `/api/files` | GET | **Requise** | UC05 |
| `/api/files/{id}` | DELETE | **Requise** | UC06 |
| `/api/files/{id}/info` | GET | Publique | UC04 |
| `/api/files/{id}/download` | POST | Publique | UC04 |

---

## Codes de retour normalisés

Toutes les erreurs sont renvoyées dans un format homogène
`{ timestamp, status, message }`, le champ `message` étant directement affichable à
l'utilisateur.

| Code | Signification dans DataShare |
|---|---|
| `200` | Succès avec contenu |
| `201` | Création effectuée (compte, dépôt de fichier) |
| `204` | Suppression effectuée, sans contenu en retour |
| `400` | Données invalides (validation, extension interdite) |
| `401` | Identifiants ou mot de passe de fichier incorrects |
| `403` | Authentification absente/expirée, ou ressource d'un autre utilisateur |
| `404` | Ressource inexistante |
| `409` | Conflit : email déjà utilisé |
| `410` | Lien expiré |
| `413` | Fichier trop volumineux |
| `500` | Erreur inattendue côté serveur |

---

## Écarts constatés entre l'implémentation et le besoin

Points relevés lors de la rédaction de ce document, à arbitrer avant la démonstration.

1. **Mot de passe de fichier non validé** — l'interface annonce « 6 caractères minimum si
   renseigné », mais aucun contrôle n'existe côté serveur ni côté client. Soit implémenter
   la règle, soit retirer la mention.
2. **Durée d'expiration corrigée silencieusement** — une valeur hors bornes est ramenée
   dans l'intervalle au lieu d'être rejetée par un `400`. Acceptable puisque l'interface ne
   propose que 1, 3 et 7 jours, mais un appel direct à l'API ne reçoit aucun signalement.
3. **Lien de partage calculé à deux endroits** — l'API renvoie un chemin que le front
   n'utilise pas, préférant le reconstruire à partir de l'adresse courante. Source de
   divergence potentielle : une seule des deux sources devrait faire foi.
4. **Aucune limitation des tentatives de connexion** — la route de connexion accepte un
   nombre illimité d'essais, ce qui expose à une attaque par force brute.
5. **Pas de purge des fichiers expirés** — les fichiers restent sur le disque après leur
   date d'expiration. Le lien ne fonctionne plus, mais l'espace n'est pas libéré. La tâche
   planifiée est hors périmètre MVP : à documenter comme dette assumée.
6. **Jeton conservé en stockage local** — pratique pour maintenir la session, mais lisible
   par un script en cas de faille XSS. Choix assumé pour le prototype, à réévaluer avant
   une mise en production.
