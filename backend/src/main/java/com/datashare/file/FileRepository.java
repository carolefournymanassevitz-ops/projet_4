package com.datashare.file;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FileRepository extends JpaRepository<FileUpload, UUID> {

    List<FileUpload> findByOwnerId(UUID ownerId);
}
