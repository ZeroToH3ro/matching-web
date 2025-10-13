/**
 * Face Swap Utilities
 * Improved algorithms for better face swapping quality
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extract face region from image with padding
 */
export function extractFace(
  image: HTMLImageElement,
  box: Box,
  padding: number = 0.3
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const paddedX = Math.max(0, box.x - box.width * padding);
  const paddedY = Math.max(0, box.y - box.height * padding);
  const paddedW = box.width * (1 + padding * 2);
  const paddedH = box.height * (1 + padding * 2);

  canvas.width = paddedW;
  canvas.height = paddedH;

  ctx.drawImage(
    image,
    paddedX,
    paddedY,
    paddedW,
    paddedH,
    0,
    0,
    paddedW,
    paddedH
  );

  return canvas;
}

/**
 * Get average color of an image region
 */
export function getAverageColor(imageData: ImageData): {
  r: number;
  g: number;
  b: number;
} {
  const pixels = imageData.data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha > 0) {
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      count++;
    }
  }

  return {
    r: count > 0 ? r / count : 0,
    g: count > 0 ? g / count : 0,
    b: count > 0 ? b / count : 0,
  };
}

/**
 * Match colors between source and target
 */
export function matchColors(
  faceCanvas: HTMLCanvasElement,
  targetAvgColor: { r: number; g: number; b: number },
  strength: number = 0.6
): HTMLCanvasElement {
  const ctx = faceCanvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, faceCanvas.width, faceCanvas.height);

  const faceAvgColor = getAverageColor(imageData);
  const pixels = imageData.data;

  // Apply color correction
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha > 0) {
      pixels[i] += (targetAvgColor.r - faceAvgColor.r) * strength;
      pixels[i + 1] += (targetAvgColor.g - faceAvgColor.g) * strength;
      pixels[i + 2] += (targetAvgColor.b - faceAvgColor.b) * strength;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return faceCanvas;
}

/**
 * Feather edges for smooth blending
 */
export function featherEdges(
  canvas: HTMLCanvasElement,
  featherSize: number = 20
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Create elliptical mask with feathering
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radiusX = canvas.width / 2;
  const radiusY = canvas.height / 2;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;

      // Calculate distance from edge (elliptical)
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      if (distFromCenter > 1) {
        // Outside ellipse
        pixels[idx + 3] = 0;
      } else if (distFromCenter > 1 - featherSize / radiusX) {
        // Feather zone
        const alpha =
          (1 - distFromCenter) / (featherSize / radiusX);
        pixels[idx + 3] *= alpha;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Improved face swap with blending
 * @param preserveSourceSize - If true, keep source image original size and place on target face position
 */
export function swapFacesWithBlending(
  sourceImage: HTMLImageElement,
  targetImage: HTMLImageElement,
  sourceBox: Box,
  targetBox: Box,
  preserveSourceSize: boolean = false
): HTMLCanvasElement {
  // Create result canvas - always use target image NATURAL dimensions (original size)
  const resultCanvas = document.createElement('canvas');
  const resultCtx = resultCanvas.getContext('2d')!;

  const targetNaturalWidth = targetImage.naturalWidth || targetImage.width;
  const targetNaturalHeight = targetImage.naturalHeight || targetImage.height;

  resultCanvas.width = targetNaturalWidth;
  resultCanvas.height = targetNaturalHeight;

  // Draw target image at original size
  resultCtx.drawImage(targetImage, 0, 0, targetNaturalWidth, targetNaturalHeight);

  console.log('=== Face Swap Debug ===');
  console.log('Target natural size:', targetNaturalWidth, 'x', targetNaturalHeight);
  console.log('Target display size:', targetImage.width, 'x', targetImage.height);
  console.log('Target box (should already be in natural size):', targetBox);

  // targetBox is already in natural size coordinates (from face detection on canvas)
  // No need to scale it
  const scaledTargetBox = targetBox;

  // Get target region average color for matching
  const targetRegionCanvas = document.createElement('canvas');
  const targetRegionCtx = targetRegionCanvas.getContext('2d')!;
  targetRegionCanvas.width = scaledTargetBox.width;
  targetRegionCanvas.height = scaledTargetBox.height;
  targetRegionCtx.drawImage(
    targetImage,
    scaledTargetBox.x,
    scaledTargetBox.y,
    scaledTargetBox.width,
    scaledTargetBox.height,
    0,
    0,
    scaledTargetBox.width,
    scaledTargetBox.height
  );
  const targetImageData = targetRegionCtx.getImageData(
    0,
    0,
    targetRegionCanvas.width,
    targetRegionCanvas.height
  );
  const targetAvgColor = getAverageColor(targetImageData);

  let processedFace: HTMLCanvasElement;
  let finalX: number;
  let finalY: number;

  if (preserveSourceSize) {
    // Scale source image to fit target face box while maintaining aspect ratio
    const sourceFaceCanvas = document.createElement('canvas');
    const sourceFaceCtx = sourceFaceCanvas.getContext('2d')!;

    // Get source natural size
    const sourceNaturalWidth = sourceImage.naturalWidth || sourceImage.width;
    const sourceNaturalHeight = sourceImage.naturalHeight || sourceImage.height;

    // Canvas size = scaled target face box size (this will be the visible area)
    sourceFaceCanvas.width = scaledTargetBox.width;
    sourceFaceCanvas.height = scaledTargetBox.height;

    // Calculate scale to fit source into target box (cover mode - fills the entire box)
    const scaleX = scaledTargetBox.width / sourceNaturalWidth;
    const scaleY = scaledTargetBox.height / sourceNaturalHeight;
    const scale = Math.max(scaleX, scaleY); // Use max to cover entire box

    // Calculate scaled dimensions
    const scaledWidth = sourceNaturalWidth * scale;
    const scaledHeight = sourceNaturalHeight * scale;

    // Center the scaled image in the box
    const offsetX = (scaledTargetBox.width - scaledWidth) / 2;
    const offsetY = (scaledTargetBox.height - scaledHeight) / 2;

    // Draw source image scaled to fit target face box
    sourceFaceCtx.drawImage(
      sourceImage,
      0, 0, sourceNaturalWidth, sourceNaturalHeight, // source rectangle (full image)
      offsetX, offsetY, scaledWidth, scaledHeight // destination (scaled and centered)
    );

    console.log('Source scaling:', {
      sourceNaturalSize: [sourceNaturalWidth, sourceNaturalHeight],
      targetBoxSize: [scaledTargetBox.width, scaledTargetBox.height],
      scale,
      scaledSize: [scaledWidth, scaledHeight],
      offset: [offsetX, offsetY]
    });

    // Position at scaled target face location
    finalX = scaledTargetBox.x;
    finalY = scaledTargetBox.y;

    // Apply color matching (optional, lighter strength)
    const colorMatched = matchColors(sourceFaceCanvas, targetAvgColor, 0.3);

    // Apply feathering
    processedFace = featherEdges(colorMatched, 20);
  } else {
    // Extract and resize source face to match target (original behavior)
    const sourceFace = extractFace(sourceImage, sourceBox, 0.2);

    const resizedFace = document.createElement('canvas');
    const resizedCtx = resizedFace.getContext('2d')!;
    resizedFace.width = targetBox.width;
    resizedFace.height = targetBox.height;
    resizedCtx.drawImage(sourceFace, 0, 0, targetBox.width, targetBox.height);

    // Apply color matching
    const colorMatched = matchColors(resizedFace, targetAvgColor, 0.5);

    // Apply feathering
    processedFace = featherEdges(colorMatched, 15);

    finalX = targetBox.x;
    finalY = targetBox.y;
  }

  // Blend onto target image
  resultCtx.globalCompositeOperation = 'source-over';
  resultCtx.drawImage(processedFace, finalX, finalY);

  return resultCanvas;
}
