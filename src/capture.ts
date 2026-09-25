export class FieldCapture {
  private recording = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly renderAtSize: (width: number, height: number) => void, private readonly setStatus: (message: string) => void) {}

  async snapshot(): Promise<void> {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const target = width / height >= 16 / 9 ? [3840, 2160] : [2160, 3840];
    this.renderAtSize(target[0], target[1]);
    await new Promise<void>((resolve) => {
      this.canvas.toBlob((blob) => {
        if (blob) this.download(blob, 'aether-omni-4k.png');
        resolve();
      }, 'image/png');
    });
    this.renderAtSize(width, height);
    this.setStatus('4K snapshot saved.');
  }

  record(): void {
    if (this.recording || !('MediaRecorder' in window)) return;
    const stream = this.canvas.captureStream(60);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 24_000_000 });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      this.download(new Blob(chunks, { type: 'video/webm' }), 'aether-omni-10s.webm');
      this.recording = false;
      this.setStatus('10-second recording saved.');
    };
    this.recording = true;
    recorder.start(250);
    this.setStatus('Recording 60 FPS field capture...');
    window.setTimeout(() => recorder.stop(), 10_000);
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}