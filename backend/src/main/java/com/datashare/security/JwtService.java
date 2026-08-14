package com.datashare.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-seconds}")
    private long expirationSeconds;

    public String generateToken(UUID userId, String email) {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationSeconds * 1000);

        return Jwts.builder()
            .subject(email)
            .claim("userId", userId.toString())
            .issuedAt(now)
            .expiration(expiry)
            .signWith(key)
            .compact();
    }

    public UUID extractUserId(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        String userId = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .get("userId", String.class);
        return UUID.fromString(userId);
    }

    public long getExpirationSeconds() {
        return expirationSeconds;
    }
}
