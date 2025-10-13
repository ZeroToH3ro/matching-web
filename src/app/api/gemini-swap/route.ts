import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured. Add it to .env.local' },
        { status: 500 }
      );
    }

    const { sourceImage, targetImage, prompt } = await request.json();

    if (!sourceImage || !targetImage) {
      return NextResponse.json(
        { error: 'Both sourceImage and targetImage are required' },
        { status: 400 }
      );
    }

    // Extract base64 data (remove data:image/jpeg;base64, prefix)
    const sourceBase64 = sourceImage.split(',')[1] || sourceImage;
    const targetBase64 = targetImage.split(',')[1] || targetImage;

    // Prompt for face transformation
    const defaultPrompt = `Transform the person in the second image to have the facial features from the first image.

Instructions:
1. Analyze facial features from image 1 (eyes, nose, mouth, face structure)
2. Apply those features to the person in image 2
3. Keep the person's pose, body, clothing, and background from image 2
4. Blend features naturally and seamlessly
5. Maintain realistic lighting and perspective
6. If image 1 is an animal (seal, dog, cat), creatively adapt its features to human face structure
7. Make it photorealistic

Generate the transformed image.`;

    const textPrompt = prompt || defaultPrompt;

    console.log('Calling Gemini 2.5 Flash Image API...');

    // Call Gemini REST API directly - following the example pattern
    const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: textPrompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: sourceBase64,
                },
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: targetBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);

      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API request failed',
          details: errorText,
          note: 'Make sure you have access to gemini-2.5-flash-image model. Check https://aistudio.google.com/app/apikey',
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Gemini response received');

    // Extract image from response
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inline_data && part.inline_data.data) {
            // Found image in response!
            const imageData = part.inline_data.data;
            const mimeType = part.inline_data.mime_type || 'image/jpeg';

            console.log('✅ Image generated successfully by Gemini!');

            return NextResponse.json({
              success: true,
              imageUrl: `data:${mimeType};base64,${imageData}`,
              note: 'Image generated successfully by Gemini 2.5 Flash Image',
            });
          }
        }
      }
    }

    // No image found in response
    console.log('No image in response:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: false,
      error: 'No image generated',
      note: 'Gemini API responded but did not return an image. You may not have access to gemini-2.5-flash-image model.',
      response: data,
    });

  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process with Gemini',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
