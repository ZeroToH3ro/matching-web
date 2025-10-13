import { NextRequest, NextResponse } from 'next/server';

/**
 * Generic API route for any external face swap service that accepts base64
 * Example: Replicate, DeepAI, custom Python service, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const { sourceImage, targetImage } = await request.json();

    if (!sourceImage || !targetImage) {
      return NextResponse.json(
        { error: 'Both images required' },
        { status: 400 }
      );
    }

    // Example: Call any external API that accepts base64
    const externalApiUrl = process.env.EXTERNAL_FACE_SWAP_API_URL;
    const apiKey = process.env.EXTERNAL_API_KEY;

    if (!externalApiUrl) {
      return NextResponse.json(
        { error: 'External API not configured' },
        { status: 500 }
      );
    }

    console.log('Calling external API with base64 images...');

    // Generic API call pattern
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Most APIs accept this format:
        source_image: sourceImage, // base64 data URL
        target_image: targetImage,
        // Or some APIs want just the base64 part:
        // source_image: sourceImage.split(',')[1],
        // target_image: targetImage.split(',')[1],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`External API error: ${errorData}`);
    }

    const data = await response.json();

    // Most APIs return base64 in one of these formats:
    let resultImageBase64;

    if (data.image) {
      // Format 1: Direct base64 string
      resultImageBase64 = data.image.startsWith('data:')
        ? data.image
        : `data:image/jpeg;base64,${data.image}`;
    } else if (data.output) {
      // Format 2: output field
      resultImageBase64 = Array.isArray(data.output)
        ? data.output[0]
        : data.output;
    } else if (data.result) {
      // Format 3: result field
      resultImageBase64 = data.result;
    } else {
      throw new Error('Unexpected API response format');
    }

    return NextResponse.json({
      success: true,
      imageUrl: resultImageBase64, // Base64 data URL
      note: 'Face swap completed by external API',
    });
  } catch (error) {
    console.error('External API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process with external API',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
