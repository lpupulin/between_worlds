document.addEventListener('DOMContentLoaded', () => {
  class WebGLSlider {
    constructor() {
      this.container = document.querySelector('.section.is-gallery');
      this.imageElement = document.querySelector('.autumn');
      this.leftArrow = document.querySelector('.btn_arrow_wrap.is-left');
      this.rightArrow = document.querySelector('.btn_arrow_wrap.is-right');
      this.worldButtons = document.querySelectorAll('.button');
      this.countHeading = document.querySelector('.count-heading.is-1') || null;
      this.prevHeading = document.querySelector('.count-heading.is-2') || null;
      this.nextHeading = document.querySelector('.count-heading.is-3') || null;
      this.extraHeading = document.querySelector('.count-heading.is-4') || null;
      this.worldHeadings = document.querySelectorAll('.world_heading-wrap');
      this.navCorners = document.querySelector('.nav-corners');

      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.isAnimating = false;
      this.pendingNavigation = null;
      this.transitionDuration = 0.8;
      this.fastTransitionDuration = 0.4;
      this.transitionStrength = 0.1;
      this.imageScale = 0.35;
      this.allTexturesLoaded = false;

      this.masterTimeline = null;
      this.textInTimeline = null;
      this.textOutTimeline = null;
      this.cornerTimeline = null;
      this.imageTimeline = null;

      this.splitInstances = {};
      this.textWraps = document.querySelectorAll('.text-wrap');

      this.worldButtons.forEach(button => {
        const img = button.querySelector('img');
        if (img) {
          this.images.push(img.src);
        }
      });

      if (!this.container || !this.imageElement || !this.leftArrow || !this.rightArrow ||
          this.worldButtons.length === 0 || !this.countHeading) {
        console.error('WebGL Slider: Required DOM elements not found');
        return;
      }

      this.initThree();
      this.setupEventListeners();
    }

    setupEventListeners() {
      this.leftArrow.addEventListener('click', () => this.navigate(-1));
      this.rightArrow.addEventListener('click', () => this.navigate(1));

      this.worldButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
          if (this.currentIndex !== index) {
            const direction = index > this.currentIndex ? 1 : -1;
            this.goTo(index, direction);
          }
        });
      });
    }

    initThree() {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);

      this.imageElement.style.display = 'none';

      const stickyContainer = this.container.querySelector('.gallery-sticky');
      stickyContainer.appendChild(this.renderer.domElement);

      this.renderer.domElement.classList.add('webgl-canvas');
      Object.assign(this.renderer.domElement.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '-1'
      });

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.geometry = new THREE.PlaneGeometry(2, 2);
      this.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);

      const loader = new THREE.TextureLoader();
      const texturePromises = this.images.map((src, i) => {
        return new Promise((resolve) => {
          loader.load(src, (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            texture.generateMipmaps = false;
            texture.needsUpdate = true;
            this.textures[i] = texture;
            resolve(texture);
          });
        });
      });

      Promise.all(texturePromises).then(() => {
        this.allTexturesLoaded = true;
        this.createMaterial();
        this.setPlaneSize(this.textures[this.currentIndex].image);
        this.renderer.render(this.scene, this.camera);
      });

      window.addEventListener('resize', () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.mesh && this.textures[this.currentIndex]) {
          this.setPlaneSize(this.textures[this.currentIndex].image);
        }
        this.renderer.render(this.scene, this.camera);
      });

      this.renderer.render(this.scene, this.camera);
    }

    setPlaneSize(image) {
      if (!image) return;
      const imageAspect = image.width / image.height;
      const screenAspect = window.innerWidth / window.innerHeight;
      let width, height;
      if (imageAspect > screenAspect) {
        width = 2 * this.imageScale;
        height = (2 / imageAspect) * screenAspect * this.imageScale;
      } else {
        height = 2 * this.imageScale;
        width = 2 * imageAspect / screenAspect * this.imageScale;
      }
      this.mesh.scale.set(width, height, 1);
    }

    createMaterial() {
      this.scene.remove(this.mesh);
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
            vec2 oa = (((ca.rg + ca.b) * 0.5) * 2.0 - 1.0);
            vec2 ob = (((cb.rg + cb.b) * 0.5) * 2.0 - 1.0);
            vec2 oc = mix(oa, ob, 0.5) * strength;
            float w0 = progress;
            float w1 = 1.0 - w0;
            return mix(getFromColor(p + oc * w0), getToColor(p - oc * w1), progress);
          }

          void main() {
            gl_FragColor = transition(vUv);
          }
        `,
        transparent: true
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);
    }

    navigate(direction) {
      if (!this.allTexturesLoaded) return;
      const nextIndex = (this.currentIndex + direction + this.totalSlides) % this.totalSlides;
      this.goTo(nextIndex, direction);
    }

    goTo(index, direction) {
      if (!this.allTexturesLoaded) return;
      this.material.uniforms.fromTexture.value = this.textures[this.currentIndex];
      this.material.uniforms.toTexture.value = this.textures[index];
      this.material.uniforms.progress.value = 0;
      this.setPlaneSize(this.textures[index].image);
      gsap.to(this.material.uniforms.progress, {
        value: 1,
        duration: this.transitionDuration,
        ease: "power2.inOut",
        onUpdate: () => this.renderer.render(this.scene, this.camera)
      });
      this.currentIndex = index;
    }
  }

  try {
    if (typeof THREE !== 'undefined') {
      new WebGLSlider();
    } else {
      console.error('WebGL Slider: Three.js not loaded');
    }
  } catch (error) {
    console.error('WebGL Slider: Error initializing slider', error);
  }
});
