// Fixed WebGL Slider with error handling and DOM element checks

document.addEventListener('DOMContentLoaded', () => {
  // Main slider class
  class WebGLSlider {
    constructor() {
      // DOM Elements
      this.container = document.querySelector('.section.is-gallery');
      this.imageElement = document.querySelector('.autumn');
      this.leftArrow = document.querySelector('.btn_arrow_wrap.is-left');
      this.rightArrow = document.querySelector('.btn_arrow_wrap.is-right');
      this.worldButtons = document.querySelectorAll('.button');
      this.countHeading = document.querySelector('.count-heading.current');
      this.worldHeadings = document.querySelectorAll('.world_heading-wrap');
      
      // Optional counter elements - check if they exist first
      this.prevHeading = document.querySelector('.count-heading.prev');
      this.nextHeading = document.querySelector('.count-heading.next');
      
      // Slider state
      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.isAnimating = false;
      this.transitionDuration = 1.2; // seconds
      
      // Get all image sources from thumbnails
      this.worldButtons.forEach(button => {
        const img = button.querySelector('img');
        if (img) {
          this.images.push(img.src);
        }
      });
      
      // Check if we have the required elements before proceeding
      if (!this.container || !this.imageElement || !this.leftArrow || !this.rightArrow || 
          this.worldButtons.length === 0 || !this.countHeading) {
        console.error('WebGL Slider: Required DOM elements not found');
        return;
      }
      
      // Initialize WebGL renderer and setup event listeners
      this.initThree();
      this.setupEventListeners();
      this.updateContent(0);
    }
    
    initThree() {
      try {
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
        this.images.forEach((src, index) => {
          const texture = textureLoader.load(src, () => {
            this.textures[index] = texture;
            // When the first texture is loaded, create the material and mesh
            if (index === 0 && !this.mesh) {
              this.createMaterial();
            }
          });
        });
      } catch (error) {
        console.error('WebGL Slider: Error initializing Three.js', error);
      }
      
      // Handle window resize
      window.addEventListener('resize', this.onResize.bind(this));
    }
    
    createMaterial() {
      try {
        // Create shader material
        this.material = new THREE.ShaderMaterial({
          uniforms: {
            dispFactor: { type: 'f', value: 0 },
            currentImage: { type: 't', value: this.textures[0] },
            nextImage: { type: 't', value: this.textures[0] }
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
            uniform float dispFactor;
            uniform sampler2D currentImage;
            uniform sampler2D nextImage;
            
            void main() {
              vec4 currentColor = texture2D(currentImage, vUv);
              vec4 nextColor = texture2D(nextImage, vUv);
              
              gl_FragColor = mix(currentColor, nextColor, dispFactor);
            }
          `
        });
        
        // Create mesh and add to scene
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
        
        // First render
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        console.error('WebGL Slider: Error creating material', error);
      }
    }
    
    onResize() {
      if (this.renderer) {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
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
      
      // Update counter numbers safely
      this.updateCounterNumbers(nextIndex);
      
      // Update material uniforms
      this.material.uniforms.currentImage.value = this.textures[this.currentIndex] || this.textures[0];
      this.material.uniforms.nextImage.value = this.textures[nextIndex] || this.textures[0];
      this.material.uniforms.dispFactor.value = 0;
      
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
      // Only update if these elements exist
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
      // Update active thumbnail
      this.worldButtons.forEach((button, i) => {
        if (i === index) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Update content heading and text
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
  
  // Initialize the slider with error handling
  try {
    if (typeof THREE !== 'undefined') {
      const slider = new WebGLSlider();
    } else {
      console.error('WebGL Slider: Three.js library not loaded');
    }
  } catch (error) {
    console.error('WebGL Slider: Error initializing slider', error);
  }
});
