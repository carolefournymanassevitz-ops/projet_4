package com.datashare.file.dto;

import java.time.Instant;
import java.util.UUID;

public record UploadResponse(
    UUID id,
    String downloadUrl,
    Instant expiresAt
) {
}
