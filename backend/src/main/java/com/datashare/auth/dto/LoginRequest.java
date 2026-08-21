package com.datashare.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @NotBlank(message = "L'email est obligatoire.")
    @Email(message = "Le format de l'email est invalide.")
    String email,

    @NotBlank(message = "Le mot de passe est obligatoire.")
    String password
) {
}
