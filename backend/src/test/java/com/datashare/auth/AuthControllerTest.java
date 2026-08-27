package com.datashare.auth;

import com.datashare.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests d'intégration de l'authentification (US01).
 *
 * <p>{@code @Transactional} annule en base tout ce que chaque test a écrit : les comptes
 * créés ici ne polluent pas la base de développement.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    private static String corps(String email, String motDePasse) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + motDePasse + "\"}";
    }

    // ---------- Inscription ----------

    @Test
    @DisplayName("Inscription : un compte valide est créé et renvoie 201")
    void inscription_avecDonneesValides_creeLeCompte() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("nouvelle@datashare.fr", "motdepasse123")))
            .andExpect(status().isCreated());

        assertTrue(userRepository.existsByEmail("nouvelle@datashare.fr"),
            "le compte doit exister en base après l'inscription");
    }

    @Test
    @DisplayName("Inscription : un email déjà utilisé est refusé en 409")
    void inscription_avecEmailDejaUtilise_renvoie409() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("doublon@datashare.fr", "motdepasse123")))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("doublon@datashare.fr", "unautremotdepasse")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("Email déjà utilisé"));
    }

    @Test
    @DisplayName("Inscription : un mot de passe de moins de 8 caractères est refusé en 400")
    void inscription_avecMotDePasseTropCourt_renvoie400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("courte@datashare.fr", "abc")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Le mot de passe doit contenir au moins 8 caractères."));
    }

    @Test
    @DisplayName("Inscription : un email malformé est refusé en 400")
    void inscription_avecEmailInvalide_renvoie400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("pas-un-email", "motdepasse123")))
            .andExpect(status().isBadRequest());
    }

    // ---------- Connexion ----------

    @Test
    @DisplayName("Connexion : des identifiants valides renvoient un jeton exploitable")
    void connexion_avecIdentifiantsValides_renvoieUnJeton() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("connexion@datashare.fr", "motdepasse123")))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("connexion@datashare.fr", "motdepasse123")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").isNotEmpty())
            .andExpect(jsonPath("$.email").value("connexion@datashare.fr"))
            .andExpect(jsonPath("$.userId").isNotEmpty())
            .andExpect(jsonPath("$.expiresIn").value(3600));
    }

    @Test
    @DisplayName("Connexion : un mot de passe incorrect est refusé en 401")
    void connexion_avecMauvaisMotDePasse_renvoie401() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("mauvais@datashare.fr", "motdepasse123")))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("mauvais@datashare.fr", "cenestpaslebon")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Identifiants invalides"));
    }

    /**
     * RG05 : le message doit être stricement le même que pour un mot de passe incorrect,
     * sinon un attaquant pourrait énumérer les comptes existants.
     */
    @Test
    @DisplayName("Connexion : un compte inexistant renvoie le même message qu'un mot de passe faux")
    void connexion_avecCompteInexistant_renvoieLeMemeMessage() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps("jamais-inscrit@datashare.fr", "motdepasse123")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Identifiants invalides"));
    }
}
