import shaderSource from './shaders/bio_compute.wgsl?raw';
import { AudioReactivity } from './audio';
import { AutoDemo } from './auto-demo';
import { CameraOrbit } from './camera-orbit';
import { FieldCapture } from './capture';
import { PointerGestures } from './gestures';
import { HandTracker } from './hand-tracker';
import { FieldHud } from './hud';
import { SingularityField } from './singularities';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#aether-canvas');
const status = document.querySelector<HTMLParagraphElement>('#status');
const signal = document.querySelector<HTMLElement>('#signal');

if (!canvas || !status || !signal) throw new Error('Aether-Omni UI failed to initialize.');

const canvasElement = canvas;
const statusElement = status;
const signalElement = signal;

const context = canvasElement.getContext('webgpu');
const audio = new AudioReactivity();
const gestures = new PointerGestures(canvasElement);
const camera = new CameraOrbit(canvasElement);
const demo = new AutoDemo();

async function startAetherField(): Promise<void> {
  if (!navigator.gpu || !context) {
    statusElement.textContent = 'WebGPU is unavailable in this browser.';
    signalElement.textContent = 'offline';
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    statusElement.textContent = 'No compatible WebGPU adapter found.';
    signalElement.textContent = 'offline';
    return;
  }

  const gpuContext = context as GPUCanvasContext;
  const devicePixelRatio = Math.min(window.devicePixelRatio, 2);
  const format = navigator.gpu.getPreferredCanvasFormat();
  const shaderModule = device.createShaderModule({ code: shaderSource });
  const compilationInfo = await shaderModule.getCompilationInfo();
  const shaderErrors = compilationInfo.messages.filter((message) => message.type === 'error');
  if (shaderErrors.length > 0) {
    throw new Error(`WGSL compilation failed: ${shaderErrors.map((message) => message.message).join(' | ')}`);
  }
  device.lost.then((info) => {
    statusElement.textContent = `WebGPU device lost: ${info.message || 'unknown reason'}`;
    console.error('WebGPU device lost', info);
  });
  device.pushErrorScope('validation');
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'vertexMain' },
    fragment: { module: shaderModule, entryPoint: 'fragmentMain', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const pipelineError = await device.popErrorScope();
  if (pipelineError) throw new Error(`WebGPU pipeline validation failed: ${pipelineError.message}`);
  const hand = new HandTracker();
  const singularities = new SingularityField(canvasElement);
  const uniforms = new Float32Array(60);
  const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const resize = (): void => {
    const width = Math.max(1, Math.floor(canvasElement.clientWidth * devicePixelRatio));
    const height = Math.max(1, Math.floor(canvasElement.clientHeight * devicePixelRatio));
    if (canvasElement.width !== width || canvasElement.height !== height) {
      canvasElement.width = width;
      canvasElement.height = height;
      gpuContext.configure({ device, format, alphaMode: 'premultiplied' });
    }
  };

  let hud: FieldHud;
  let lastTime = performance.now();

  const render = (time: number): void => {
    const audioMetrics = audio.sample();
    const gesture = gestures.tick(time);
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    const orbit = camera.tick(delta);
    const demoState = demo.tick(delta);
    const handState = hand.sample(time);
    hand.tick(delta);
    uniforms[0] = time / 1000;
    uniforms[1] = canvasElement.width;
    uniforms[2] = canvasElement.height;
    uniforms[3] = audioMetrics.bass;
    uniforms[4] = audioMetrics.mid;
    uniforms[5] = audioMetrics.treble;
    uniforms[6] = audioMetrics.volume;
    uniforms[7] = audioMetrics.pitch;
    uniforms[8] = hud.state.density;
    uniforms[9] = hud.state.distortion;
    uniforms[10] = demoState.enabled > 0.5 ? demoState.theme : hud.state.theme;
    uniforms[11] = gesture.x;
    uniforms[12] = gesture.y;
    uniforms[13] = Math.max(gesture.force, handState.force * handState.active);
    uniforms[14] = gesture.shockAge;
    uniforms[15] = gesture.shockX;
    uniforms[16] = gesture.shockY;
    uniforms[17] = gesture.shockStrength;
    uniforms[18] = handState.x;
    uniforms[19] = handState.y;
    uniforms[20] = handState.z;
    uniforms[21] = handState.force;
    uniforms[22] = handState.active;
    uniforms[23] = handState.shock;
    uniforms[24] = singularities.points.length;
    uniforms[25] = 0;
    uniforms[26] = 0;
    uniforms[27] = 0;
    singularities.writeTo(uniforms, 28);
    uniforms[44] = demoState.enabled > 0.5 ? demoState.yaw : orbit.yaw;
    uniforms[45] = demoState.enabled > 0.5 ? demoState.pitch : orbit.pitch;
    uniforms[46] = orbit.yawVelocity;
    uniforms[47] = orbit.pitchVelocity;
    uniforms[48] = hud.state.vortex;
    uniforms[49] = hud.state.plasma;
    uniforms[50] = hud.state.depth;
    uniforms[51] = hud.state.shock;
    uniforms[52] = hud.state.bloom;
    uniforms[53] = hud.state.motion;
    uniforms[54] = hud.state.vignette;
    uniforms[55] = demoState.enabled;
    uniforms[56] = demoState.pulse;
    uniforms[57] = 0;
    uniforms[58] = 0;
    uniforms[59] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: gpuContext.getCurrentTexture().createView(), clearValue: { r: 0.01, g: 0.02, b: 0.03, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    signalElement.textContent = `${Math.round(audioMetrics.volume * 100)}%`;
  };

  const capture = new FieldCapture(canvasElement, (width, height) => {
    canvasElement.width = width;
    canvasElement.height = height;
    gpuContext.configure({ device, format, alphaMode: 'premultiplied' });
    render(performance.now());
  }, (message) => { statusElement.textContent = message; });
  hud = new FieldHud({
    enableMic: () => audio.enable(),
    disableMic: () => audio.stop(),
    enableCamera: () => hand.enable(),
    disableCamera: () => hand.stop(),
    loadTrack: (file) => audio.loadFile(file),
    toggleDemo: () => demo.toggle(),
    snapshot: () => capture.snapshot(),
    record: () => capture.record(),
  });

  const frame = (time: number): void => {
    resize();
    render(time);
    requestAnimationFrame(frame);
  };

  statusElement.textContent = 'Bio-photonic field online.';
  signalElement.textContent = '50.0%';
  requestAnimationFrame(frame);
}

startAetherField().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  statusElement.textContent = `Field initialization failed: ${message}`;
  signalElement.textContent = 'error';
  console.error(error);
});