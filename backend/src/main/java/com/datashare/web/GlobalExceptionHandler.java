package com.datashare.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Traduit toute exception en réponse JSON homogène : { timestamp, status, message }.
 * <p>
 * Le champ "message" est celui que le front affiche tel quel à l'utilisateur
 * (voir la fonction toApiError de frontend/src/services/http.ts). Sans ce
 * gestionnaire, Spring construit lui-même la réponse d'erreur en repassant par
 * la route interne /error, et le "reason" des ResponseStatusException est perdu.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ApiErrorBody(Instant timestamp, int status, String message) {
    }

    /** Erreurs métier levées volontairement par les services (401, 409, 404, 410…). */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorBody> handleResponseStatus(ResponseStatusException ex) {
        String message = ex.getReason() != null ? ex.getReason() : "Une erreur est survenue.";
        return build(ex.getStatusCode(), message);
    }

    /** Échecs de validation @Valid sur les DTO : on concatène les messages des champs. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorBody> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(fieldError -> fieldError.getDefaultMessage())
            .filter(Objects::nonNull)
            .collect(Collectors.joining(" "));

        return build(
            HttpStatus.BAD_REQUEST,
            message.isBlank() ? "Les informations envoyées sont invalides." : message
        );
    }

    /**
     * Erreurs standard de Spring MVC (404 sur une route inconnue, 405 méthode
     * non supportée…). Sans ce cas, elles tomberaient dans le filet à 500.
     */
    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<ApiErrorBody> handleErrorResponse(ErrorResponseException ex) {
        String detail = ex.getBody().getDetail();
        return build(ex.getStatusCode(), detail != null ? detail : "Une erreur est survenue.");
    }

    /**
     * Laisse repasser les refus d'accès : c'est à Spring Security de produire
     * le 401/403, surtout pas à ce gestionnaire de les transformer en 500.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public void handleAccessDenied(AccessDeniedException ex) {
        throw ex;
    }

    /** Filet de sécurité : on trace la cause côté serveur, sans la divulguer au client. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorBody> handleUnexpected(Exception ex) {
        log.error("Erreur inattendue non gérée", ex);
        return build(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Le service est momentanément indisponible. Réessayez plus tard."
        );
    }

    private ResponseEntity<ApiErrorBody> build(HttpStatusCode status, String message) {
        return ResponseEntity
            .status(status)
            .body(new ApiErrorBody(Instant.now(), status.value(), message));
    }
}
