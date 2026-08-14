package com.datashare.file.dto;

import java.time.Instant;

public record FileInfoResponse(
    String originalFilename,
    long sizeBytes,
    String contentType,
    Instant expiresAt,
    boolean passwordProtected
) {
}
