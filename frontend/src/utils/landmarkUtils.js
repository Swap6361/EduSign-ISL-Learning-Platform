/**
 * Landmark utilities for MediaPipe hand detection
 */

/**
 * Normalize landmarks to 0-1 range
 */
export const normalizeLandmarks = (landmarks) => {
  if (!landmarks || landmarks.length === 0) return [];

  const xCoords = landmarks.map(lm => lm.x);
  const yCoords = landmarks.map(lm => lm.y);
  
  const minX = Math.min(...xCoords);
  const minY = Math.min(...yCoords);
  const maxX = Math.max(...xCoords);
  const maxY = Math.max(...yCoords);
  
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return landmarks.map(lm => ({
    x: (lm.x - minX) / rangeX,
    y: (lm.y - minY) / rangeY,
    z: lm.z
  }));
};

/**
 * Convert landmarks to flat array for model input
 */
export const landmarksToArray = (landmarks) => {
  const normalized = normalizeLandmarks(landmarks);
  const flatArray = [];
  
  normalized.forEach(lm => {
    flatArray.push(lm.x, lm.y, lm.z);
  });
  
  return flatArray;
};

/**
 * Check if hand is stable (not moving too much)
 */
export const isHandStable = (currentLandmarks, previousLandmarks, threshold = 0.05) => {
  if (!previousLandmarks || previousLandmarks.length === 0) return false;
  
  let totalMovement = 0;
  
  for (let i = 0; i < currentLandmarks.length; i++) {
    const curr = currentLandmarks[i];
    const prev = previousLandmarks[i];
    
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const movement = Math.sqrt(dx * dx + dy * dy);
    
    totalMovement += movement;
  }
  
  const avgMovement = totalMovement / currentLandmarks.length;
  return avgMovement < threshold;
};

/**
 * Calculate hand bounding box
 */
export const getHandBoundingBox = (landmarks) => {
  const xCoords = landmarks.map(lm => lm.x);
  const yCoords = landmarks.map(lm => lm.y);
  
  return {
    minX: Math.min(...xCoords),
    maxX: Math.max(...xCoords),
    minY: Math.min(...yCoords),
    maxY: Math.max(...yCoords),
    width: Math.max(...xCoords) - Math.min(...xCoords),
    height: Math.max(...yCoords) - Math.min(...yCoords)
  };
};

/**
 * Check if hand is in frame center
 */
export const isHandCentered = (landmarks, tolerance = 0.3) => {
  const bbox = getHandBoundingBox(landmarks);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  
  const distFromCenterX = Math.abs(centerX - 0.5);
  const distFromCenterY = Math.abs(centerY - 0.5);
  
  return distFromCenterX < tolerance && distFromCenterY < tolerance;
};

/**
 * Compress landmarks for efficient transfer
 */
export const compressLandmarks = (landmarks, precision = 3) => {
  return landmarks.map(lm => ({
    x: parseFloat(lm.x.toFixed(precision)),
    y: parseFloat(lm.y.toFixed(precision)),
    z: parseFloat(lm.z.toFixed(precision))
  }));
};

/**
 * Calculate hand orientation (palm facing camera or not)
 */
export const getHandOrientation = (landmarks) => {
  // Use wrist (0) and middle finger base (9) to determine orientation
  const wrist = landmarks[0];
  const middleFinger = landmarks[9];
  
  // If z-difference is significant, hand is rotated
  const zDiff = Math.abs(wrist.z - middleFinger.z);
  
  return {
    palmFacing: zDiff < 0.1,
    rotation: zDiff
  };
};