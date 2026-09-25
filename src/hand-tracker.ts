import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export type HandState = { active: number; x: number; y: number; z: number; force: number; shock: number };

export class HandTracker {
  readonly state: HandState = { active: 0, x: 0, y: 0, z: 0, force: 0, shock: 2 };
  private readonly video = document.createElement('video');
  private tracker?: HandLandmarker;
  private stream?: MediaStream;
  private lastDetection = 0;
  private lastX = 0;
  private lastY = 0;

  async enable(): Promise<void> {
    if (this.tracker) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play();
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
    this.tracker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }

  sample(time: number): HandState {
    if (!this.tracker || this.video.readyState < 2 || time - this.lastDetection < 50) return this.state;
    this.lastDetection = time;
    const result = this.tracker.detectForVideo(this.video, time);
    const landmark = result.landmarks[0]?.[9];
    if (!landmark) {
      this.state.active *= 0.94;
      this.state.force *= 0.9;
      return this.state;
    }
    const x = (1 - landmark.x) * 2 - 1;
    const y = (1 - landmark.y) * 2 - 1;
    const movement = Math.hypot(x - this.lastX, y - this.lastY);
    this.state.active += (1 - this.state.active) * 0.3;
    this.state.x += (x - this.state.x) * 0.28;
    this.state.y += (y - this.state.y) * 0.28;
    this.state.z += ((1 - landmark.z * 4) - this.state.z) * 0.2;
    this.state.force = Math.min(1, movement * 4 + 0.12);
    if (movement > 0.12) this.state.shock = 0;
    this.lastX = x;
    this.lastY = y;
    return this.state;
  }

  tick(delta: number): void {
    this.state.shock += delta;
    this.state.force *= Math.pow(0.001, delta);
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.tracker?.close();
    this.video.pause();
    this.video.srcObject = null;
    this.stream = undefined;
    this.tracker = undefined;
    this.lastDetection = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.state.x = 0;
    this.state.y = 0;
    this.state.z = 0;
    this.state.shock = 2;
    this.state.active = 0;
    this.state.force = 0;
  }
}