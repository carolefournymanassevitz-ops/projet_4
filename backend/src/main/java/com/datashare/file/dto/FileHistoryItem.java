package com.datashare.file.dto;

import java.time.Instant;
import java.util.UUID;

public record FileHistoryItem(
    UUID id,
    String originalFilename,
    long sizeBytes,
    Instant createdAt,
    Instant expiresAt,
    boolean passwordProtected,
    boolean expired
) {
}
