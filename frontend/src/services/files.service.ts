import { request, requestBlob, upload } from './http';

export type UploadResult = {
  id: string;
  downloadUrl: string;
  expiresAt: string;
};

export type FileHistoryItem = {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  passwordProtected: boolean;
  expired: boolean;
};

export type FileInfo = {
  originalFilename: string;
  sizeBytes: number;
  contentType: string | null;
  expiresAt: string;
  passwordProtected: boolean;
};

export type UploadParams = {
  file: File;
  expirationDays: number;
  password?: string;
};

export const filesService = {
  upload({ file, expirationDays, password }: UploadParams): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('expirationDays', String(expirationDays));
    if (password) {
      formData.append('password', password);
    }
    return upload<UploadResult>('/files', formData);
  },

  list(): Promise<FileHistoryItem[]> {
    return request<FileHistoryItem[]>('/files');
  },

  remove(id: string): Promise<void> {
    return request<void>(`/files/${id}`, { method: 'DELETE' });
  },

  getInfo(id: string): Promise<FileInfo> {
    return request<FileInfo>(`/files/${id}/info`, { auth: false });
  },

  download(id: string, password?: string): Promise<Blob> {
    return requestBlob(`/files/${id}/download`, { password: password ?? null });
  },
};
