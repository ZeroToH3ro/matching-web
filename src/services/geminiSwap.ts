/**
 * Gemini AI Face Swap Service
 */

export interface GeminiSwapResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  note?: string;
}

export async function swapFacesWithGemini(
  sourceImage: string,
  targetImage: string,
  customPrompt?: string
): Promise<GeminiSwapResult> {
  try {
    const response = await fetch('/api/gemini-swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceImage,
        targetImage,
        prompt: customPrompt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to swap faces with Gemini');
    }

    return data;
  } catch (error) {
    console.error('Gemini swap error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert image element to base64 data URL
 */
export function imageToBase64(imageElement: HTMLImageElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    ctx.drawImage(imageElement, 0, 0);

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}
