// Vanilla-JS port of React-Bits <Lightning /> (by the original author).
// WebGL fragment shader that paints an animated lightning bolt.
// Usage: <canvas class="lightning-bg" data-hue="220" data-speed="1" data-intensity="1" data-size="1" data-xoffset="0"></canvas>
(function () {
  function mountLightning(canvas) {
    const hue       = parseFloat(canvas.dataset.hue       ?? '220');
    const xOffset   = parseFloat(canvas.dataset.xoffset   ?? '0');
    const speed     = parseFloat(canvas.dataset.speed     ?? '1');
    const intensity = parseFloat(canvas.dataset.intensity ?? '1');
    const size      = parseFloat(canvas.dataset.size      ?? '1');

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.floor(canvas.clientWidth  * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) { console.warn('Lightning: WebGL not supported'); return; }

    const vs = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;

    const fs = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uXOffset;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uSize;
      #define OCTAVE_COUNT 10
      vec3 hsv2rgb(vec3 c){ vec3 r=clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); return c.z*mix(vec3(1.0),r,c.y); }
      float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
      float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
      mat2 rotate2d(float t){ float c=cos(t),s=sin(t); return mat2(c,-s,s,c); }
      float noise(vec2 p){ vec2 ip=floor(p); vec2 fp=fract(p);
        float a=hash12(ip), b=hash12(ip+vec2(1.0,0.0)), c=hash12(ip+vec2(0.0,1.0)), d=hash12(ip+vec2(1.0,1.0));
        vec2 t=smoothstep(0.0,1.0,fp); return mix(mix(a,b,t.x),mix(c,d,t.x),t.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<OCTAVE_COUNT;++i){ v+=a*noise(p); p*=rotate2d(0.45); p*=2.0; a*=0.5; } return v; }
      void mainImage(out vec4 fragColor, in vec2 fragCoord){
        vec2 uv = fragCoord / iResolution.xy; uv = 2.0*uv - 1.0; uv.x *= iResolution.x/iResolution.y; uv.x += uXOffset;
        uv += 2.0 * fbm(uv*uSize + 0.8*iTime*uSpeed) - 1.0;
        float dist = abs(uv.x);
        vec3 base = hsv2rgb(vec3(uHue/360.0, 0.7, 0.8));
        vec3 col = base * pow(mix(0.0, 0.07, hash11(iTime*uSpeed)) / dist, 1.0) * uIntensity;
        col = pow(col, vec3(1.0));
        float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
        fragColor = vec4(col, a);
      }
      void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }
    `;

    const compile = (src, type) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Lightning shader compile error:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh); return null;
      }
      return sh;
    };
    const vsh = compile(vs, gl.VERTEX_SHADER);
    const fsh = compile(fs, gl.FRAGMENT_SHADER);
    if (!vsh || !fsh) return;

    const program = gl.createProgram();
    gl.attachShader(program, vsh); gl.attachShader(program, fsh); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Lightning link error:', gl.getProgramInfoLog(program)); return; }
    gl.useProgram(program);

    const verts = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'iResolution');
    const uTime = gl.getUniformLocation(program, 'iTime');
    const uHue = gl.getUniformLocation(program, 'uHue');
    const uX = gl.getUniformLocation(program, 'uXOffset');
    const uSp = gl.getUniformLocation(program, 'uSpeed');
    const uI = gl.getUniformLocation(program, 'uIntensity');
    const uSz = gl.getUniformLocation(program, 'uSize');

    const start = performance.now();
    let raf;
    const render = () => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform1f(uHue, hue);
      gl.uniform1f(uX, xOffset);
      gl.uniform1f(uSp, speed);
      gl.uniform1f(uI, intensity);
      gl.uniform1f(uSz, size);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };
    // pause when tab hidden to save battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(render);
    });
    raf = requestAnimationFrame(render);
  }

  document.querySelectorAll('canvas.lightning-bg').forEach(mountLightning);
})();
