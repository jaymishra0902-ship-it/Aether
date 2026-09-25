export type CameraState = { yaw: number; pitch: number; yawVelocity: number; pitchVelocity: number };

export class CameraOrbit {
  readonly state: CameraState = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (event) => {
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      const deltaX = event.clientX - this.lastX;
      const deltaY = event.clientY - this.lastY;
      this.state.yawVelocity = deltaX * 0.006;
      this.state.pitchVelocity = deltaY * 0.004;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointercancel', () => { this.dragging = false; });
  }

  tick(delta: number): CameraState {
    this.state.yaw += this.state.yawVelocity;
    this.state.pitch = Math.max(-0.8, Math.min(0.8, this.state.pitch + this.state.pitchVelocity));
    const damping = Math.pow(0.025, delta);
    this.state.yawVelocity *= damping;
    this.state.pitchVelocity *= damping;
    return this.state;
  }
}