package com.datashare.file;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${app.storage.base-path}")
    private String basePath;

    public String store(MultipartFile file, UUID id) throws IOException {
        Files.createDirectories(Paths.get(basePath));
        String extension = extractExtension(file.getOriginalFilename());
        String storedFilename = extension.isEmpty() ? id.toString() : id + "." + extension;
        Path target = Paths.get(basePath, storedFilename);
        file.transferTo(target);
        return storedFilename;
    }

    public Resource load(String storedFilename) {
        try {
            return new UrlResource(Paths.get(basePath, storedFilename).toUri());
        } catch (MalformedURLException e) {
            throw new IllegalStateException("Impossible de charger le fichier " + storedFilename, e);
        }
    }

    public void delete(String storedFilename) throws IOException {
        Files.deleteIfExists(Paths.get(basePath, storedFilename));
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null || !originalFilename.contains(".")) {
            return "";
        }
        return originalFilename.substring(originalFilename.lastIndexOf('.') + 1);
    }
}
