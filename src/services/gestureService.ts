import { GESTURE_CONFIG } from '../config/gestureConfig';

export interface GestureResult {
  isHandRaised: boolean;
  confidence: number;
  leftWristAboveShoulder: boolean;
  rightWristAboveShoulder: boolean;
  isPoseLost: boolean;
}

class GestureService {
  private frameBuffer: boolean[] = [];

  private getJointVisibility(landmarks: any[], jointIndices: number[]): number {
    if (!landmarks) return 0;
    const visibilities = jointIndices
      .map(idx => landmarks[idx]?.visibility || 0)
      .filter(v => v > 0);
    return visibilities.length > 0 
      ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length 
      : 0;
  }

  private isJointAboveJoint(landmarks: any[], sourceIdx: number, targetIdx: number): boolean {
    const source = landmarks[sourceIdx];
    const target = landmarks[targetIdx];
    
    if (!source || !target) return false;
    if (source.visibility < GESTURE_CONFIG.visibilityThreshold || target.visibility < GESTURE_CONFIG.visibilityThreshold) {
      return false;
    }

    return source.y < target.y - GESTURE_CONFIG.wristShoulderOffset;
  }

  analyze(landmarks: any[]): GestureResult {
    if (!landmarks || landmarks.length < 33) {
      return {
        isHandRaised: false,
        confidence: 0,
        leftWristAboveShoulder: false,
        rightWristAboveShoulder: false,
        isPoseLost: true,
      };
    }

    const leftShoulderIdx = 11;
    const rightShoulderIdx = 12;
    const leftWristIdx = 15;
    const rightWristIdx = 16;
    const leftHipIdx = 23;
    const rightHipIdx = 24;

    const bodyVisibility = this.getJointVisibility(landmarks, [
      leftShoulderIdx,
      rightShoulderIdx,
      leftHipIdx,
      rightHipIdx,
    ]);

    if (bodyVisibility < GESTURE_CONFIG.visibilityThreshold) {
      return {
        isHandRaised: false,
        confidence: 0,
        leftWristAboveShoulder: false,
        rightWristAboveShoulder: false,
        isPoseLost: true,
      };
    }

    const leftWristAboveShoulder = this.isJointAboveJoint(
      landmarks,
      leftWristIdx,
      leftShoulderIdx
    );
    const rightWristAboveShoulder = this.isJointAboveJoint(
      landmarks,
      rightWristIdx,
      rightShoulderIdx
    );

    const bothHandsRaised = leftWristAboveShoulder && rightWristAboveShoulder;

    this.frameBuffer.push(bothHandsRaised);
    if (this.frameBuffer.length > GESTURE_CONFIG.frameBuffer) {
      this.frameBuffer.shift();
    }

    const raisedFrames = this.frameBuffer.filter(v => v).length;
    const confidence = raisedFrames / this.frameBuffer.length;

    return {
      isHandRaised: confidence >= GESTURE_CONFIG.handRaiseConfidenceThreshold,
      confidence,
      leftWristAboveShoulder,
      rightWristAboveShoulder,
      isPoseLost: false,
    };
  }

  reset(): void {
    this.frameBuffer = [];
  }
}

export const gestureService = new GestureService();
