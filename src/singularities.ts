export type Singularity = { x: number; y: number; mass: number; spin: number };

export class SingularityField {
  readonly points: Singularity[] = [];

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const y = (1 - (event.clientY - bounds.top) / bounds.height) * 2 - 1;
      this.points.push({ x, y, mass: 0.72, spin: event.shiftKey ? -1 : 1 });
      if (this.points.length > 4) this.points.shift();
    });
  }

  writeTo(target: Float32Array, offset: number): void {
    for (let index = 0; index < 4; index += 1) {
      const point = this.points[index];
      target[offset + index * 4] = point?.x ?? 0;
      target[offset + index * 4 + 1] = point?.y ?? 0;
      target[offset + index * 4 + 2] = point?.mass ?? 0;
      target[offset + index * 4 + 3] = point?.spin ?? 0;
    }
  }
}