/**
 * Utility to get random face images from public/faces/
 */

// List of available faces in public/faces/
const AVAILABLE_FACES = [
  '/faces/face1.png',
  '/faces/face2.png',
  '/faces/face3.png',
  '/faces/face4.png',
  '/faces/face5.png',
  '/faces/face6.png',
  '/faces/face7.png',
];

/**
 * Get a random face URL from the available faces
 */
export function getRandomFaceUrl(): string {
  const randomIndex = Math.floor(Math.random() * AVAILABLE_FACES.length);
  return AVAILABLE_FACES[randomIndex];
}

/**
 * Get all available face URLs
 */
export function getAllFaceUrls(): string[] {
  return [...AVAILABLE_FACES];
}

/**
 * Get total number of available faces
 */
export function getFaceCount(): number {
  return AVAILABLE_FACES.length;
}
