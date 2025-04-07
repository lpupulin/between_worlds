// WebGL Slider with proper aspect ratio, scaling, and resize fix

document.addEventListener('DOMContentLoaded', () => {
  class WebGLSlider {
    constructor() {
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
      this.material = null;
      this.mesh = null;
      this.isAnimating = false;
      this.transitionDuration = 0.8;
      this.transitionStrength = 0.1;
      this.imageScale = 0.4; // easily control the size of the displayed images (0.0 - 1.0)

      this.worldButtons.forEach(button => {
        const img = button.querySelector('img');
        if (img) this.images.push(img.src);
      });

      if (!this.container || !this.imageElement || !this.leftArrow || !this.rightArrow || !this.countHeading) {
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
      this.renderer.domElement.style.position = 'absolute';
      this.renderer.domElement.style.top = '0';
      this.renderer.domElement.style.left = '0';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.zIndex = '-1';

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      this.geometry = new THREE.PlaneGeometry(2, 2);
      const loader = new THREE.TextureLoader();

      this.images.forEach((src, index) => {
        loader.load(src, (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          this.textures[index] = texture;

          if (index === 0 && !this.mesh) {
            this.createMaterial();
            this.setAspect(texture.image);
          }
        });
      });

      window.addEventListener('resize', () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.setAspect(this.textures[this.currentIndex]?.image);
      });
    }

    createMaterial() {
      this.material = new THREE.ShaderMaterial({
        uniforms: {
          progress: { value: 0 },
          fromTexture: { value: this.textures[0] },
          toTexture: { value: this.textures[0] },
          strength: { value: this.transitionStrength }
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

    setAspect(image) {
      if (!image || !this.mesh) return;

      const canvasAspect = window.innerWidth / window.innerHeight;
      const imageAspect = image.width / image.height;
      let scaleX = 1, scaleY = 1;

      if (canvasAspect > imageAspect) {
        scaleX = imageAspect / canvasAspect;
      } else {
        scaleY = canvasAspect / imageAspect;
      }

      this.mesh.scale.set(scaleX * this.imageScale * 2, scaleY * this.imageScale * 2, 1);
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

      this.material.uniforms.fromTexture.value = this.textures[this.currentIndex];
      this.material.uniforms.toTexture.value = this.textures[nextIndex];
      this.material.uniforms.progress.value = 0;

      this.setAspect(this.textures[nextIndex]?.image);

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
