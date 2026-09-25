export type GestureState = { x: number; y: number; force: number; shockX: number; shockY: number; shockAge: number; shockStrength: number };

export class PointerGestures {
  readonly state: GestureState = { x: 0, y: 0, force: 0, shockX: 0, shockY: 0, shockAge: 2, shockStrength: 0 };
  private lastTime = performance.now();

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', (event) => this.updatePointer(event));
    canvas.addEventListener('pointerdown', (event) => {
      this.updatePointer(event);
      this.state.shockX = this.state.x;
      this.state.shockY = this.state.y;
      this.state.shockAge = 0;
      this.state.shockStrength = 0.65;
    });
    canvas.addEventListener('dblclick', () => this.triggerShock(1));
    canvas.addEventListener('pointerleave', () => { this.state.force = 0; });
    window.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (event.code === 'Space' && target?.tagName !== 'INPUT' && target?.tagName !== 'SELECT' && target?.tagName !== 'BUTTON') {
        event.preventDefault();
        this.triggerShock(1.2);
      }
    });
  }

  tick(time: number): GestureState {
    const delta = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.state.force *= Math.pow(0.001, delta);
    this.state.shockAge += delta;
    this.state.shockStrength *= Math.pow(0.08, delta);
    return this.state;
  }

  private triggerShock(strength: number): void {
    this.state.shockX = this.state.x;
    this.state.shockY = this.state.y;
    this.state.shockAge = 0;
    this.state.shockStrength = strength;
  }

  private updatePointer(event: PointerEvent): void {
    const bounds = this.canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = 1 - (event.clientY - bounds.top) / bounds.height;
    this.state.x = x * 2 - 1;
    this.state.y = y * 2 - 1;
    this.state.force = Math.min(1, Math.hypot(event.movementX, event.movementY) / 24 + 0.14);
  }
}