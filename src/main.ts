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

const audio = new AudioReactivity();
const gestures = new PointerGestures(canvasElement);
const camera = new CameraOrbit(canvasElement);
const demo = new AutoDemo();

function supportsWebGPU(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu && typeof navigator.gpu.requestAdapter === 'function';
}

function setFallbackStatus(mode: 'WebGL' | '2D Canvas'): void {
  if (mode === 'WebGL') {
    statusElement.textContent = 'WebGL mode';
    signalElement.textContent = 'webgl';
  } else {
    statusElement.textContent = '2D Canvas mode';
    signalElement.textContent = 'canvas';
  }
}

function start2DParticleFallback(): void {
  const ctx = canvasElement.getContext('2d');
  if (!ctx) {
    statusElement.textContent = 'Canvas fallback unavailable';
    signalElement.textContent = 'offline';
    return;
  }

  setFallbackStatus('2D Canvas');
  const particles = Array.from({ length: 160 }, (_, index) => ({
    x: Math.random() * canvasElement.width,
    y: Math.random() * canvasElement.height,
    radius: 1 + Math.random() * 2.8,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    hue: 180 + index * 0.8,
  }));

  const tick = (time: number): void => {
    const width = canvasElement.width || 1;
    const height = canvasElement.height || 1;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    gradient.addColorStop(0, 'rgba(20, 36, 58, 0.9)');
    gradient.addColorStop(1, 'rgba(2, 4, 9, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const particle of particles) {
      particle.x += particle.vx * 2.2;
      particle.y += particle.vy * 2.2;
      if (particle.x < 0 || particle.x > width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > height) particle.vy *= -1;

      const alpha = 0.35 + Math.sin(time * 0.002 + particle.hue) * 0.2;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${particle.hue}, 90%, 65%, ${alpha})`;
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function startWebGLParticleFallback(): boolean {
  const gl = canvasElement.getContext('webgl', {
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance',
  });

  if (!gl) {
    start2DParticleFallback();
    return false;
  }

  setFallbackStatus('WebGL');

  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec4 a_color;
    uniform vec2 u_resolution;
    varying vec4 v_color;
    void main() {
      vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
      clip.y *= -1.0;
      gl_Position = vec4(clip, 0.0, 1.0);
      gl_PointSize = 4.0;
      v_color = a_color;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec4 v_color;
    void main() {
      vec2 delta = gl_PointCoord - vec2(0.5, 0.5);
      float dist = dot(delta, delta);
      float alpha = 1.0 - smoothstep(0.18, 0.5, dist);
      gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
    }
  `;

  const compileShader = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    start2DParticleFallback();
    return false;
  }

  const program = gl.createProgram();
  if (!program) {
    start2DParticleFallback();
    return false;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    start2DParticleFallback();
    return false;
  }

  const particleCount = 180;
  const particleData = new Float32Array(particleCount * 6);
  const particleBuffer = gl.createBuffer();
  if (!particleBuffer) {
    start2DParticleFallback();
    return false;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const colorLocation = gl.getAttribLocation(program, 'a_color');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

  if (positionLocation < 0 || colorLocation < 0 || !resolutionLocation) {
    start2DParticleFallback();
    return false;
  }

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 24, 8);

  const render = (time: number): void => {
    const width = canvasElement.width || 1;
    const height = canvasElement.height || 1;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.03, 0.05, 0.09, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (let i = 0; i < particleCount; i += 1) {
      const index = i * 6;
      const orbit = (time * 0.0004) + i * 0.45;
      const radius = 48 + (i % 28) * 10 + Math.sin(time * 0.001 + i) * 18;
      const x = width * 0.5 + Math.cos(orbit * 2.4) * radius + Math.sin(time * 0.0009 + i) * 28;
      const y = height * 0.5 + Math.sin(orbit * 1.7 + i) * radius * 0.68;
      const hue = 180 + (i * 4.2) % 120;
      const r = 0.25 + ((hue + 30) % 90) / 180;
      const g = 0.5 + Math.sin(time * 0.001 + i) * 0.25;
      const b = 0.9;
      particleData[index] = x;
      particleData[index + 1] = y;
      particleData[index + 2] = r;
      particleData[index + 3] = g;
      particleData[index + 4] = b;
      particleData[index + 5] = 0.55 + (Math.sin(time * 0.003 + i) + 1) * 0.2;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);
    gl.uniform2f(resolutionLocation, width, height);
    gl.drawArrays(gl.POINTS, 0, particleCount);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
  return true;
}

function startFallbackRenderer(): void {
  if (!supportsWebGPU()) {
    startWebGLParticleFallback();
    return;
  }

  try {
    const webgpuContext = canvasElement.getContext('webgpu');
    if (!webgpuContext) {
      startWebGLParticleFallback();
      return;
    }
  } catch {
    startWebGLParticleFallback();
  }
}

async function startAetherField(): Promise<void> {
  if (!supportsWebGPU()) {
    startFallbackRenderer();
    return;
  }

  try {
    const webgpuContext = canvasElement.getContext('webgpu');
    if (!webgpuContext) {
      startFallbackRenderer();
      return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
      throw new Error('No compatible WebGPU adapter found.');
    }

    const gpuContext = webgpuContext as GPUCanvasContext;
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
  } catch (error) {
    console.warn('WebGPU failed, falling back to WebGL particle renderer.', error);
    startFallbackRenderer();
  }
}

startAetherField().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.warn('Field initialization failed, activating fallback renderer.', message);
  startFallbackRenderer();
});