package com.datashare.auth.dto;

import java.util.UUID;

public record AuthResponse(
    String token,
    long expiresIn,
    UUID userId,
    String email
) {
}
