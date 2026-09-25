struct FrameUniforms {
  time: f32,
  width: f32,
  height: f32,
  bass: f32,
  mid: f32,
  treble: f32,
  audioVolume: f32,
  pitch: f32,
  density: f32,
  distortion: f32,
  theme: f32,
  pointerX: f32,
  pointerY: f32,
  attraction: f32,
  shockAge: f32,
  shockX: f32,
  shockY: f32,
  shockStrength: f32,
  handX: f32,
  handY: f32,
  handZ: f32,
  handForce: f32,
  handActive: f32,
  handShock: f32,
  singularityCount: f32,
  padding0: f32,
  padding1: f32,
  padding2: f32,
  singularity0: vec4f,
  singularity1: vec4f,
  singularity2: vec4f,
  singularity3: vec4f,
  cameraYaw: f32,
  cameraPitch: f32,
  cameraYawVelocity: f32,
  cameraPitchVelocity: f32,
  vortexEnabled: f32,
  plasmaEnabled: f32,
  depthEnabled: f32,
  shockEnabled: f32,
  bloomEnabled: f32,
  motionEnabled: f32,
  vignetteEnabled: f32,
  demoEnabled: f32,
  demoPulse: f32,
  padding4: f32,
  padding5: f32,
  padding6: f32,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  let position = positions[index];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * 0.5 + 0.5;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let aspect = frame.width / max(frame.height, 1.0);
  var centered = (input.uv - 0.5) * vec2f(aspect, 1.0);
  let pointer = vec2f(frame.pointerX * aspect, frame.pointerY);
  let hand = vec2f(frame.handX * aspect, frame.handY);
  let pointerDistance = distance(centered, pointer);
  let handDistance = distance(centered, hand);
  let pointerPull = exp(-pointerDistance * 5.0) * frame.attraction * 0.11;
  let handPull = exp(-handDistance * 4.0) * frame.handForce * frame.handActive * (0.08 + frame.handZ * 0.04);
  centered += normalize(pointer - centered + vec2f(0.0001)) * pointerPull;
  centered += normalize(hand - centered + vec2f(0.0001)) * handPull;
  let shockDistance = distance(centered, vec2f(frame.shockX * aspect, frame.shockY));
  let pointerShock = exp(-abs(shockDistance - frame.shockAge * 0.55) * 32.0) * max(0.0, 1.0 - frame.shockAge * 0.8);
  let handShockDistance = distance(centered, hand);
  let handShock = exp(-abs(handShockDistance - frame.handShock * 0.55) * 32.0) * max(0.0, 1.0 - frame.handShock * 0.8) * frame.handActive;
  let shockRadius = frame.shockAge * (0.72 + frame.shockStrength * 0.5);
  let shockBurst = exp(-abs(shockDistance - shockRadius) * 38.0) * max(0.0, 1.0 - frame.shockAge * 0.72) * frame.shockStrength * frame.shockEnabled;
  var singularities = array<vec4f, 4>(frame.singularity0, frame.singularity1, frame.singularity2, frame.singularity3);
  var singularityPull = 0.0;
  var orbital = 0.0;
  for (var singularityIndex = 0; singularityIndex < 4; singularityIndex++) {
    let singularity = singularities[singularityIndex];
    let delta = vec2f(singularity.x * aspect, singularity.y) - centered;
    let distanceToMass = max(length(delta), 0.035);
    let influence = singularity.z * step(f32(singularityIndex), frame.singularityCount - 0.5) / (distanceToMass * 12.0);
    singularityPull += influence;
    orbital += dot(normalize(delta + vec2f(0.0001)), vec2f(-delta.y, delta.x)) * singularity.w * influence;
  }
  let vortexRadius = length(centered);
  let vortexPull = exp(-vortexRadius * 4.0) * frame.bass * frame.vortexEnabled * 0.09;
  let vortexAngle = frame.time * (0.8 + frame.bass * 2.4);
  centered += vec2f(cos(vortexAngle), sin(vortexAngle)) * vortexPull;
  centered += normalize(pointer - centered + vec2f(0.0001)) * singularityPull * 0.018;
  let cameraRotation = frame.cameraYaw + sin(frame.time * 2.0) * frame.cameraYawVelocity * 0.16;
  let rotated = vec2f(cos(cameraRotation) * centered.x - sin(cameraRotation) * centered.y, sin(cameraRotation) * centered.x + cos(cameraRotation) * centered.y);
  centered = vec2f(rotated.x, rotated.y + frame.cameraPitch * centered.x * 0.18);
  var field = vec3f(0.0);
  for (var index = 1; index < 480; index++) {
    let particle = f32(index) / 480.0;
    let band = select(select(frame.treble, frame.mid, particle > 0.34), frame.bass, particle < 0.18);
    let orbit = particle * 6.283 + frame.time * (0.18 + frame.pitch * 0.7 + band * 0.9) + orbital * 0.4 + sin(particle * 31.0) * frame.distortion;
    let radius = 0.08 + particle * 0.45 + sin(frame.time + particle * 17.0) * frame.distortion * 0.035 + band * 0.03;
    let position = vec2f(cos(orbit), sin(orbit)) * radius;
    let particleDistance = distance(centered, position + pointer * frame.attraction * particle * 0.08);
    let depthScale = 1.0 + (1.0 - particle) * 0.8;
    let dynamicSize = (0.008 + frame.audioVolume * 0.018 + band * 0.014 + frame.bass * frame.vortexEnabled * 0.01) * depthScale;
    let particleGlow = smoothstep(dynamicSize, 0.0, particleDistance);
    field += particleGlow * (0.35 + particle) * step(particle, frame.density);
    if (frame.plasmaEnabled > 0.5 && (frame.mid + frame.treble) > 0.28) {
      let nextParticle = particle + 0.055;
      let nextOrbit = nextParticle * 6.283 + frame.time * (0.18 + frame.pitch * 0.7 + band * 0.9);
      let nextPosition = vec2f(cos(nextOrbit), sin(nextOrbit)) * (0.08 + nextParticle * 0.45);
      let lineDistance = abs((centered.x - position.x) * (nextPosition.y - position.y) - (centered.y - position.y) * (nextPosition.x - position.x)) / max(distance(position, nextPosition), 0.001);
      field += vec3f(0.6, 0.9, 1.0) * smoothstep(0.012, 0.0, lineDistance) * (frame.mid + frame.treble) * 0.22;
    }
  }
  var dust = 0.0;
  for (var dustIndex = 1; dustIndex < 72; dustIndex++) {
    let dustParticle = f32(dustIndex) / 72.0;
    let dustAngle = dustParticle * 71.0 + frame.time * (0.018 + dustParticle * 0.025);
    let dustRadius = 0.56 + fract(sin(dustParticle * 91.7) * 43758.5) * 0.48;
    let dustDepth = sin(dustParticle * 37.0 + frame.time * 0.06) * 0.12;
    let dustPosition = vec2f(cos(dustAngle) * dustRadius, sin(dustAngle) * dustRadius + dustDepth);
    let dustSize = 0.003 + fract(sin(dustParticle * 19.3) * 129.1) * 0.005;
    let dustGlow = smoothstep(dustSize, 0.0, distance(centered, dustPosition));
    dust += dustGlow * (0.18 + dustParticle * 0.22) * (1.0 - frame.audioVolume * 0.18);
  }
  let coreRadius = 0.24 + frame.audioVolume * 0.04 + frame.bass * frame.vortexEnabled * 0.025;
  let ringDistance = abs(length(centered) - coreRadius);
  let ring = smoothstep(0.12, 0.0, ringDistance);
  let demoWave = select(0.0, sin(frame.time * 3.5 + sin(frame.time * 0.7) * 2.0) * 0.5 + 0.5, frame.demoEnabled > 0.5);
  let bassPulse = 0.78 + frame.bass * (1.5 + sin(frame.time * 8.0) * 0.35) + demoWave * 0.28;
  let innerBloom = exp(-length(centered) * 7.5) * (0.7 + frame.audioVolume * 2.8) * bassPulse;
  let volumetricBloom = exp(-ringDistance * 18.0) * (0.9 + frame.bass * 2.6) * frame.vortexEnabled * frame.bloomEnabled;
  let bloomHalo = exp(-ringDistance * 5.0) * (0.35 + frame.mid * 1.4) * frame.vortexEnabled * frame.bloomEnabled;
  let bio = vec3f(0.08, 0.8, 0.58);
  let cyberpunk = vec3f(0.95, 0.12, 0.55);
  let deepSpace = vec3f(0.18, 0.3, 0.95);
  let hyperVoid = vec3f(0.65, 0.18, 1.0);
  let themeColor = select(select(select(bio, cyberpunk, frame.theme > 0.5), deepSpace, frame.theme > 1.5), hyperVoid, frame.theme > 2.5);
  let depth = smoothstep(0.78, 0.12, length(centered)) * frame.depthEnabled;
  let motionBlur = 1.0 + length(vec2f(frame.cameraYawVelocity, frame.cameraPitchVelocity)) * 2.5 * frame.motionEnabled;
  let core = ring * (0.8 + frame.audioVolume * 2.4) + innerBloom + volumetricBloom + bloomHalo;
  let plasmaTint = vec3f(0.22, 0.95, 1.0);
  let vignette = mix(1.0, smoothstep(1.2, 0.28, length(centered)), frame.vignetteEnabled);
  let color = themeColor * (field + core + (pointerShock + handShock + shockBurst) * 0.7) * (0.72 + depth * 0.5) * motionBlur * vignette + plasmaTint * field * (frame.mid + frame.treble) * 0.18 + vec3f(0.005, 0.012, 0.02) + vec3f(0.035, 0.08, 0.09) * dust;
  return vec4f(color, 1.0);
}