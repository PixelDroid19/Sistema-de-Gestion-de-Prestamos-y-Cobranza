export const saveBlob = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

export const downloadFile = async ({ loader, filename, fallbackFilename = 'download' }) => {
  const blob = await loader();
  saveBlob(blob, typeof filename === 'string' && filename.trim() ? filename : fallbackFilename);
  return blob;
};
