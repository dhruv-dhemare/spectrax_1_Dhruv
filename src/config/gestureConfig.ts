/**
 * Gesture Detection Configuration
 * Centralized settings for the gesture-based auto-start feature
 */

export const GESTURE_CONFIG = {
  // Countdown duration in milliseconds (3 seconds)
  countdownDuration: 3000,

  // Offset threshold for detecting if wrist is above shoulder (in normalized coordinates)
  wristShoulderOffset: 0.05,

  // Frame buffer size for smoothing hand-raised detection
  // Uses the last N frames to determine if both hands are consistently raised
  frameBuffer: 10,

  // Visibility threshold for joint detection (0-1 scale)
  // Joints with visibility below this are considered not visible
  visibilityThreshold: 0.5,

  // Confidence threshold for hand-raised gesture (0-1 scale)
  // Requires this much of the frame buffer to show hands raised
  handRaiseConfidenceThreshold: 0.7,
};
