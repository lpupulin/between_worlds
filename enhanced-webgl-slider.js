import * as THREE from 'three';

export default class SlidesRenderer {
  constructor({ transitionDuration = 2, images = [], wrapper }) {
    this.wrapper = wrapper;
    this.transitionDuration = transitionDuration;
    this.images = images;
    this.textures = [];
    this.currentIndex = 0;
    this.isAnimating = false;

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.wrapper.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    this.loadTextures();
    window.addEventListener('resize', () => this.onResize());
  }

  loadTextures() {
    this.images.forEach((src, index) => {
      const image = new Image();
      image.src = src;

      image.onload = () => {
        const texture = new THREE.TextureLoader().load(src, () => {
          texture.needsUpdate = true;
          this.textures[index] = {
            texture: texture,
            width: image.width,
            height: image.height
          };

          if (index === 0 && !this.mesh) {
            this.createMaterial();
            this.createMesh();
          }
        });
      };
    });
  }

  createMaterial() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        fromTexture: { value: this.textures[0].texture },
        toTexture: { value: this.textures[0].texture },
        progress: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D fromTexture;
        uniform sampler2D toTexture;
        uniform float progress;
        varying vec2 vUv;

        void main() {
          vec4 fromColor = texture2D(fromTexture, vUv);
          vec4 toColor = texture2D(toTexture, vUv);
          gl_FragColor = mix(fromColor, toColor, progress);
        }
      `,
      transparent: true
    });
  }

  createMesh() {
    const texData = this.textures[0];
    if (!texData) return;

    const imageAspect = texData.width / texData.height;
    const screenAspect = window.innerWidth / window.innerHeight;

    let width, height;
    if (screenAspect > imageAspect) {
      height = 2;
      width = 2 * imageAspect / screenAspect;
    } else {
      width = 2;
      height = 2 * screenAspect / imageAspect;
    }

    this.geometry = new THREE.PlaneGeometry(width, height);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
    this.renderer.render(this.scene, this.camera);
  }

  goTo(index, direction) {
    if (this.isAnimating || !this.mesh) return;

    this.isAnimating = true;
    const nextIndex = index;

    const from = this.textures[this.currentIndex] || this.textures[0];
    const to = this.textures[nextIndex] || this.textures[0];

    this.material.uniforms.fromTexture.value = from.texture;
    this.material.uniforms.toTexture.value = to.texture;
    this.material.uniforms.progress.value = 0;

    // Resize mesh geometry for new image
    const imageAspect = to.width / to.height;
    const screenAspect = window.innerWidth / window.innerHeight;

    let width, height;
    if (screenAspect > imageAspect) {
      height = 2;
      width = 2 * imageAspect / screenAspect;
    } else {
      width = 2;
      height = 2 * screenAspect / imageAspect;
    }

    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, height);

    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const rawProgress = Math.min(elapsed / (this.transitionDuration * 1000), 1);
      const easedProgress = this.expoOut(rawProgress);

      this.material.uniforms.progress.value = easedProgress;
      this.renderer.render(this.scene, this.camera);

      if (rawProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.currentIndex = nextIndex;
        this.isAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  onResize() {
    if (this.renderer) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    if (this.mesh && this.textures[this.currentIndex]) {
      const texData = this.textures[this.currentIndex];
      const imageAspect = texData.width / texData.height;
      const screenAspect = window.innerWidth / window.innerHeight;

      let width, height;
      if (screenAspect > imageAspect) {
        height = 2;
        width = 2 * imageAspect / screenAspect;
      } else {
        width = 2;
        height = 2 * screenAspect / imageAspect;
      }

      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(width, height);
      this.renderer.render(this.scene, this.camera);
    }
  }

  expoOut(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  next() {
    this.goTo((this.currentIndex + 1) % this.images.length, 1);
  }

  previous() {
    this.goTo((this.currentIndex - 1 + this.images.length) % this.images.length, -1);
  }
}
