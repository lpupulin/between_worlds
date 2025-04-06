// WebGL Slider with custom displacement transition and GSAP text animations

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
      this.textWraps = document.querySelectorAll('.text-wrap');
      this.allCountHeadings = document.querySelectorAll('.count-heading');
      
      // Optional counter elements - check if they exist first
      this.prevHeading = document.querySelector('.count-heading.prev');
      this.nextHeading = document.querySelector('.count-heading.next');
      
      // Slider state
      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.isAnimating = false;
      this.transitionDuration = 0.8; // seconds
      this.transitionStrength = 0.1; // transition strength parameter
      this.textSplits = []; // Store SplitText instances
      
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
      
      // Check if GSAP and related plugins are available
      if (typeof gsap === 'undefined') {
        console.error('WebGL Slider: GSAP library not loaded');
        return;
      }
      
      // Initialize GSAP text animations
      this.initTextAnimations();
      
      // Initialize WebGL renderer and setup event listeners
      this.initThree();
      this.setupEventListeners();
      this.updateContent(0, true); // true for initial load (no animation)
    }
    
    // Initialize GSAP text animations
    initTextAnimations() {
      // Check if necessary GSAP plugins are loaded
      if (typeof gsap.SplitText === 'undefined') {
        console.warn('WebGL Slider: GSAP SplitText plugin not loaded. Text animations may not work as expected.');
      }
      
      // Initialize SplitText for world headings (for letter animations)
      this.worldHeadings.forEach((heading, index) => {
        const headingText = heading.querySelector('.world_heading');
        if (headingText) {
          // Create SplitText instance for each heading
          try {
            const splitHeading = new SplitText(headingText, { type: 'chars' });
            gsap.set(splitHeading.chars, { autoAlpha: 0, filter: 'blur(10px)' });
            this.textSplits[`heading_${index}`] = splitHeading;
          } catch (error) {
            console.error('WebGL Slider: Error initializing SplitText for headings', error);
          }
        }
      });
      
      // Initialize SplitText for text wraps (for line-by-line mask)
      this.textWraps.forEach((textWrap, index) => {
        try {
          const splitText = new SplitText(textWrap, { type: 'lines' });
          gsap.set(splitText.lines, { autoAlpha: 0, yPercent: 100 });
          this.textSplits[`text_${index}`] = splitText;
        } catch (error) {
          console.error('WebGL Slider: Error initializing SplitText for text wraps', error);
        }
      });
      
      // Setup mask effect for count headings
      this.allCountHeadings.forEach(countHeading => {
        gsap.set(countHeading, { autoAlpha: 0, yPercent: 100 });
      });
    }
    
    // ExpoOut easing function
    expoOut(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
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
        // Create shader material with the custom transition effect
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
            
            // Author: paniq
            // License: MIT
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
              // Apply the transition effect
              gl_FragColor = transition(vUv);
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
      
      // Update material uniforms for transition
      this.material.uniforms.fromTexture.value = this.textures[this.currentIndex] || this.textures[0];
      this.material.uniforms.toTexture.value = this.textures[nextIndex] || this.textures[0];
      this.material.uniforms.progress.value = 0;
      
      // Start transition animation using GSAP
      gsap.to(this.material.uniforms.progress, {
        value: 1,
        duration: this.transitionDuration,
        ease: "expo.out",
        onComplete: () => {
          this.currentIndex = nextIndex;
          this.updateContent(this.currentIndex);
          this.isAnimating = false;
        }
      });
      
      // Animate text elements
      this.animateTextOut(this.currentIndex);
      
      // Slight delay before animating the new content in
      gsap.delayedCall(this.transitionDuration * 0.4, () => {
        this.animateTextIn(nextIndex);
      });
    }
    
    animateTextOut(index) {
      // Animate heading characters out
      const headingSplit = this.textSplits[`heading_${index}`];
      if (headingSplit && headingSplit.chars) {
        gsap.to(headingSplit.chars, {
          duration: 0.4,
          autoAlpha: 0,
          filter: "blur(10px)",
          stagger: 0.02,
          ease: "power1.out"
        });
      }
      
      // Animate text lines out
      const textSplit = this.textSplits[`text_${index}`];
      if (textSplit && textSplit.lines) {
        gsap.to(textSplit.lines, {
          duration: 0.4,
          yPercent: -100,
          autoAlpha: 0,
          stagger: 0.03,
          ease: "power2.in"
        });
      }
    }
    
    animateTextIn(index) {
      // Animate heading characters in with random order
      const headingSplit = this.textSplits[`heading_${index}`];
      if (headingSplit && headingSplit.chars) {
        // Reset first
        gsap.set(headingSplit.chars, {
          autoAlpha: 0,
          filter: "blur(10px)"
        });
        
        // Create random order for the animation
        const chars = [...headingSplit.chars];
        chars.sort(() => Math.random() - 0.5);
        
        // Animate characters in random order
        gsap.to(chars, {
          duration: 0.8,
          autoAlpha: 1,
          filter: "blur(0px)",
          stagger: 0.03,
          ease: "power2.out"
        });
      }
      
      // Animate text lines in with mask effect
      const textSplit = this.textSplits[`text_${index}`];
      if (textSplit && textSplit.lines) {
        // Reset first
        gsap.set(textSplit.lines, {
          autoAlpha: 0,
          yPercent: 100
        });
        
        // Animate lines with mask effect
        gsap.to(textSplit.lines, {
          duration: 0.6,
          autoAlpha: 1,
          yPercent: 0,
          stagger: 0.05,
          ease: "power2.out"
        });
      }
      
      // Animate count headings with mask effect
      gsap.to(this.allCountHeadings, {
        duration: 0.6,
        autoAlpha: 1,
        yPercent: 0,
        stagger: 0.1,
        ease: "power2.out"
      });
    }
    
    updateCounterNumbers(newIndex) {
      // Reset all counter animations
      gsap.set(this.allCountHeadings, {
        autoAlpha: 0,
        yPercent: 100
      });
      
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
    
    updateContent(index, isInitial = false) {
      // Update active thumbnail
      this.worldButtons.forEach((button, i) => {
        if (i === index) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Update content visibility
      this.worldHeadings.forEach((heading, i) => {
        if (i === index) {
          heading.style.display = 'block';
          if (isInitial) {
            // For initial load, set immediately visible
            heading.style.opacity = '1';
            
            // Animate in the text for initial load
            const headingSplit = this.textSplits[`heading_${i}`];
            if (headingSplit && headingSplit.chars) {
              gsap.to(headingSplit.chars, {
                duration: 0.8,
                autoAlpha: 1,
                filter: "blur(0px)",
                stagger: 0.03,
                ease: "power2.out"
              });
            }
            
            const textSplit = this.textSplits[`text_${i}`];
            if (textSplit && textSplit.lines) {
              gsap.to(textSplit.lines, {
                duration: 0.6,
                autoAlpha: 1,
                yPercent: 0,
                stagger: 0.05,
                ease: "power2.out",
                delay: 0.2
              });
            }
            
            gsap.to(this.allCountHeadings, {
              duration: 0.6,
              autoAlpha: 1,
              yPercent: 0,
              stagger: 0.1,
              ease: "power2.out",
              delay: 0.3
            });
          }
        } else {
          heading.style.display = 'none';
          heading.style.opacity = '0';
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
    if (typeof THREE !== 'undefined' && typeof gsap !== 'undefined') {
      const slider = new WebGLSlider();
    } else {
      console.error('WebGL Slider: Required libraries (Three.js or GSAP) not loaded');
    }
  } catch (error) {
    console.error('WebGL Slider: Error initializing slider', error);
  }
});
