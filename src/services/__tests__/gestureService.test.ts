/**
 * Unit Tests for Gesture Detection Service
 * 
 * Tests the gesture-based auto-start feature under various scenarios:
 * - Both hands raised detection
 * - Single hand raised detection
 * - Hands dropped during countdown
 * - Pose lost during countdown
 */

import { gestureService } from '../gestureService';
import { GESTURE_CONFIG } from '../../config/gestureConfig';

// Mock pose landmarks with full body skeleton (33 landmarks from MediaPipe Pose)
const createMockLandmarks = (overrides: any = {}) => {
  const landmarks = Array(33).fill(null).map((_, i) => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  // Key joint indices (from MediaPipe Pose):
  // 11: Left Shoulder, 12: Right Shoulder
  // 15: Left Wrist, 16: Right Wrist
  // 23: Left Hip, 24: Right Hip

  // Apply overrides
  if (overrides.leftShoulderY !== undefined) {
    landmarks[11].y = overrides.leftShoulderY;
  }
  if (overrides.rightShoulderY !== undefined) {
    landmarks[12].y = overrides.rightShoulderY;
  }
  if (overrides.leftWristY !== undefined) {
    landmarks[15].y = overrides.leftWristY;
  }
  if (overrides.rightWristY !== undefined) {
    landmarks[16].y = overrides.rightWristY;
  }
  if (overrides.bodyVisibility !== undefined) {
    landmarks[11].visibility = overrides.bodyVisibility;
    landmarks[12].visibility = overrides.bodyVisibility;
    landmarks[23].visibility = overrides.bodyVisibility;
    landmarks[24].visibility = overrides.bodyVisibility;
  }
  if (overrides.leftWristVisibility !== undefined) {
    landmarks[15].visibility = overrides.leftWristVisibility;
  }
  if (overrides.rightWristVisibility !== undefined) {
    landmarks[16].visibility = overrides.rightWristVisibility;
  }

  return landmarks;
};

describe('GestureService - Gesture Detection', () => {
  beforeEach(() => {
    gestureService.reset();
  });

  describe('Both Hands Raised Detection', () => {
    it('should detect when both hands are raised above shoulders', () => {
      // Shoulders at y=0.5, wrists at y=0.4 (above shoulders)
      const landmarks = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.4,
        rightWristY: 0.4,
      });

      // Need to feed enough frames to meet confidence threshold
      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarks);
      }

      expect(result!.isHandRaised).toBe(true);
      expect(result!.leftWristAboveShoulder).toBe(true);
      expect(result!.rightWristAboveShoulder).toBe(true);
      expect(result!.isPoseLost).toBe(false);
      expect(result!.confidence).toBeGreaterThanOrEqual(GESTURE_CONFIG.handRaiseConfidenceThreshold);
    });

    it('should have high confidence when both hands consistently raised', () => {
      const landmarks = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.3,
        rightWristY: 0.3,
      });

      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer + 5; i++) {
        result = gestureService.analyze(landmarks);
      }

      expect(result!.confidence).toBe(1.0);
      expect(result!.isHandRaised).toBe(true);
    });
  });

  describe('One Hand Raised Detection', () => {
    it('should NOT trigger when only left hand is raised', () => {
      const landmarks = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.3,  // Above shoulder
        rightWristY: 0.6,  // Below shoulder
      });

      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarks);
      }

      expect(result!.isHandRaised).toBe(false);
      expect(result!.leftWristAboveShoulder).toBe(true);
      expect(result!.rightWristAboveShoulder).toBe(false);
    });

    it('should NOT trigger when only right hand is raised', () => {
      const landmarks = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.6,  // Below shoulder
        rightWristY: 0.3,  // Above shoulder
      });

      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarks);
      }

      expect(result!.isHandRaised).toBe(false);
      expect(result!.leftWristAboveShoulder).toBe(false);
      expect(result!.rightWristAboveShoulder).toBe(true);
    });
  });

  describe('Hands Dropped During Countdown', () => {
    it('should detect when hands are dropped mid-gesture', () => {
      const landmarksRaised = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.3,
        rightWristY: 0.3,
      });

      const landmarksDropped = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.7,  // Dropped below shoulders
        rightWristY: 0.7,
      });

      // Build up confidence with hands raised
      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksRaised);
      }

      expect(result!.isHandRaised).toBe(true);
      expect(result!.confidence).toBe(1.0);

      // Now drop hands and feed frames
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksDropped);
      }

      expect(result!.isHandRaised).toBe(false);
      expect(result!.confidence).toBe(0);
    });

    it('should gradually lose confidence as hands are dropped', () => {
      const landmarksRaised = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.3,
        rightWristY: 0.3,
      });

      const landmarksDropped = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.7,
        rightWristY: 0.7,
      });

      // Build up confidence
      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksRaised);
      }
      const initialConfidence = result!.confidence;

      // Drop hands partially
      for (let i = 0; i < Math.floor(GESTURE_CONFIG.frameBuffer / 2); i++) {
        result = gestureService.analyze(landmarksDropped);
      }
      const midConfidence = result!.confidence;

      // Drop hands completely
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksDropped);
      }
      const finalConfidence = result!.confidence;

      expect(initialConfidence).toBe(1.0);
      expect(midConfidence).toBeLessThan(initialConfidence);
      expect(finalConfidence).toBe(0);
    });
  });

  describe('Pose Lost During Countdown', () => {
    it('should detect pose loss when body visibility drops', () => {
      const landmarksPosePresent = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.3,
        rightWristY: 0.3,
        bodyVisibility: 0.9,
      });

      const landmarksPoseLost = createMockLandmarks({
        leftShoulderY: 0.5,
        rightShoulderY: 0.5,
        leftWristY: 0.3,
        rightWristY: 0.3,
        bodyVisibility: 0.2,  // Below threshold
      });

      // Build up confidence with good pose
      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksPosePresent);
      }
      expect(result!.isPoseLost).toBe(false);

      // Lose pose
      result = gestureService.analyze(landmarksPoseLost);
      expect(result!.isPoseLost).toBe(true);
      expect(result!.isHandRaised).toBe(false);
    });

    it('should handle intermittent pose loss', () => {
      const landmarksPosePresent = createMockLandmarks({
        bodyVisibility: 0.9,
        leftWristY: 0.3,
        rightWristY: 0.3,
      });

      const landmarksPoseLost = createMockLandmarks({
        bodyVisibility: 0.2,
        leftWristY: 0.3,
        rightWristY: 0.3,
      });

      let result;

      // Pose present → detected as pose lost → pose present
      for (let i = 0; i < 3; i++) {
        result = gestureService.analyze(landmarksPosePresent);
      }
      expect(result!.isPoseLost).toBe(false);

      result = gestureService.analyze(landmarksPoseLost);
      expect(result!.isPoseLost).toBe(true);

      result = gestureService.analyze(landmarksPosePresent);
      expect(result!.isPoseLost).toBe(false);
    });

    it('should reset hand-raised when wrist visibility is lost', () => {
      const landmarksValid = createMockLandmarks({
        leftWristY: 0.3,
        rightWristY: 0.3,
        leftWristVisibility: 0.9,
        rightWristVisibility: 0.9,
      });

      const landmarksWristLost = createMockLandmarks({
        leftWristY: 0.3,
        rightWristY: 0.3,
        leftWristVisibility: 0.2,  // Below threshold
        rightWristVisibility: 0.2,
      });

      // Build confidence
      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksValid);
      }
      expect(result!.isHandRaised).toBe(true);

      // Lose wrist visibility
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksWristLost);
      }
      expect(result!.isHandRaised).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null or empty landmarks', () => {
      const result = gestureService.analyze(null as any);
      expect(result.isHandRaised).toBe(false);
      expect(result.isPoseLost).toBe(true);
    });

    it('should handle landmarks with insufficient data', () => {
      const result = gestureService.analyze([]);
      expect(result.isHandRaised).toBe(false);
      expect(result.isPoseLost).toBe(true);
    });

    it('should reset frame buffer on reset()', () => {
      const landmarks = createMockLandmarks({
        leftWristY: 0.3,
        rightWristY: 0.3,
      });

      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarks);
      }
      expect(result!.confidence).toBe(1.0);

      gestureService.reset();

      result = gestureService.analyze(
        createMockLandmarks({
          leftWristY: 0.7,
          rightWristY: 0.7,
        })
      );
      expect(result!.confidence).toBe(0);
    });

    it('should respect GESTURE_CONFIG values', () => {
      const landmarks = createMockLandmarks({
        leftWristY: 0.45,  // Slightly above shoulder (0.5) + offset
        rightWristY: 0.45,
      });

      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer - 1; i++) {
        result = gestureService.analyze(landmarks);
      }
      
      // Below confidence threshold
      expect(result!.confidence).toBeLessThan(GESTURE_CONFIG.handRaiseConfidenceThreshold);

      // One more frame to reach threshold
      result = gestureService.analyze(landmarks);
      expect(result!.confidence).toBeGreaterThanOrEqual(GESTURE_CONFIG.handRaiseConfidenceThreshold);
    });
  });

  describe('Low-Light Conditions Simulation', () => {
    it('should handle low visibility in low-light conditions', () => {
      const landmarksLowLight = createMockLandmarks({
        leftWristY: 0.3,
        rightWristY: 0.3,
        bodyVisibility: 0.6,  // Reduced visibility
        leftWristVisibility: 0.65,
        rightWristVisibility: 0.65,
      });

      let result;
      for (let i = 0; i < GESTURE_CONFIG.frameBuffer; i++) {
        result = gestureService.analyze(landmarksLowLight);
      }

      // Should still work with reduced visibility
      expect(result!.isHandRaised).toBe(true);
      expect(result!.isPoseLost).toBe(false);
    });

    it('should fail gracefully in very poor lighting (low visibility)', () => {
      const landmarksVeryPoorLight = createMockLandmarks({
        leftWristY: 0.3,
        rightWristY: 0.3,
        bodyVisibility: 0.4,  // Below threshold
      });

      const result = gestureService.analyze(landmarksVeryPoorLight);

      // Should detect pose loss
      expect(result.isPoseLost).toBe(true);
      expect(result.isHandRaised).toBe(false);
    });
  });
});
