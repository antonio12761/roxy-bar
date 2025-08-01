"use client";

import { useEffect, useRef } from 'react';

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    // Try both webgl and experimental-webgl
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    if (!gl) {
      console.error('WebGL not supported');
      // Fallback to a gradient background
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#0a0a0a');
        gradient.addColorStop(0.5, '#1a0a1a');
        gradient.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    console.log('WebGL context created successfully');

    // Vertex shader source
    const vertexShaderSource = `
      attribute vec4 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = position;
      }
    `;

    // Fragment shader source
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform float time;
      uniform float scale;
      uniform vec2 resolution;
      uniform vec3 color1;
      uniform vec3 color2;
      uniform vec3 color3;
      uniform vec3 color4;
      uniform float ax;
      uniform float ay;
      uniform float az;
      uniform float aw;
      uniform float bx;
      uniform float by;
      
      float cheapNoise(vec3 stp) {
        vec3 p = vec3(stp.xy, stp.z);
        vec4 a = vec4(ax, ay, az, aw);
        return mix(
          sin(p.z + p.x * a.x + cos(p.x * a.x - p.z)) * 
          cos(p.z + p.y * a.y + cos(p.y * a.x + p.z)),
          sin(1.0 + p.x * a.z + p.z + cos(p.y * a.w - p.z)) * 
          cos(1.0 + p.y * a.w + p.z + cos(p.x * a.x + p.z)), 
          0.436
        );
      }
      
      void main() {
        vec2 aR = vec2(resolution.x/resolution.y, 1.0);
        vec2 st = vUv * aR * scale;
        float S = sin(time * 0.005);
        float C = cos(time * 0.005);
        vec2 v1 = vec2(cheapNoise(vec3(st, 2.0)), cheapNoise(vec3(st, 1.0)));
        vec2 v2 = vec2(
          cheapNoise(vec3(st + bx*v1 + vec2(C * 1.7, S * 9.2), 0.15 * time)),
          cheapNoise(vec3(st + by*v1 + vec2(S * 8.3, C * 2.8), 0.126 * time))
        );
        float n = 0.5 + 0.5 * cheapNoise(vec3(st + v2, 0.0));
        
        vec3 color = mix(color1, color2, clamp((n*n)*8.0, 0.0, 1.0));
        color = mix(color, color3, clamp(length(v1), 0.0, 1.0));
        color = mix(color, color4, clamp(length(v2.x), 0.0, 1.0));
        
        color /= n*n + n * 7.0;
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile shader
    function compileShader(gl: WebGLRenderingContext, source: string, type: number) {
      const shader = gl.createShader(type);
      if (!shader) {
        console.error('Failed to create shader');
        return null;
      }
      
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      
      return shader;
    }

    // Create shader program
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile shaders');
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create program');
      return;
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return;
    }

    console.log('Shader program created successfully');

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1,-1, 1,1, 1, 1, -1,-1, 1,-1]), gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0,  0, 1, 1,0, 1, 0,  0, 1, 1, 1]), gl.STATIC_DRAW);

    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, 'position');
    const uvLocation = gl.getAttribLocation(program, 'uv');

    // Get uniform locations
    const timeLocation = gl.getUniformLocation(program, 'time');
    const scaleLocation = gl.getUniformLocation(program, 'scale');
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');
    const color1Location = gl.getUniformLocation(program, 'color1');
    const color2Location = gl.getUniformLocation(program, 'color2');
    const color3Location = gl.getUniformLocation(program, 'color3');
    const color4Location = gl.getUniformLocation(program, 'color4');
    const axLocation = gl.getUniformLocation(program, 'ax');
    const ayLocation = gl.getUniformLocation(program, 'ay');
    const azLocation = gl.getUniformLocation(program, 'az');
    const awLocation = gl.getUniformLocation(program, 'aw');
    const bxLocation = gl.getUniformLocation(program, 'bx');
    const byLocation = gl.getUniformLocation(program, 'by');

    // Resize canvas
    function resize() {
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      
      if (canvas && gl && (canvas.width !== displayWidth || canvas.height !== displayHeight)) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }
    
    resize();
    window.addEventListener('resize', resize);

    // Animation loop
    let startTime = Date.now();
    
    function render() {
      const currentTime = (Date.now() - startTime) / 1000;
      
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(program);
      
      // Set uniforms with dark theme colors
      gl.uniform1f(timeLocation, currentTime);
      gl.uniform1f(scaleLocation, 0.15);
      if (canvas) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }
      
      // Black, gray and white theme
      gl.uniform3f(color1Location, 0.0, 0.0, 0.0);   // Pure black
      gl.uniform3f(color2Location, 0.15, 0.15, 0.15); // Dark gray
      gl.uniform3f(color3Location, 0.05, 0.05, 0.05); // Very dark gray
      gl.uniform3f(color4Location, 0.25, 0.25, 0.25); // Light gray
      
      gl.uniform1f(axLocation, 5);
      gl.uniform1f(ayLocation, 7);
      gl.uniform1f(azLocation, 9);
      gl.uniform1f(awLocation, 13);
      gl.uniform1f(bxLocation, 1);
      gl.uniform1f(byLocation, 1);
      
      // Set attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
      
      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      animationRef.current = requestAnimationFrame(render);
    }
    
    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(uvBuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}