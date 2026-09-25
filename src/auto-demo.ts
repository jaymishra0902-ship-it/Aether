export type DemoState = { enabled: number; phase: number; yaw: number; pitch: number; theme: number; pulse: number };

export class AutoDemo {
  readonly state: DemoState = { enabled: 0, phase: 0, yaw: 0, pitch: 0, theme: 0, pulse: 0 };

  toggle(): boolean {
    this.state.enabled = this.state.enabled > 0.5 ? 0 : 1;
    if (!this.state.enabled) this.state.phase = 0;
    return this.state.enabled > 0.5;
  }

  tick(delta: number): DemoState {
    if (!this.state.enabled) return this.state;
    this.state.phase += delta;
    const cycle = this.state.phase / 12;
    this.state.yaw = Math.sin(cycle * Math.PI * 2) * 0.45;
    this.state.pitch = Math.sin(cycle * Math.PI * 4) * 0.18;
    this.state.theme = Math.floor(this.state.phase / 6) % 4;
    this.state.pulse = Math.sin(this.state.phase * Math.PI * 2) * 0.5 + 0.5;
    return this.state;
  }
}