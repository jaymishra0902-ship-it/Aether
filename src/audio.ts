export type AudioMetrics = { bass: number; mid: number; treble: number; volume: number; pitch: number };

export class AudioReactivity {
  private analyser?: AnalyserNode;
  private data?: Uint8Array<ArrayBuffer>;
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private fileSource?: MediaElementAudioSourceNode;
  private fileAudio?: HTMLAudioElement;
  private readonly smoothed: AudioMetrics = { bass: 0, mid: 0, treble: 0, volume: 0, pitch: 0 };

  async enable(): Promise<void> {
    if (this.analyser) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.78;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.source.connect(this.analyser);
    await this.context.resume();
  }

  async loadFile(file: File): Promise<void> {
    if (!file.type.startsWith('audio/')) throw new Error('Choose an MP3 or WAV audio file.');
    this.stop();
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.78;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.fileAudio = new Audio();
    this.fileAudio.src = URL.createObjectURL(file);
    this.fileAudio.loop = true;
    this.fileAudio.crossOrigin = 'anonymous';
    this.fileSource = this.context.createMediaElementSource(this.fileAudio);
    this.fileSource.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    await this.context.resume();
    await this.fileAudio.play();
  }

  sample(): AudioMetrics {
    if (!this.analyser || !this.data || !this.context) return this.smoothed;
    const analyser = this.analyser;
    const audioContext = this.context;
    analyser.getByteFrequencyData(this.data);
    const binWidth = audioContext.sampleRate / analyser.fftSize;
    const bassEnd = Math.max(1, Math.floor(180 / binWidth));
    const midEnd = Math.max(bassEnd + 1, Math.floor(2000 / binWidth));
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let energy = 0;
    let weightedFrequency = 0;
    for (let index = 1; index < this.data.length; index += 1) {
      const value = this.data[index] / 255;
      energy += value * value;
      weightedFrequency += value * index;
      if (index < bassEnd) bass += value;
      else if (index < midEnd) mid += value;
      else treble += value;
    }
    const volume = Math.min(1, Math.sqrt(energy / this.data.length) * 3.2);
    const pitch = Math.min(1, weightedFrequency / Math.max(energy * this.data.length, 1) * 2.4);
    const normalize = (value: number, count: number): number => Math.min(1, value / Math.max(count, 1) * 2.4);
    this.smooth('bass', normalize(bass, bassEnd));
    this.smooth('mid', normalize(mid, midEnd - bassEnd));
    this.smooth('treble', normalize(treble, this.data.length - midEnd));
    this.smooth('volume', volume);
    this.smooth('pitch', pitch);
    return this.smoothed;
  }

  stop(): void {
    this.source?.disconnect();
    this.fileSource?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.source = undefined;
    this.analyser = undefined;
    this.data = undefined;
    this.context = undefined;
    this.stream = undefined;
    if (this.fileAudio) {
      this.fileAudio.pause();
      URL.revokeObjectURL(this.fileAudio.src);
      this.fileAudio.removeAttribute('src');
      this.fileAudio.load();
    }
    this.fileAudio = undefined;
    this.fileSource = undefined;
    (Object.keys(this.smoothed) as Array<keyof AudioMetrics>).forEach((key) => { this.smoothed[key] = 0; });
  }

  private smooth(key: keyof AudioMetrics, value: number): void {
    this.smoothed[key] += (value - this.smoothed[key]) * 0.14;
  }
}