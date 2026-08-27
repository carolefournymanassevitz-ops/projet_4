# Performance — DataShare

Mesures relevées sur le MVP, budget front-end, et pistes d'optimisation.

Relevé du **21/08/2026**, poste de développement Windows 11, PostgreSQL 16 en conteneur
Docker, back-end et front-end en local.

## Méthode

Mesures effectuées avec `curl` sur l'API en fonctionnement, temps total de la requête
(`%{time_total}`), trois relevés successifs pour les opérations rapides. Il s'agit de
**mesures à vide, sur un poste unique** : elles caractérisent la latence de base, pas le
comportement en charge.

## Résultats

### Opérations d'authentification

| Opération | Temps | Commentaire |
|---|---|---|
| Inscription | 166 ms | Hachage BCrypt inclus |
| Connexion (3 relevés) | 139 / 122 / 135 ms | Vérification BCrypt inclus |

Ces deux opérations sont **volontairement lentes** : BCrypt au coût 10 impose environ
120 ms de calcul. C'est le comportement recherché — un hachage rapide faciliterait les
attaques par force brute. Ce coût n'est payé qu'à l'inscription et à la connexion.

### Opérations courantes

| Opération | Temps | Commentaire |
|---|---|---|
| Historique des fichiers (3 relevés) | 12 / 6 / 7 ms | Requête indexée sur `owner_id` |
| Dépôt d'un fichier de 5 Mo | 77 ms | ~65 Mo/s en écriture disque |
| Téléchargement d'un fichier de 5 Mo | 43 ms | ~117 Mo/s en lecture |
| Point de santé `/api/health` | 72 ms | Premier appel, initialisation du servlet |

La lecture est environ deux fois plus rapide que l'écriture, ce qui correspond au
comportement attendu d'un SSD. Aucune opération courante ne dépasse 15 ms hors transfert de
fichier.

### Budget front-end

| Ressource | Taille | Budget indicatif |
|---|---|---|
| Bundle JavaScript | **265 Ko** | < 300 Ko |
| Feuille de styles | **6,9 Ko** | < 50 Ko |
| Total du build | **297 Ko** | < 400 Ko |

Le bundle contient React 19, Redux Toolkit et React Router. Il tient dans le budget, mais
sans marge confortable : toute nouvelle dépendance lourde devra être justifiée.

## Choix ayant un effet sur la performance

| Choix | Effet |
|---|---|
| `spring.jpa.open-in-view: false` | Ferme la session Hibernate à la sortie du service : évite les requêtes tardives et la rétention de connexions pendant la sérialisation |
| Index sur `files(owner_id)` | L'historique reste rapide quand le nombre de fichiers croît |
| Index sur `files(expires_at)` | Prépare la future purge des fichiers expirés |
| Statut « expiré » calculé, non stocké | Aucune écriture périodique, aucun risque de désynchronisation |
| Fichiers servis en flux (`Resource`) | Le contenu n'est pas chargé intégralement en mémoire |
| Pool de connexions HikariCP | Réutilisation des connexions PostgreSQL (défaut Spring Boot) |

## Limites des mesures

- **Aucun test de montée en charge.** Le comportement à 10, 100 ou 1000 utilisateurs
  simultanés est inconnu. Un scénario k6 ou JMeter serait la suite logique.
- **Aucune mesure sur un fichier de 1 Go**, alors que c'est la limite annoncée. Le débit
  observé sur 5 Mo laisse présager environ 15 s, mais l'occupation mémoire n'est pas
  vérifiée.
- **Aucun audit Lighthouse** sur le front : les métriques de rendu perçu (LCP, CLS) ne sont
  pas connues.
- **Mesures locales uniquement** : pas de latence réseau, pas de concurrence, cache disque
  chaud.

## Pistes d'optimisation

Par ordre de pertinence si le prototype devait grandir.

1. **Pagination de l'historique** — `GET /api/files` renvoie tous les fichiers d'un
   utilisateur sans limite. Correct pour un MVP, problématique à quelques milliers de lignes.
2. **Purge des fichiers expirés** — sans elle, le disque croît indéfiniment ; c'est le
   premier problème de performance qui se manifestera dans la durée.
3. **Compression HTTP** sur les réponses JSON.
4. **Découpage du bundle** (`React.lazy` sur la page de téléchargement, seule page publique)
   pour alléger le chargement initial des visiteurs sans compte.
5. **Cache d'en-têtes** sur les ressources statiques du build Vite.
