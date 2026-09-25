export type HudState = { density: number; distortion: number; theme: number; vortex: number; plasma: number; depth: number; shock: number; bloom: number; motion: number; vignette: number };

const themes: Record<string, number> = { bio: 0, cyberpunk: 1, space: 2, hyper: 3 };
export type HudActions = { enableMic: () => Promise<void>; disableMic: () => void; enableCamera: () => Promise<void>; disableCamera: () => void; loadTrack: (file: File) => Promise<void>; toggleDemo: () => boolean; snapshot: () => Promise<void>; record: () => void };

export class FieldHud {
  readonly state: HudState = { density: 0.68, distortion: 0.42, theme: 0, vortex: 1, plasma: 1, depth: 1, shock: 1, bloom: 1, motion: 1, vignette: 1 };
  private readonly micButton: HTMLButtonElement;

  constructor(private readonly actions: HudActions) {
    const density = this.getInput('density');
    const distortion = this.getInput('distortion');
    const theme = document.querySelector<HTMLSelectElement>('#theme');
    const micButton = document.querySelector<HTMLButtonElement>('#mic-button');
    const cameraButton = document.querySelector<HTMLButtonElement>('#camera-button');
    const snapshotButton = document.querySelector<HTMLButtonElement>('#snapshot-button');
    const recordButton = document.querySelector<HTMLButtonElement>('#record-button');
    const fileInput = document.querySelector<HTMLInputElement>('#audio-file');
    if (!theme || !micButton || !cameraButton || !snapshotButton || !recordButton || !fileInput) throw new Error('Field HUD controls are missing.');
    this.micButton = micButton;
    density.addEventListener('input', () => {
      this.state.density = Number(density.value);
      this.setOutput('density-value', `${Math.round(this.state.density * 100)}%`);
    });
    distortion.addEventListener('input', () => {
      this.state.distortion = Number(distortion.value);
      this.setOutput('distortion-value', `${Math.round(this.state.distortion * 100)}%`);
    });
    theme.addEventListener('change', () => { this.state.theme = themes[theme.value] ?? 0; });
    micButton.addEventListener('click', () => void this.toggleMicrophone(micButton));
    cameraButton.addEventListener('click', () => void this.toggleCamera(cameraButton));
    snapshotButton.addEventListener('click', () => void this.actions.snapshot());
    recordButton.addEventListener('click', () => this.actions.record());
    const effectToggles = ['vortex', 'plasma', 'depth', 'shock', 'bloom', 'motion', 'vignette'].map((id) => document.querySelector<HTMLInputElement>(`#${id}-toggle`));
    effectToggles.forEach((toggle, index) => toggle?.addEventListener('change', () => {
      const key = ['vortex', 'plasma', 'depth', 'shock', 'bloom', 'motion', 'vignette'][index] as 'vortex' | 'plasma' | 'depth' | 'shock' | 'bloom' | 'motion' | 'vignette';
      this.state[key] = toggle.checked ? 1 : 0;
    }));
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) void this.actions.loadTrack(file);
    });
    const demoToggle = document.querySelector<HTMLInputElement>('#demo-toggle');
    demoToggle?.addEventListener('change', () => { demoToggle.checked = this.actions.toggleDemo(); });
  }

  private async toggleMicrophone(button: HTMLButtonElement): Promise<void> {
    if (button.classList.contains('active')) {
      this.actions.disableMic();
      button.textContent = 'Mic Input [OFF]';
      button.classList.remove('active');
      button.classList.add('muted');
      return;
    }
    this.micButton.disabled = true;
    try {
      await this.actions.enableMic();
      this.micButton.textContent = 'Mic Input [ON]';
      this.micButton.classList.add('active');
      this.micButton.classList.remove('muted');
      this.micButton.disabled = false;
    } catch {
      this.micButton.disabled = false;
      this.micButton.textContent = 'Mic Input [OFF]';
      this.micButton.classList.add('muted');
    }
  }

  private async toggleCamera(button: HTMLButtonElement): Promise<void> {
    if (button.classList.contains('active')) {
      this.actions.disableCamera();
      button.textContent = 'Camera Gesture [OFF]';
      button.classList.remove('active');
      button.classList.add('muted');
      return;
    }
    button.disabled = true;
    try {
      await this.actions.enableCamera();
      button.textContent = 'Camera Gesture [ON]';
      button.classList.add('active');
      button.classList.remove('muted');
      button.disabled = false;
    } catch {
      button.disabled = false;
      button.textContent = 'Camera Gesture [OFF]';
      button.classList.add('muted');
    }
  }

  private getInput(id: string): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Missing HUD input: ${id}`);
    return input;
  }

  private setOutput(id: string, value: string): void {
    const output = document.querySelector<HTMLOutputElement>(`#${id}`);
    if (output) output.value = value;
  }
}