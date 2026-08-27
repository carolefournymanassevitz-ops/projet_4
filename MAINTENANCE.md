# Maintenance — DataShare

Procédures d'exploitation, de mise à jour et de diagnostic du prototype.

## Organisation du dépôt

```
appFullStack/
  backend/          API Spring Boot
    src/main/java/com/datashare/
      auth/         Inscription, connexion, DTO
      file/         Dépôt, téléchargement, historique, stockage
      user/         Entité et dépôt utilisateur
      security/     Génération et validation des jetons, filtre JWT
      config/       Configuration de sécurité
      web/          Point de santé, gestion globale des erreurs
    src/main/resources/db/migration/   Migrations Flyway
  frontend/         SPA React
    src/pages/      Un composant par écran
    src/components/ Composants réutilisables
    src/services/   Appels HTTP
    src/store/      État global Redux
    src/utils/      Formatage, presse-papiers
  deploy/           docker-compose.yml, .env.example
  g.docs/           Documentation technique et fonctionnelle
```

## Environnement de développement

```bash
# 1. Base de données (Docker Desktop doit être démarré)
docker compose -f deploy/docker-compose.yml up -d

# 2. Back-end
cd backend && ./mvnw spring-boot:run

# 3. Front-end
cd frontend && npm run dev
```

> **Rappel important** : Spring Boot ne recharge pas le code Java à chaud. Après toute
> modification côté back-end, il faut arrêter (`Ctrl+C`) et relancer. Vérifier que l'heure
> de `Started DataShareApplication` est bien postérieure à la dernière sauvegarde — c'est la
> cause d'un faux diagnostic classique.

## Évolution du schéma de base

Le schéma est géré par **Flyway**, en mode `validate` côté Hibernate : l'application refuse
de démarrer si les entités et les tables divergent.

Pour ajouter une évolution :

1. Créer `backend/src/main/resources/db/migration/V2__description.sql`.
2. **Ne jamais modifier une migration déjà appliquée** — Flyway compare une empreinte et
   échouera au démarrage.
3. Redémarrer le back-end : la migration s'applique automatiquement.

Réinitialisation complète en développement (destructif) :

```bash
docker compose -f deploy/docker-compose.yml down -v
docker compose -f deploy/docker-compose.yml up -d
```

## Sauvegarde et restauration

Deux éléments à sauvegarder **ensemble** : la base de données et le répertoire de stockage.
Sauvegarder l'un sans l'autre produit un état incohérent — des métadonnées sans fichier, ou
des fichiers orphelins.

```bash
# Sauvegarde base
docker exec datashare-postgres pg_dump -U datashare datashare > sauvegarde.sql

# Sauvegarde fichiers
tar -czf stockage.tar.gz backend/storage/

# Restauration base
docker exec -i datashare-postgres psql -U datashare -d datashare < sauvegarde.sql
```

## Mise à jour des dépendances

```bash
# Back-end : versions disponibles
cd backend && ./mvnw versions:display-dependency-updates

# Front-end : versions obsolètes et vulnérabilités
cd frontend && npm outdated && npm audit
```

Après toute mise à jour, exécuter `./mvnw test` : les 22 tests d'intégration constituent le
filet anti-régression. Une montée de version de Spring Boot mérite une vigilance
particulière — le passage en 4.x a déjà déplacé des classes de test entre packages.

## Diagnostic des incidents courants

| Symptôme | Cause probable | Vérification |
|---|---|---|
| Erreur de pipe nommé au `docker compose` | Docker Desktop non démarré | Lancer Docker Desktop |
| `403` sur une route pourtant publique | La route interne `/error` n'est pas autorisée dans `SecurityConfig` | Activer `logging.level.org.springframework.security: DEBUG` et suivre la chaîne de filtres |
| Une modification Java sans effet | Back-end non redémarré | Comparer l'heure de `Started DataShareApplication` et celle du fichier modifié |
| Échec de démarrage sur validation du schéma | Entité et table divergentes | Vérifier la dernière migration Flyway |
| Le bouton « Copier le lien » ne fait rien | Front ouvert via l'adresse réseau au lieu de `localhost` | `navigator.clipboard` exige un contexte sécurisé |
| Tests en erreur de contexte | Docker arrêté, base inaccessible | `docker ps` |

### Activer les journaux de sécurité

Ajouter temporairement dans `application.yml` :

```yaml
logging:
  level:
    org.springframework.security: DEBUG
```

La chaîne de filtres devient visible pour chaque requête, avec la décision d'autorisation.
**Penser à retirer ce bloc ensuite** : la console devient rapidement illisible.

## Qualité du code

```bash
cd backend && ./mvnw test        # tests + rapport JaCoCo
cd frontend && npx tsc --noEmit  # vérification des types
cd frontend && npx oxlint        # analyse statique
```

## Dette technique identifiée

Suivi des points connus, par ordre de priorité. Détail dans
[g.docs/USE-CASES.md](g.docs/USE-CASES.md) et [SECURITY.md](SECURITY.md).

| Point | Impact | Priorité |
|---|---|---|
| Purge des fichiers expirés absente | Le disque croît indéfiniment | Haute |
| Aucune limitation des tentatives de connexion | Force brute possible | Haute |
| Aucun test front-end | Régressions d'interface non détectées | Moyenne |
| Historique sans pagination | Dégradation au-delà de quelques milliers de fichiers | Basse |
| Lien de partage construit à deux endroits | Risque de divergence front/back | Basse |
| `ARCHITECTURE.md` décrit une tâche planifiée non implémentée | Documentation trompeuse | Basse |
