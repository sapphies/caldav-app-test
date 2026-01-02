/**
 * Download a file to the user's computer
 * @param content - The file content as a string
 * @param fileName - The name of the file to download
 * @param mimeType - The MIME type of the file (default: 'text/plain')
 */
export const downloadFile = (content: string, fileName: string, mimeType: string = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const element = document.createElement('a');
  element.href = url;
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
};
