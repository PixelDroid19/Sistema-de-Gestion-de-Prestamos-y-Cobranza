import { apiClient } from '../api/client';

type DownloadBlobOptions = {
  url: string;
  fileName: string;
  mimeType: string;
  headers?: Record<string, string>;
};

export const downloadBlob = async ({ url, fileName, mimeType, headers }: DownloadBlobOptions): Promise<void> => {
  const response = await apiClient.get(url, {
    responseType: 'blob',
    headers,
  });

  const blob = new Blob([response.data], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};
