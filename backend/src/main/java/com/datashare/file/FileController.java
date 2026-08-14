package com.datashare.file;

import com.datashare.file.dto.DownloadRequest;
import com.datashare.file.dto.FileHistoryItem;
import com.datashare.file.dto.FileInfoResponse;
import com.datashare.file.dto.UploadResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;
    private final FileStorageService storageService;

    public FileController(FileService fileService, FileStorageService storageService) {
        this.fileService = fileService;
        this.storageService = storageService;
    }

    @PostMapping
    public ResponseEntity<UploadResponse> upload(@RequestParam("file") MultipartFile file,
                                                   @RequestParam(required = false) Integer expirationDays,
                                                   @RequestParam(required = false) String password) throws IOException {
        UploadResponse response = fileService.upload(file, expirationDays, password, currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public List<FileHistoryItem> history() {
        return fileService.listForOwner(currentUserId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) throws IOException {
        fileService.delete(id, currentUserId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/info")
    public FileInfoResponse info(@PathVariable UUID id) {
        return fileService.getInfo(id);
    }

    @PostMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable UUID id, @RequestBody(required = false) DownloadRequest request) {
        String password = request != null ? request.password() : null;
        FileUpload file = fileService.prepareDownload(id, password);
        Resource resource = storageService.load(file.getStoredFilename());

        MediaType mediaType = file.getContentType() != null
            ? MediaType.parseMediaType(file.getContentType())
            : MediaType.APPLICATION_OCTET_STREAM;

        return ResponseEntity.ok()
            .contentType(mediaType)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getOriginalFilename() + "\"")
            .body(resource);
    }

    private UUID currentUserId() {
        return (UUID) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
