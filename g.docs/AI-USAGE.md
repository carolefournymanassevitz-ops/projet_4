# Utilisation de l'IA et revue technique du code produit

Ce document répond à deux exigences distinctes du référentiel : expliquer **comment** l'IA a
été utilisée pendant le développement, et fournir une **revue technique du code produit avec
son aide**.

Outil utilisé : **Claude Code** (assistant en ligne de commande), en supervision continue.

---

## 1. Méthode de travail

### Le cadre posé dès le départ

Un fichier `CLAUDE.md` à la racine du dépôt définit explicitement le rôle de l'assistant :
professeur senior, pas développeur substitut. Les règles imposées :

- expliquer les concepts **avant** de produire du code ;
- procéder étape par étape, en vérifiant la compréhension ;
- corriger en expliquant **pourquoi**, jamais en livrant seulement le correctif ;
- ne pas écrire la logique métier sans demande explicite ;
- ne pas exécuter les commandes de build, de test ou de versionnage.

La frontière retenue : **squelettes et fichiers techniques répétitifs pour l'IA, logique
métier pour moi**. Cette délimitation a été assouplie ponctuellement, sur demande explicite,
lorsque le temps manquait.

### Répartition effective

| Produit avec l'IA | Écrit sans assistance |
|---|---|
| Squelettes (Spring Initializr, Vite), `pom.xml`, `docker-compose.yml` | Entités, services et contrôleurs métier |
| Tests d'intégration back-end | Composants et pages React |
| Documentation technique et fonctionnelle | Migrations SQL |
| Diagnostic d'anomalies | Maquettes et parcours utilisateur |

### Le principe de supervision appliqué

La règle suivie tout au long du projet : **ne jamais accepter un diagnostic sans preuve**.

Un exemple concret, sur le bug d'authentification du 21/08. L'assistant a d'abord proposé
trois hypothèses successives — un serveur non redémarré, puis un compte existant, puis un
correctif incomplet. Les deux premières étaient fausses. Elles n'ont pas été retenues sur la
foi du raisonnement, mais **écartées par des vérifications** : comparaison des horodatages
de démarrage, interrogation directe de l'API, inspection de la base. La cause réelle n'a été
identifiée qu'après activation des journaux de sécurité, qui ont montré la redirection
interne vers `/error`.

Enseignement : un assistant produit des hypothèses plausibles et bien argumentées, y compris
quand elles sont fausses. La qualité de la supervision se mesure à l'exigence de preuve, pas
à la vraisemblance de l'explication.

---

## 2. Revue technique du code produit avec l'IA

Revue menée le 21/08/2026 sur l'ensemble du code assisté.

### Anomalies détectées et corrigées

| Anomalie | Origine | Détection | Correction |
|---|---|---|---|
| Route interne `/error` non autorisée dans `SecurityConfig` | Configuration initiale incomplète | Journaux Spring Security en DEBUG | Ajout de `/error` aux routes publiques |
| Erreurs métier écrasées en `403` opaque | Conséquence de la précédente | Appel direct à l'API : corps vide | `@RestControllerAdvice` produisant un format homogène |
| Messages d'erreur en anglais affichés à l'utilisateur | `reason` perdu par le traitement par défaut de Spring | Inspection de la réponse JSON | Messages de validation francisés dans les DTO |
| `navigator.clipboard` sans gestion d'échec | Promesse rejetée non capturée | Relecture de `UploadPage` | Fonction utilitaire avec repli et retour booléen |
| Copie de lien sans retour visuel dans « Mes fichiers » | Fonction sans effet sur l'interface | Relecture de `MyFilesPage` | Indicateur « Lien copié ✓ » temporaire |
| Import de test invalide en Spring Boot 4 | Package déplacé en 4.x | Inspection du classpath **avant** écriture | `org.springframework.boot.webmvc.test.autoconfigure` |
| Dépendance à un bean `ObjectMapper` inexistant | Hypothèse non vérifiée | Première exécution des tests : 12 erreurs | Extraction JSON par `JsonPath` |

### Points de vigilance relevés

**Une typographie invisible coûte cher.** Le premier correctif de sécurité a été saisi
`"/error/"` au lieu de `"/error"`. Le slash final change complètement le motif : la route
n'était plus reconnue et le symptôme restait identique. Diagnostiquer un correctif juste
mais mal appliqué est plus difficile que diagnostiquer le bug d'origine.

**La documentation dérive plus vite que le code.** `ARCHITECTURE.md` décrit une tâche
planifiée `@Scheduled` de purge des fichiers expirés, représentée dans le diagramme, mais
absente du code — elle est hors périmètre MVP. Le `README.md` annonçait encore
« implémentation à venir » alors que l'application était complète, et tous ses liens
pointaient vers un dossier `docs/` renommé depuis en `g.docs/`. Ces écarts sont apparus
progressivement, sans qu'aucune alerte ne les signale.

**Le code assisté est syntaxiquement correct mais pas nécessairement complet.** Les deux
défauts de copie de lien en sont l'illustration : le code compilait, faisait appel à la
bonne API, et échouait silencieusement en cas de refus du navigateur. Ce sont des oublis de
cas limites, pas des erreurs de syntaxe — donc invisibles au compilateur comme au linter.

### Évaluation de la qualité du code assisté

| Critère | Appréciation |
|---|---|
| Structure en couches | Conforme aux conventions Spring, responsabilités bien séparées |
| Nommage | Explicite et cohérent, en français pour le métier |
| Commentaires | Expliquent l'intention plutôt que de paraphraser le code |
| Gestion des cas limites | **Point faible** — les chemins d'erreur étaient les moins soignés |
| Sécurité | Bonnes pratiques respectées (hachage, cloisonnement vérifié côté serveur) |
| Testabilité | Injection par constructeur, dépendances explicites |

### Mesures de contrôle mises en place

1. **Tests d'intégration** — 22 tests couvrant les trois fonctionnalités critiques, 93,6 %
   de couverture d'instructions. Le bug `/error` aurait été détecté immédiatement par le
   test d'inscription.
2. **Vérification systématique avant écriture** — inspection du classpath plutôt que
   supposition sur les imports.
3. **Documentation dérivée du code réel** — `USE-CASES.md` a été rédigé en lisant les
   services, pas le cahier des charges ; c'est ainsi que six écarts entre l'intention et
   l'implémentation ont été identifiés.
4. **Audit d'autoévaluation** — confrontation des 57 indicateurs du référentiel au contenu
   effectif du dépôt, avec preuve exigée pour chaque statut.

---

## 3. Bilan

L'assistance a fait gagner un temps réel sur les tâches répétitives — configuration,
squelettes, tests, documentation — et sur le diagnostic, à condition de ne jamais accepter
une conclusion non prouvée.

Sa principale limite observée n'est pas la production de code incorrect, mais la production
de code **plausible et incomplet** : des chemins nominaux soignés, des cas limites négligés.
D'où l'importance des tests, qui transforment une relecture subjective en vérification
reproductible.

Le second enseignement porte sur le contexte : une version récente et peu documentée
(Spring Boot 4.1) met l'assistant en difficulté, ses réponses reflétant majoritairement la
version précédente. La vérification factuelle — lire le classpath, interroger l'API,
consulter les journaux — reste la seule méthode fiable.
