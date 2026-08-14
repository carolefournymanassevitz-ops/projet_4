package com.datashare.file;

import com.datashare.file.dto.FileHistoryItem;
import com.datashare.file.dto.FileInfoResponse;
import com.datashare.file.dto.UploadResponse;
import com.datashare.user.User;
import com.datashare.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class FileService {

    private final FileRepository fileRepository;
    private final UserRepository userRepository;
    private final FileStorageService storageService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.upload.forbidden-extensions}")
    private String forbiddenExtensionsCsv;

    public FileService(FileRepository fileRepository, UserRepository userRepository,
                        FileStorageService storageService, PasswordEncoder passwordEncoder) {
        this.fileRepository = fileRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.passwordEncoder = passwordEncoder;
    }

    public UploadResponse upload(MultipartFile file, Integer expirationDays, String password, UUID ownerId) throws IOException {
        validateExtension(file.getOriginalFilename());

        int days = (expirationDays == null) ? 7 : Math.min(Math.max(expirationDays, 1), 7);
        User owner = userRepository.getReferenceById(ownerId);
        UUID id = UUID.randomUUID();
        String storedFilename = storageService.store(file, id);
        String passwordHash = (password != null && !password.isBlank()) ? passwordEncoder.encode(password) : null;
        Instant expiresAt = Instant.now().plus(days, ChronoUnit.DAYS);

        FileUpload fileUpload = new FileUpload(id, owner, file.getOriginalFilename(), storedFilename,
            file.getContentType(), file.getSize(), passwordHash, expiresAt);
        fileRepository.save(fileUpload);

        return new UploadResponse(id, "/d/" + id, expiresAt);
    }

    public List<FileHistoryItem> listForOwner(UUID ownerId) {
        return fileRepository.findByOwnerId(ownerId).stream()
            .map(f -> new FileHistoryItem(f.getId(), f.getOriginalFilename(), f.getSizeBytes(), f.getCreatedAt(),
                f.getExpiresAt(), f.isPasswordProtected(), f.isExpired()))
            .toList();
    }

    public void delete(UUID fileId, UUID ownerId) throws IOException {
        FileUpload file = findOrThrow(fileId);
        if (!file.getOwner().getId().equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce fichier ne vous appartient pas");
        }
        storageService.delete(file.getStoredFilename());
        fileRepository.delete(file);
    }

    public FileInfoResponse getInfo(UUID fileId) {
        FileUpload file = findOrThrow(fileId);
        if (file.isExpired()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Ce lien a expiré");
        }
        return new FileInfoResponse(file.getOriginalFilename(), file.getSizeBytes(), file.getContentType(),
            file.getExpiresAt(), file.isPasswordProtected());
    }

    public FileUpload prepareDownload(UUID fileId, String password) {
        FileUpload file = findOrThrow(fileId);
        if (file.isExpired()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Ce lien a expiré");
        }
        if (file.isPasswordProtected()
            && (password == null || !passwordEncoder.matches(password, file.getPasswordHash()))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Mot de passe requis ou incorrect");
        }
        return file;
    }

    private FileUpload findOrThrow(UUID fileId) {
        return fileRepository.findById(fileId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable"));
    }

    private void validateExtension(String originalFilename) {
        if (originalFilename == null || !originalFilename.contains(".")) {
            return;
        }
        String extension = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
        Set<String> forbidden = Set.of(forbiddenExtensionsCsv.toLowerCase().split(","));
        if (forbidden.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type de fichier interdit : ." + extension);
        }
    }
}
