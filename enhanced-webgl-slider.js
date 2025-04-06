// Create a new script file named 'enhanced-webgl-slider.js'
// This version uses more advanced GL transitions

document.addEventListener('DOMContentLoaded', () => {
  // Main slider class with advanced transitions
  class EnhancedWebGLSlider {
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
      
      // Slider state
      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.isAnimating = false;
      this.transitionDuration = 1.5; // seconds
      
      // Selected transition
      this.transition = this.getRandomTransition();
      
      // Get all image sources from thumbnails
      this.worldButtons.forEach(button => {
        const img = button.querySelector('img');
        if (img) {
          this.images.push(img.src);
        }
      });
      
      // Initialize WebGL renderer and setup event listeners
      this.initThree();
      this.setupEventListeners();
      this.updateContent(0);
    }
    
    // Get a random WebGL transition
    getRandomTransition() {
      // Define some transition effects
      const transitions = [
        {
          name: 'fade',
          uniforms: {},
          fragment: `
            varying vec2 vUv;
            uniform float dispFactor;
            uniform sampler2D currentImage;
            uniform sampler2D nextImage;
            
            void main() {
              vec4 currentColor = texture2D(currentImage, vUv);
              vec4 nextColor = texture2D(nextImage, vUv);
              
              gl_FragColor = mix(currentColor, nextColor, dispFactor);
            }
          `
        },
        {
          name: 'wipe',
          uniforms: {},
          fragment: `
            varying vec2 vUv;
            uniform float dispFactor;
            uniform sampler2D currentImage;
            uniform sampler2D nextImage;
            
            void main() {
              vec4 currentColor = texture2D(currentImage, vUv);
              vec4 nextColor = texture2D(nextImage, vUv);
              
              gl_FragColor = mix(currentColor, nextColor, step(vUv.x, dispFactor));
            }
          `
        },
        {
          name: 'circle',
          uniforms: {},
          fragment: `
            varying vec2 vUv;
            uniform float dispFactor;
            uniform sampler2D currentImage;
            uniform sampler2D nextImage;
            
            void main() {
              vec4 currentColor = texture2D(currentImage, vUv);
              vec4 nextColor = texture2D(nextImage, vUv);
              
              float dist = distance(vUv, vec2(0.5));
              gl_FragColor = mix(currentColor, nextColor, step(dist, dispFactor * 0.7));
            }
          `
        },
        {
          name: 'zoom',
          uniforms: {},
          fragment: `
            varying vec2 vUv;
            uniform float dispFactor;
            uniform sampler2D currentImage;
            uniform sampler2D nextImage;
            
            void main() {
              vec2 center = vec2(0.5);
              vec2 currentUv = mix(center, vUv, 1.0 - dispFactor * 0.5);
              vec2 nextUv = mix(vUv, center, 0.5 - dispFactor * 0.5);
              
              vec4 currentColor = texture2D(currentImage, currentUv);
              vec4 nextColor = texture2D(nextImage, nextUv);
              
              gl_FragColor = mix(currentColor, nextColor, dispFactor);
            }
          `
        }
      ];
      
      // Return a random transition
      return transitions[Math.floor(Math.random() * transitions.length)];
    }
    
    initThree() {
      // Set up Three.js scene
      this.renderer = new THREE.WebGLRenderer({ alpha: true });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Replace the original image with our canvas
      this.imageElement.style.display = 'none';
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.classList.add('webgl-canvas');
      this.renderer.domElement.style.position = 'absolute';
      this.renderer.domElement.style.top = '0';
      this.renderer.domElement.style.left = '0';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.objectFit = 'cover';
      this.renderer.domElement.style.zIndex = '-1';
      
      // Create scene, camera, and geometry
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      
      // Create plane geometry for the image
      this.geometry = new THREE.PlaneGeometry(2, 2);
      
      // Load textures for all images
      const textureLoader = new THREE.TextureLoader();
      const promises = this.images.map(src => {
        return new Promise(resolve => {
          const texture = textureLoader.load(src, () => resolve(texture));
        });
      });
      
      Promise.all(promises).then(loadedTextures => {
        this.textures = loadedTextures;
        
        // Create shader material with the selected transition
        this.material = new THREE.ShaderMaterial({
          uniforms: {
            dispFactor: { type: 'f', value: 0 },
            currentImage: { type: 't', value: this.textures[0] },
            nextImage: { type: 't', value: this.textures[0] },
            ...this.transition.uniforms
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: this.transition.fragment
        });
        
        // Create mesh and add to scene
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
        
        // Initial render
        this.renderer.render(this.scene, this.camera);
      });
      
      // Handle window resize
      window.addEventListener('resize', this.onResize.bind(this));
    }
    
    onResize() {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    setupEventListeners() {
      // Arrow buttons
      this.leftArrow.addEventListener('click', () => this.navigate(-1));
      this.rightArrow.addEventListener('click', () => this.navigate(1));
      
      // Thumbnail buttons
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
      
      // Pre-update counter numbers for animation
      this.updateCounterNumbers(nextIndex);
      
      // Update material uniforms
      this.material.uniforms.currentImage.value = this.textures[this.currentIndex];
      this.material.uniforms.nextImage.value = this.textures[nextIndex];
      this.material.uniforms.dispFactor.value = 0;
      
      // Change transition for variety
      this.transition = this.getRandomTransition();
      
      // Start transition animation
      let startTime = null;
      
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / (this.transitionDuration * 1000), 1);
        
        this.material.uniforms.dispFactor.value = progress;
        this.renderer.render(this.scene, this.camera);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete
          this.currentIndex = nextIndex;
          this.updateContent(this.currentIndex);
          this.isAnimating = false;
        }
      };
      
      requestAnimationFrame(animate);
    }
    
    updateCounterNumbers(newIndex) {
      // Set up previous, current, and next indices for counter animation
      const prevIndex = this.getPrevIndex(newIndex);
      const nextIndex = this.getNextIndex(newIndex);
      
      this.prevHeading.textContent = this.formatIndex(prevIndex + 1);
      this.nextHeading.textContent = this.formatIndex(nextIndex + 1);
    }
    
    getPrevIndex(currentIndex) {
      return currentIndex === 0 ? this.totalSlides - 1 : currentIndex - 1;
    }
    
    getNextIndex(currentIndex) {
      return currentIndex === this.totalSlides - 1 ? 0 : currentIndex + 1;
    }
    
    updateContent(index) {
      // Update counter with animation
      this.countHeading.textContent = this.formatIndex(index + 1);
      
      // Update active thumbnail
      this.worldButtons.forEach((button, i) => {
        if (i === index) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Update content heading and text with fade animation
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
      // Format index as 01, 02, etc.
      return index < 10 ? `0${index}` : `${index}`;
    }
  }
  
  // Initialize the enhanced slider
  const slider = new EnhancedWebGLSlider();
});
