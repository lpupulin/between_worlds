document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl');
  let width, height;
  const resize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    gl.viewport(0, 0, width, height);
  };
  resize();
  window.addEventListener('resize', resize);

  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_time;

    float drawSmoke(vec2 st, vec2 pos, float time) {
      float d = distance(st, pos);
      return exp(-10.0 * d) * (0.5 + 0.5 * sin(time * 3.0));
    }

    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution;
      vec2 mouse = u_mouse / u_resolution;
      float color = drawSmoke(st, mouse, u_time);
      gl_FragColor = vec4(vec3(color), color);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    const vShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
  const timeLocation = gl.getUniformLocation(program, 'u_time');

  let mouse = [width / 2, height / 2];
  canvas.addEventListener('mousemove', e => {
    mouse = [e.clientX, height - e.clientY];
  });

  let startTime = performance.now();
  function render() {
    let now = performance.now();
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform2f(mouseLocation, mouse[0], mouse[1]);
    gl.uniform1f(timeLocation, (now - startTime) * 0.001);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  render();
});
