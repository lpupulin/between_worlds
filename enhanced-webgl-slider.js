document.addEventListener('DOMContentLoaded', () => {
  class WebGLSlider {
    constructor() {
      // DOM Elements
      this.container = document.querySelector('.section.is-gallery');
      this.imageElement = document.querySelector('.autumn');
      this.leftArrow = document.querySelector('.btn_arrow_wrap.is-left');
      this.rightArrow = document.querySelector('.btn_arrow_wrap.is-right');
      this.worldButtons = document.querySelectorAll('.button');
      this.countHeading = document.querySelector('.count-heading.current');
      this.prevHeading = document.querySelector('.count-heading.prev');
      this.nextHeading = document.querySelector('.count-heading.next');
      this.worldHeadings = document.querySelectorAll('.world_heading-wrap');

      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.isAnimating = false;
      this.transitionDuration = 0.8;
      this.transitionStrength = 0.1;

      this.worldButtons.forEach(button => {
        const img = button.querySelector('img');
        if (img) this.images.push(img.src);
      });

      if (!this.container || !this.imageElement || !this.leftArrow || !this.rightArrow || !this.countHeading || this.worldButtons.length === 0) {
        console.error('WebGL Slider: Required DOM elements not found');
        return;
      }

      this.initThree();
      this.setupEventListeners();
      this.updateContent(0);
    }

    expoOut(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    initThree() {
      this.renderer = new THREE.WebGLRenderer({ alpha: true });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);

      this.imageElement.style.display = 'none';
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.classList.add('webgl-canvas');
      Object.assign(this.renderer.domElement.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100vh',
        zIndex: '-1',
      });

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.geometry = new THREE.PlaneGeometry(1, 1);

      const textureLoader = new THREE.TextureLoader();
      this.images.forEach((src, i) => {
        textureLoader.load(src, (texture) => {
          this.textures[i] = texture;
          if (i === 0 && !this.mesh) {
            this.createMaterial();
            this.createMeshFromTexture(texture);
          }
        });
      });

      window.addEventListener('resize', this.onResize.bind(this));
    }

    createMaterial() {
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          progress: { type: 'f', value: 0 },
          fromTexture: { type: 't', value: this.textures[0] },
          toTexture: { type: 't', value: this.textures[0] },
          strength: { type: 'f', value: this.transitionStrength }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float progress;
          uniform float strength;
          uniform sampler2D fromTexture;
          uniform sampler2D toTexture;

          vec4 getFromColor(vec2 uv) {
            return texture2D(fromTexture, uv);
          }

          vec4 getToColor(vec2 uv) {
            return texture2D(toTexture, uv);
          }

          vec4 transition(vec2 p) {
            vec4 ca = getFromColor(p);
            vec4 cb = getToColor(p);
            vec2 oa = (((ca.rg+ca.b)*0.5)*2.0-1.0);
            vec2 ob = (((cb.rg+cb.b)*0.5)*2.0-1.0);
            vec2 oc = mix(oa,ob,0.5)*strength;
            float w0 = progress;
            float w1 = 1.0-w0;
            return mix(getFromColor(p+oc*w0), getToColor(p-oc*w1), progress);
          }

          void main() {
            gl_FragColor = transition(vUv);
          }
        `
      });

      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);
      this.renderer.render(this.scene, this.camera);
    }

    createMeshFromTexture(texture) {
      const imageAspect = texture.image.width / texture.image.height;
      const screenAspect = window.innerWidth / window.innerHeight;

      let scaleX = 1, scaleY = 1;
      if (screenAspect > imageAspect) {
        scaleX = imageAspect / screenAspect;
      } else {
        scaleY = screenAspect / imageAspect;
      }

      this.mesh.scale.set(scaleX, scaleY, 1.2);
    }

    onResize() {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      const currentTexture = this.textures[this.currentIndex];
      if (currentTexture?.image) {
        this.createMeshFromTexture(currentTexture);
      }
      this.renderer.render(this.scene, this.camera);
    }

    setupEventListeners() {
      this.leftArrow.addEventListener('click', () => this.navigate(-1));
      this.rightArrow.addEventListener('click', () => this.navigate(1));

      this.worldButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
          if (this.currentIndex !== index && !this.isAnimating) {
            const direction = index > this.currentIndex ? 1 : -1;
            this.goTo(index, direction);
          }
        });
      });
    }

    navigate(direction) {
      if (this.isAnimating || !this.mesh) return;

      let nextIndex = this.currentIndex + direction;
      if (nextIndex < 0) nextIndex = this.totalSlides - 1;
      if (nextIndex >= this.totalSlides) nextIndex = 0;

      this.goTo(nextIndex, direction);
    }

    goTo(index, direction) {
      if (this.isAnimating || !this.mesh) return;

      this.isAnimating = true;
      const nextIndex = index;

      this.updateCounterNumbers(nextIndex);

      const fromTex = this.textures[this.currentIndex] || this.textures[0];
      const toTex = this.textures[nextIndex] || this.textures[0];
      this.material.uniforms.fromTexture.value = fromTex;
      this.material.uniforms.toTexture.value = toTex;
      this.material.uniforms.progress.value = 0;

      if (toTex.image) {
        this.createMeshFromTexture(toTex);
      }

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
          this.updateContent(this.currentIndex);
          this.isAnimating = false;
        }
      };

      requestAnimationFrame(animate);
    }

    updateCounterNumbers(newIndex) {
      if (this.countHeading) {
        this.countHeading.textContent = this.formatIndex(newIndex + 1);
      }
      if (this.prevHeading) {
        const prevIndex = newIndex === 0 ? this.totalSlides - 1 : newIndex - 1;
        this.prevHeading.textContent = this.formatIndex(prevIndex + 1);
      }
      if (this.nextHeading) {
        const nextIndex = newIndex === this.totalSlides - 1 ? 0 : newIndex + 1;
        this.nextHeading.textContent = this.formatIndex(nextIndex + 1);
      }
    }

    updateContent(index) {
      this.worldButtons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
      });

      this.worldHeadings.forEach((heading, i) => {
        if (i === index) {
          heading.style.opacity = '0';
          heading.style.display = 'block';
          setTimeout(() => {
            heading.style.transition = 'opacity 0.5s ease';
            heading.style.opacity = '1';
          }, 50);
        } else {
          heading.style.opacity = '0';
          setTimeout(() => {
            heading.style.display = 'none';
          }, 500);
        }
      });
    }

    formatIndex(index) {
      return index < 10 ? `0${index}` : `${index}`;
    }
  }

  if (typeof THREE !== 'undefined') {
    new WebGLSlider();
  } else {
    console.error('WebGL Slider: Three.js library not loaded');
  }
});
