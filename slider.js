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
      this.initTextSplitting();
      this.setupNavCorners();
      this.updateContent(0, true);
    }

    initThree() {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);

      this.imageElement.style.display = 'none';

      // ✅ FIX: Append canvas inside .gallery-sticky
      const stickyWrapper = this.container.querySelector('.gallery-sticky');
      if (stickyWrapper) {
        stickyWrapper.appendChild(this.renderer.domElement);
      } else {
        console.warn('WebGLSlider: .gallery-sticky not found. Appending canvas to .section.is-gallery as fallback.');
        this.container.appendChild(this.renderer.domElement);
      }

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
      this.loadedTextures = 0;

      const texturePromises = this.images.map((src, i) => {
        return new Promise((resolve) => {
          loader.load(src, (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            texture.generateMipmaps = false;
            texture.needsUpdate = true;

            this.textures[i] = texture;
            this.loadedTextures++;
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

    // … Keep the rest of your WebGLSlider class methods unchanged …
    // setupEventListeners, setupNavCorners, animateTextIn, animateTextOut,
    // updateContent, createMaterial, setPlaneSize, goTo, navigate, etc.

  }

  try {
    if (typeof THREE !== 'undefined' && typeof Flip !== 'undefined') {
      new WebGLSlider();
    } else {
      if (typeof THREE === 'undefined') {
        console.error('WebGL Slider: Three.js library not loaded');
      }
      if (typeof Flip === 'undefined') {
        console.error('WebGL Slider: GSAP Flip plugin not loaded');
      }
    }
  } catch (error) {
    console.error('WebGL Slider: Error initializing slider', error);
  }
});
