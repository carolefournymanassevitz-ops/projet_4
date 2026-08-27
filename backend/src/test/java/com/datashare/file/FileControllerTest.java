package com.datashare.file;

import com.datashare.security.JwtService;
import com.datashare.user.User;
import com.datashare.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests d'intégration du cycle de vie d'un fichier (US02 à US06).
 *
 * <p>Le stockage est redirigé vers {@code target/} pour ne rien écrire dans le dossier
 * {@code storage/} de développement ; {@code mvn clean} suffit à faire le ménage.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "app.storage.base-path=./target/test-storage")
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    // ---------- utilitaires ----------

    private User creerUtilisateur(String email) {
        return userRepository.save(new User(email, passwordEncoder.encode("motdepasse123")));
    }

    private String jetonPour(User utilisateur) {
        return "Bearer " + jwtService.generateToken(utilisateur.getId(), utilisateur.getEmail());
    }

    /** Crée une ligne en base sans passer par l'API : utile pour forcer une date d'expiration. */
    private FileUpload creerLigneFichier(User proprietaire, String nom, Instant expiration) {
        UUID id = UUID.randomUUID();
        FileUpload fichier = new FileUpload(id, proprietaire, nom, id + ".txt", "text/plain",
            12L, null, expiration);
        return fileRepository.save(fichier);
    }

    /** Dépose réellement un fichier via l'API et renvoie son identifiant. */
    private String deposerFichier(String jeton, String nomFichier, String motDePasse) throws Exception {
        MockMultipartFile fichier = new MockMultipartFile(
            "file", nomFichier, "text/plain", "contenu de test".getBytes(StandardCharsets.UTF_8));

        var requete = multipart("/api/files")
            .file(fichier)
            .param("expirationDays", "7")
            .header("Authorization", jeton);

        String reponse = mockMvc.perform(
                motDePasse == null ? requete : requete.param("password", motDePasse))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

        return JsonPath.read(reponse, "$.id");
    }

    // ---------- Dépôt (US02) ----------

    @Test
    @DisplayName("Dépôt : un fichier valide est accepté et renvoie un identifiant")
    void depot_avecFichierValide_renvoie201() throws Exception {
        User utilisateur = creerUtilisateur("depot@datashare.fr");

        MockMultipartFile fichier = new MockMultipartFile(
            "file", "rapport.pdf", "application/pdf", "contenu".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/files")
                .file(fichier)
                .param("expirationDays", "3")
                .header("Authorization", jetonPour(utilisateur)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andExpect(jsonPath("$.expiresAt").isNotEmpty());
    }

    @Test
    @DisplayName("Dépôt : une extension interdite est refusée en 400")
    void depot_avecExtensionInterdite_renvoie400() throws Exception {
        User utilisateur = creerUtilisateur("interdit@datashare.fr");

        MockMultipartFile fichier = new MockMultipartFile(
            "file", "virus.exe", "application/octet-stream", "binaire".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/files")
                .file(fichier)
                .header("Authorization", jetonPour(utilisateur)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Type de fichier interdit : .exe"));
    }

    @Test
    @DisplayName("Dépôt : un mot de passe de fichier trop court est refusé en 400")
    void depot_avecMotDePasseFichierTropCourt_renvoie400() throws Exception {
        User utilisateur = creerUtilisateur("mdpcourt@datashare.fr");

        MockMultipartFile fichier = new MockMultipartFile(
            "file", "note.txt", "text/plain", "contenu".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/files")
                .file(fichier)
                .param("password", "abc")
                .header("Authorization", jetonPour(utilisateur)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Le mot de passe doit contenir au moins 6 caractères"));
    }

    @Test
    @DisplayName("Dépôt : une durée d'expiration hors bornes est refusée en 400")
    void depot_avecExpirationHorsBornes_renvoie400() throws Exception {
        User utilisateur = creerUtilisateur("expiration@datashare.fr");

        MockMultipartFile fichier = new MockMultipartFile(
            "file", "note.txt", "text/plain", "contenu".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/files")
                .file(fichier)
                .param("expirationDays", "30")
                .header("Authorization", jetonPour(utilisateur)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("L'expiration doit être comprise entre 1 et 7 jours"));
    }

    @Test
    @DisplayName("Dépôt : sans jeton, l'accès est refusé")
    void depot_sansJeton_estRefuse() throws Exception {
        MockMultipartFile fichier = new MockMultipartFile(
            "file", "rapport.pdf", "application/pdf", "contenu".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/files").file(fichier))
            .andExpect(status().isForbidden());
    }

    // ---------- Historique (US05) ----------

    @Test
    @DisplayName("Historique : un utilisateur ne voit que ses propres fichiers")
    void historique_neRenvoieQueLesFichiersDuProprietaire() throws Exception {
        User alice = creerUtilisateur("alice@datashare.fr");
        User bob = creerUtilisateur("bob@datashare.fr");

        Instant dansUneSemaine = Instant.now().plus(7, ChronoUnit.DAYS);
        creerLigneFichier(alice, "contrat-alice.txt", dansUneSemaine);
        creerLigneFichier(bob, "devis-bob.txt", dansUneSemaine);

        // Alice ne doit voir que son fichier, jamais celui de Bob : cloisonnement strict.
        mockMvc.perform(get("/api/files")
                .header("Authorization", jetonPour(alice)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].originalFilename").value("contrat-alice.txt"));
    }

    // ---------- Consultation du lien (US03) ----------

    @Test
    @DisplayName("Consultation : un lien expiré renvoie 410")
    void consultation_dunLienExpire_renvoie410() throws Exception {
        User utilisateur = creerUtilisateur("expire@datashare.fr");
        FileUpload perime = creerLigneFichier(utilisateur, "vieux.txt",
            Instant.now().minus(1, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/files/{id}/info", perime.getId()))
            .andExpect(status().isGone())
            .andExpect(jsonPath("$.message").value("Ce lien a expiré"));
    }

    @Test
    @DisplayName("Consultation : un identifiant inconnu renvoie 404")
    void consultation_dunIdentifiantInconnu_renvoie404() throws Exception {
        mockMvc.perform(get("/api/files/{id}/info", UUID.randomUUID()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Fichier introuvable"));
    }

    @Test
    @DisplayName("Consultation : les métadonnées sont publiques et signalent la protection")
    void consultation_dunFichierProtege_annonceLaProtection() throws Exception {
        User utilisateur = creerUtilisateur("meta@datashare.fr");
        String id = deposerFichier(jetonPour(utilisateur), "secret.txt", "motdepassefichier");

        // Aucun en-tête d'authentification : la route doit rester publique.
        mockMvc.perform(get("/api/files/{id}/info", id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.originalFilename").value("secret.txt"))
            .andExpect(jsonPath("$.passwordProtected").value(true));
    }

    // ---------- Téléchargement (US04) ----------

    @Test
    @DisplayName("Téléchargement : sans mot de passe sur un fichier protégé, refus en 401")
    void telechargement_sansMotDePasse_renvoie401() throws Exception {
        User utilisateur = creerUtilisateur("protege@datashare.fr");
        String id = deposerFichier(jetonPour(utilisateur), "confidentiel.txt", "motdepassefichier");

        mockMvc.perform(post("/api/files/{id}/download", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":null}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Mot de passe requis ou incorrect"));
    }

    @Test
    @DisplayName("Téléchargement : avec le bon mot de passe, le contenu est renvoyé")
    void telechargement_avecLeBonMotDePasse_renvoieLeContenu() throws Exception {
        User utilisateur = creerUtilisateur("telecharge@datashare.fr");
        String id = deposerFichier(jetonPour(utilisateur), "confidentiel.txt", "motdepassefichier");

        mockMvc.perform(post("/api/files/{id}/download", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"motdepassefichier\"}"))
            .andExpect(status().isOk())
            .andExpect(content().string("contenu de test"));
    }

    @Test
    @DisplayName("Téléchargement : un fichier sans mot de passe est accessible à tous")
    void telechargement_dunFichierLibre_estAccessibleSansCompte() throws Exception {
        User utilisateur = creerUtilisateur("libre@datashare.fr");
        String id = deposerFichier(jetonPour(utilisateur), "public.txt", null);

        mockMvc.perform(post("/api/files/{id}/download", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(content().string("contenu de test"));
    }

    // ---------- Suppression (US06) ----------

    @Test
    @DisplayName("Suppression : le propriétaire peut supprimer son fichier")
    void suppression_parLeProprietaire_renvoie204() throws Exception {
        User utilisateur = creerUtilisateur("suppression@datashare.fr");
        FileUpload fichier = creerLigneFichier(utilisateur, "a-supprimer.txt",
            Instant.now().plus(7, ChronoUnit.DAYS));

        mockMvc.perform(delete("/api/files/{id}", fichier.getId())
                .header("Authorization", jetonPour(utilisateur)))
            .andExpect(status().isNoContent());

        assertEquals(0, fileRepository.findByOwnerId(utilisateur.getId()).size(),
            "le fichier ne doit plus figurer dans l'historique");
    }

    @Test
    @DisplayName("Suppression : le fichier d'un autre utilisateur est protégé par un 403")
    void suppression_parUnAutreUtilisateur_renvoie403() throws Exception {
        User alice = creerUtilisateur("proprietaire@datashare.fr");
        User bob = creerUtilisateur("intrus@datashare.fr");

        FileUpload fichierDAlice = creerLigneFichier(alice, "prive-alice.txt",
            Instant.now().plus(7, ChronoUnit.DAYS));

        mockMvc.perform(delete("/api/files/{id}", fichierDAlice.getId())
                .header("Authorization", jetonPour(bob)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Ce fichier ne vous appartient pas"));
    }
}
