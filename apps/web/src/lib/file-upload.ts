import type { FileAttachment } from '@magically/shared/types';
import { BASE_URL } from './api';

export interface PendingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  result?: FileAttachment;
  error?: string;
  previewUrl?: string;
}

const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export { MAX_TOTAL_FILE_SIZE };

export function uploadFile(
  file: File,
  onProgress: (progress: number) => void,
): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('magically_token');
    if (!token) { reject(new Error('Not authenticated')); return; }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/api/uploads`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('X-File-Name', file.name);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as { url: string; size: number };
          resolve({
            name: file.name,
            type: file.type,
            url: result.url,
            size: file.size,
          });
        } catch {
          reject(new Error('Invalid upload response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}
