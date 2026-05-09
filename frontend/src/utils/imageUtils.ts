/**
 * Fetches an image from a URL and converts it to a Base64 data URI.
 * This ensures the image is available offline.
 */
export async function getBase64Image(url: string): Promise<string> {
  if (url.startsWith('data:')) return url; // Already base64
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return url; // Fallback to original URL
  }
}
