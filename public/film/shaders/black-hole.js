// Shared original Schwarzschild raytracer. Extracted unchanged from BlackHole.tsx.
export const vertex = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fragment = /* glsl */ `
  precision highp float;

  varying vec2 vNdc;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uCamDist;
  uniform float uCamY;
  uniform float uWarp;
  uniform float uBlack;
  uniform float uSteps;
  uniform vec2 uLook;
  uniform float uIris;
  uniform float uStreak;
  uniform float uHole;
  uniform float uFormation;
  uniform vec4 uRibs[4];

  #define DISK_IN 2.7
  #define DISK_OUT 9.5

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p = p * 2.03 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return v;
  }

  // Star field sampled by ray direction — two cell layers + faint nebula.
  // The field is a pure function of direction: the same sky greets every
  // visitor, and the loop closes on exactly the stars it opened with.
  vec3 stars(vec3 d, float density) {
    vec3 col = vec3(0.0);
    float cut = 0.982 - density * 0.014;
    for (int layer = 0; layer < 2; layer++) {
      float s = layer == 0 ? 55.0 : 110.0;
      vec3 cell = floor(d * s);
      vec3 f = fract(d * s) - 0.5;
      float h = hash13(cell);
      if (h > cut) {
        float star = smoothstep(0.5, 0.0, length(f));
        star = pow(star, 8.0);
        float tw = 0.75 + 0.25 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
        vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.75), fract(h * 7.0));
        col += star * tw * tint * (layer == 0 ? 1.0 : 0.45) * smoothstep(cut, 1.0, h) * 22.0;
      }
    }
    float neb = fbm(d.xy * 2.4 + d.z * 1.7 + vec2(3.1, 7.7));
    col += vec3(0.10, 0.12, 0.22) * pow(neb, 3.0) * 0.35;
    return col;
  }

  vec3 starsWarped(vec3 d) {
    if (uWarp < 0.02) return stars(d, 0.0);
    // radial streaking as space stretches during the fall
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float t = float(i) / 3.0;
      vec3 dd = normalize(d + vec3(0.0, 0.0, -1.0) * t * uWarp * 0.35);
      acc += stars(dd, 0.0);
    }
    return acc * 0.3;
  }

  // The Threshold's light-speed flight: every star smears along the great
  // circle toward the forward axis — streaks radiating from the centre of
  // frame, denser and longer with velocity. At uStreak = 0 this is exactly
  // stars(d): the hand-off to stillness is seamless by construction.
  vec3 streakField(vec3 d, vec3 fwd) {
    if(uStreak<.001)return stars(d,0.0);
    // Analytic shutter integration in the same directional starfield shader.
    // Continuous radial segments replace the old discrete multi-tap dotted trails.
    vec3 axis=abs(fwd.y)>.95?vec3(1.,0.,0.):vec3(0.,1.,0.);
    vec3 right=normalize(cross(fwd,axis)),up=cross(right,fwd);
    vec2 plane=vec2(dot(d,right),dot(d,up))/max(.025,dot(d,fwd));
    float radius=length(plane), angle=atan(plane.y,plane.x);
    float lane=floor((angle+3.14159265)*140.0);
    vec3 light=vec3(0.0);
    for(int k=-1;k<=1;k++) {
      float id=lane+float(k),h=hash13(vec3(id,17.0,31.0));
      float theta=(id+.2+h*.6)/140.0-3.14159265;
      float perpendicular=abs(sin(angle-theta))*radius;
      for(int layer=0;layer<3;layer++) {
        float seed=hash13(vec3(id,float(layer),73.0));
        float depth=fract(seed+uTime*(.055+uStreak*.19));
        float head=.10/(depth+.025),tail=head*(.1+uStreak*.66);
        float along=clamp((radius-head+tail)/max(tail,.001),0.,1.);
        float extent=smoothstep(head-tail,head-tail*.8,radius)*(1.-smoothstep(head,head+.012,radius));
        float width=.00055*(.4+head);
        float beam=exp(-perpendicular*perpendicular/(width*width))*extent*(.25+.75*along);
        light+=mix(vec3(.72,.81,1.),vec3(1.,.88,.67),h)*beam*(.45+uStreak*1.3);
      }
    }
    return light;
  }

  // Accretion disk sample at a plane-crossing point.
  vec3 disk(vec3 hit, vec3 rayDir) {
    float r = length(hit.xz);
    float radial = clamp((r - DISK_IN) / (DISK_OUT - DISK_IN), 0.0, 1.0);
    float angle = atan(hit.z, hit.x);

    // Keplerian shear: inner material laps the outer
    float phase = angle + uTime * 0.55 / pow(max(r, 1.0) / DISK_IN, 1.5);
    float bands = fbm(vec2(r * 2.6, phase * 3.2));
    float fine = fbm(vec2(r * 7.0 - uTime * 0.05, phase * 9.0));
    float density = smoothstep(0.0, 0.16, radial) * (1.0 - smoothstep(0.55, 1.0, radial));
    density *= 0.45 + 0.8 * bands + 0.25 * fine;

    // Temperature ramp: white-hot rim → amber → deep ember
    vec3 hot = vec3(1.35, 1.22, 1.05);
    vec3 warm = vec3(1.25, 0.62, 0.18);
    vec3 cool = vec3(0.45, 0.12, 0.03);
    vec3 c = mix(hot, warm, smoothstep(0.0, 0.42, radial));
    c = mix(c, cool, smoothstep(0.42, 1.0, radial));

    // Relativistic beaming: the side sweeping toward the camera burns brighter
    vec3 orbit = normalize(vec3(-hit.z, 0.0, hit.x));
    float beta = 0.42 / sqrt(max(r, 1.2));
    float dopp = 1.0 / max(1.0 - beta * dot(orbit, -normalize(rayDir)), 0.35);
    c *= pow(dopp, 3.0);
    c = mix(c, c * vec3(0.85, 0.92, 1.2), clamp((dopp - 1.0) * 1.4, 0.0, 0.55));

    // Gravitational redshift dims the innermost edge slightly
    c *= 0.35 + 0.65 * smoothstep(1.0, 3.4, r);
    return c * density * 2.4;
  }

  vec3 lensed(vec3 ro, vec3 rd) {
    // Conserved angular momentum of the photon (approximate geodesic)
    vec3 pos = ro;
    vec3 dir = rd;
    vec3 hv = cross(pos, dir);
    float h2 = dot(hv, hv);
    float bend = 1.5 + uWarp * 2.2;

    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool captured = false;

    for (int i = 0; i < 220; i++) {
      if (float(i) >= uSteps) break;
      float r2 = dot(pos, pos);
      float r = sqrt(r2);
      float dt = clamp(r * 0.11, 0.04, 0.75);

      dir += -bend * h2 * pos / (r2 * r2 * r) * dt;
      vec3 next = pos + dir * dt;

      // disk plane crossing
      if (pos.y * next.y < 0.0) {
        float t = pos.y / (pos.y - next.y);
        vec3 hit = mix(pos, next, t);
        float rr = length(hit.xz);
        if (rr > DISK_IN * 0.86 && rr < DISK_OUT) {
          col += disk(hit, dir) * trans;
          trans *= 0.32;
        }
      }

      pos = next;
      if (dot(pos, pos) < 1.0) { captured = true; break; }
      if (dot(pos, pos) > 4000.0 && dot(pos, dir) > 0.0) break;
    }

    if (!captured) {
      col += starsWarped(normalize(dir)) * trans;
    }
    return col;
  }

  void main() {
    // Full black is an authored hold, not a reason to integrate millions of rays.
    if (uBlack >= 0.99999 || uIris >= 0.99999) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
    vec2 uv = vNdc;
    uv.x *= uRes.x / uRes.y;

    // The iris: the lens itself closes. Each pixel looks further out, so the
    // whole image compresses radially into the centre of frame while the
    // field beyond a shrinking aperture goes dark.
    float irisEase = uIris * uIris;
    uv *= 1.0 + irisEase * 14.0;

    // Virtual camera: slightly above the disk plane, gentle handheld sway
    float sway = 1.0 - uWarp;
    vec3 ro = vec3(
      sin(uTime * 0.05) * 0.35 * sway,
      uCamY + sin(uTime * 0.083) * 0.12 * sway,
      uCamDist
    );
    // the weightless float: the view leans toward wherever the cursor rests
    ro.xy += uLook * vec2(1.2, 0.6) * sway;
    // shake as gravity takes hold
    ro.xy += (vec2(hash12(vec2(uTime * 31.7, 1.3)), hash12(vec2(uTime * 27.3, 9.2))) - 0.5)
             * 0.12 * uWarp;

    vec3 target = vec3(0.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    float fov = 0.62 + uWarp * 0.55;
    vec3 rd = normalize(fwd + uv.x * right * fov + uv.y * up * fov);

    vec3 col = vec3(0.0);
    if (uHole > 0.001) col += lensed(ro, rd) * uHole;
    if (uHole < 0.999) col += streakField(rd, fwd) * (1.0 - uHole);

    // During formation, the same directional star samples are transported onto
    // the projected bronze edges. Their radial trails straighten along each rib;
    // real geometry occupies those exact endpoints behind this field.
    if (uFormation > 0.0) {
      float closest = 100.0;
      vec2 at = vec2(0.0);
      for (int j = 0; j < 4; j++) {
        vec2 a = uRibs[j].xy, b = uRibs[j].zw;
        vec2 ab = b - a;
        float along = clamp(dot(vNdc - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
        vec2 point = a + ab * along;
        float distanceToRib = length(vNdc - point);
        if (distanceToRib < closest) { closest = distanceToRib; at = point; }
      }
      float width = 0.0045 + 0.045 * pow(1.0-uFormation,3.0);
      // Contract the source field into the rib, retaining its directional seed.
      vec2 transported = at + (vNdc - at) / max(0.005, 1.0 - uFormation);
      vec3 source = normalize(fwd + transported.x * right * fov + transported.y * up * fov);
      float gather = exp(-closest * closest / max(width * width, 0.000001));
      vec3 gathered = streakField(source, normalize(mix(fwd, up, uFormation * 0.94)));
      // The source samples compress into the projected arm, then broaden into its
      // amber emissive shell. No stationary starfield survives deceleration.
      vec3 shell = mix(vec3(1.0), vec3(1.0,0.46,0.12),uFormation)*2.6*gather;
      col = col * pow(1.0-uFormation,3.0) + gathered*gather*(1.0-uFormation) + shell*uFormation;
    }
    // Linear HDR leaves the original geodesic and disk math intact. The shared
    // bloom/ACES chain owns grading, avoiding a second in-shader tone map.
    float vig = 1.0 - 0.32 * dot(vNdc * 0.72, vNdc * 0.72);
    col *= vig;

    // the aperture closing to a point
    float irisR = mix(1.7, 0.0, uIris);
    float aperture = uIris >= 0.99999 ? 0.0 : 1.0 - smoothstep(irisR * 0.7, max(irisR, 0.00001), length(vNdc) + 0.002);
    col *= mix(1.0, aperture, step(0.0005, uIris));

    col = mix(col, vec3(0.0), uBlack);
    gl_FragColor = vec4(col, 1.0);
  }
`;

