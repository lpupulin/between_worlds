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
      this.pendingNavigation = null; // Store pending navigation
      this.transitionDuration = 0.8;
      this.fastTransitionDuration = 0.4; // Faster duration for quick clicks
      this.transitionStrength = 0.1;
      this.imageScale = 0.35; // Easily control image size (0.0 - 1.0)
      this.allTexturesLoaded = false;
      
      // Animation timelines
      this.masterTimeline = null;
      this.textInTimeline = null;
      this.textOutTimeline = null;
      this.cornerTimeline = null;
      this.imageTimeline = null;
      
      // SplitType instances
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

      // Log warnings if any of the count-heading elements are missing
      if (!this.countHeading) console.warn('WebGL Slider: .count-heading.current not found');
      if (!this.prevHeading) console.warn('WebGL Slider: .count-heading.is-2 not found');
      if (!this.nextHeading) console.warn('WebGL Slider: .count-heading.is-3 not found');
      if (!this.extraHeading) console.warn('WebGL Slider: .count-heading.is-4 not found');

      this.initThree();
      this.setupEventListeners();
      this.initTextSplitting();
      this.setupNavCorners();
      this.updateContent(0, true); // true for initial load
    }

    setupNavCorners() {
      if (!this.navCorners) return;

      // Set the first button as active initially
      if (this.worldButtons.length > 0) {
        this.worldButtons[0].classList.add('is--active');
        
        // Place navCorners inside the first active button initially
        if (this.navCorners && this.worldButtons[0]) {
          this.worldButtons[0].appendChild(this.navCorners);
        }
      }

      this.worldButtons.forEach((link) => {
        // Move corners into button we're hovering
        link.addEventListener("mouseenter", () => {
          if (!this.navCorners) return;
          
          // Kill any active corner animation
          if (this.cornerTimeline) this.cornerTimeline.kill();
          
          const state = Flip.getState(this.navCorners);
          link.appendChild(this.navCorners);
          this.cornerTimeline = Flip.from(state, {
            duration: 0.3,
            ease: "power1.out"
          });
        });
        
        // Move corners back to active button on hover out
        link.addEventListener("mouseleave", () => {
          if (!this.navCorners) return;
          
          const activeLink = document.querySelector(".button.is--active");
          if (activeLink) {
            // Kill any active corner animation
            if (this.cornerTimeline) this.cornerTimeline.kill();
            
            const state = Flip.getState(this.navCorners);
            activeLink.appendChild(this.navCorners);
            this.cornerTimeline = Flip.from(state, {
              duration: 0.3,
              ease: "power1.out"
            });
          }
        });
      });
    }

    initTextSplitting() {
      // Check if GSAP and SplitType are available
      if (typeof gsap === 'undefined') {
        console.error('GSAP not found. Make sure it is loaded before this script.');
        return;
      }
      
      if (typeof SplitType === 'undefined') {
        console.error('SplitType not found. Make sure it is loaded before this script.');
        return;
      }
      
      // Initialize SplitType for all headings
      this.worldHeadings.forEach((heading, index) => {
        const headingElement = heading.querySelector('.world_heading');
        const textWrap = heading.querySelector('.text-wrap');
        
        if (headingElement) {
          this.splitInstances[`heading-${index}`] = new SplitType(headingElement, {
            types: 'chars,words',
            tagName: 'span'
          });
        }
        
        if (textWrap) {
          this.splitInstances[`text-${index}`] = new SplitType(textWrap, {
            types: 'lines',
            tagName: 'span'
          });
          
          // Add a wrapper to each line for better animation control
          if (this.splitInstances[`text-${index}`].lines) {
            gsap.set(this.splitInstances[`text-${index}`].lines, { overflow: "hidden" });
            this.splitInstances[`text-${index}`].lines.forEach(line => {
              const wrapper = document.createElement('div');
              wrapper.className = 'line-wrapper';
              wrapper.style.overflow = 'hidden';
              line.parentNode.insertBefore(wrapper, line);
              wrapper.appendChild(line);
            });
          }
        }
      });
      
      // Initialize SplitType for counter numbers
      const counterElements = [this.countHeading, this.prevHeading, this.nextHeading];
      counterElements.forEach((el, i) => {
        if (el) {
          const counterName = i === 0 ? 'current' : i === 1 ? 'prev' : 'next';
          this.splitInstances[`counter-${counterName}`] = new SplitType(el, {
            types: 'chars',
            tagName: 'span'
          });
        }
      });
      
      // Set initial states - hide all except current
      this.worldHeadings.forEach((heading, i) => {
        if (i !== this.currentIndex) {
          heading.style.display = 'none';
        }
      });
      
      // Animate initial heading in
      this.animateTextIn(this.currentIndex);
    }

    animateTextIn(index, quickAnimation = false) {
      // Kill any active text animations to prevent conflicts
      if (this.textInTimeline) {
        this.textInTimeline.kill();
      }
      
      const headingSplit = this.splitInstances[`heading-${index}`];
      const textSplit = this.splitInstances[`text-${index}`];
      
      // Timeline for animations
      this.textInTimeline = gsap.timeline();
      
      // Make sure the heading is visible
      if (this.worldHeadings[index]) {
        this.worldHeadings[index].style.display = 'block';
      }
      
      // For quick animations, still run animations but make them faster
      const timescale = quickAnimation ? 1.5 : 1.0;
      this.textInTimeline.timeScale(timescale);
      
      // Animate heading chars
      if (headingSplit && headingSplit.chars) {
        this.textInTimeline.fromTo(headingSplit.chars, 
          { y: 40, opacity: 0 },
          { 
            y: 0, 
            opacity: 1, 
            duration: 0.6, 
            stagger: 0.03,
            ease: "power3.out" 
          }, 0);
      }
      
      // Animate text lines
      if (textSplit && textSplit.lines) {
        const lines = textSplit.lines;
        this.textInTimeline.fromTo(lines, 
          { y: 50 },
          { 
            y: 0, 
            duration: 0.7, 
            stagger: 0.05,
            ease: "power2.out" 
          }, 0.2);
      }
      
      return this.textInTimeline;
    }
    
    animateTextOut(index, quickAnimation = false) {
      // Kill any active text animations to prevent conflicts
      if (this.textOutTimeline) {
        this.textOutTimeline.kill();
      }
      
      const headingSplit = this.splitInstances[`heading-${index}`];
      const textSplit = this.splitInstances[`text-${index}`];
      
      this.textOutTimeline = gsap.timeline({
        onComplete: () => {
          // Hide the heading after animation completes
          if (this.worldHeadings[index]) {
            this.worldHeadings[index].style.display = 'none';
          }
        }
      });
      
      // For quick animations, still run animations but make them faster
      const timescale = quickAnimation ? 2.0 : 1.0;
      this.textOutTimeline.timeScale(timescale);
      
      // Animate heading chars out
      if (headingSplit && headingSplit.chars) {
        this.textOutTimeline.to(headingSplit.chars, { 
          y: -20, 
          opacity: 0, 
          duration: 0.4, 
          stagger: 0.02,
          ease: "power2.in" 
        }, 0);
      }
      
      // Animate text lines out
      if (textSplit && textSplit.lines) {
        const lines = textSplit.lines;
        this.textOutTimeline.to(lines, { 
          y: -30, 
          duration: 0.4, 
          stagger: 0.03,
          ease: "power2.in" 
        }, 0);
      }
      
      return this.textOutTimeline;
    }
    
    animateCounterUpdate(newIndex) {
      // Simply update the numbers without animation
      this.updateCounterNumbers(newIndex);
      return gsap.timeline(); // Return empty timeline to maintain compatibility
    }

    expoOut(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    initThree() {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
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
        height: '100%',
        zIndex: '-1'
      });

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.geometry = new THREE.PlaneGeometry(2, 2);
      
      // Create a placeholder material until the first texture is loaded
      this.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);

      const loader = new THREE.TextureLoader();
      this.loadedTextures = 0;
      
      // Promise-based texture loading to ensure we don't create the material until all textures are ready
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
      
      // When all textures are loaded, initialize the material properly
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
      
      // Initial render
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
      // Remove the mesh with placeholder material
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

    navigate(direction) {
      if (!this.allTexturesLoaded) return;
      
      // If we're performing rapid navigation, store the intent but don't block
      let nextIndex = (this.currentIndex + direction + this.totalSlides) % this.totalSlides;
      this.goTo(nextIndex, direction);
    }

    goTo(index, direction) {
      if (!this.allTexturesLoaded) return;
      
      // Check if we're in the middle of an animation
      const isRapidChange = this.masterTimeline && this.masterTimeline.isActive();
      
      // If we're in the middle of an animation and this is a different target index
      if (isRapidChange && this.pendingNavigation && this.pendingNavigation.index === index) {
        // Trying to go to the same index that's already pending, do nothing
        return;
      }
      
      // Store this navigation as pending
      this.pendingNavigation = { type: 'goTo', index: index, direction: direction };
      
      // If we're already animating, update the pending navigation but don't interrupt current animation
      // unless it's been more than 0.3 seconds
      if (isRapidChange && (this.masterTimeline.time() < 0.3)) {
        return;
      }
      
      // Kill any ongoing animations
      if (this.masterTimeline) {
        this.masterTimeline.kill();
      }
      if (this.textInTimeline) {
        this.textInTimeline.kill();
      }
      if (this.textOutTimeline) {
        this.textOutTimeline.kill();
      }
      
      // Store current index before updating
      const previousIndex = this.currentIndex;
      this.isAnimating = true;
      
      // Check if we're performing rapid clicks
      const isQuickClick = isRapidChange || this.pendingNavigation !== null;
      const transitionSpeed = isQuickClick ? this.fastTransitionDuration : this.transitionDuration;
      
      // Master timeline for coordinating animations
      this.masterTimeline = gsap.timeline({
        onComplete: () => {
          this.isAnimating = false;
          this.pendingNavigation = null;
        }
      });
      
      // Start animating out current text
      this.animateTextOut(previousIndex, isQuickClick);
      
      // Update counters immediately
      this.updateCounterNumbers(index);
      
      // Update current index early
      this.currentIndex = index;
      
      // Do WebGL transition
      if (this.imageTimeline) {
        this.imageTimeline.kill();
      }
      
      this.material.uniforms.fromTexture.value = this.textures[previousIndex] || this.textures[0];
      this.material.uniforms.toTexture.value = this.textures[index] || this.textures[0];
      this.material.uniforms.progress.value = 0;

      this.setPlaneSize(this.textures[index].image);
      
      // Image transition in parallel with text animations
      this.imageTimeline = gsap.to(this.material.uniforms.progress, {
        value: 1,
        duration: transitionSpeed,
        ease: "power2.inOut",
        onUpdate: () => {
          this.renderer.render(this.scene, this.camera);
        }
      });
      
      // Update active buttons and move navCorners simultaneously
      this.worldButtons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
        button.classList.toggle('is--active', i === index);
      });
      
      // Move navCorners to the active button
      if (this.navCorners) {
        const activeButton = this.worldButtons[index];
        if (this.cornerTimeline) {
          this.cornerTimeline.kill();
        }
        
        const state = Flip.getState(this.navCorners);
        activeButton.appendChild(this.navCorners);
        this.cornerTimeline = Flip.from(state, {
          duration: Math.min(0.3, transitionSpeed),
          ease: "power1.out"
        });
      }
      
      // Animate in new content after a short delay
      // Use setTimeout to ensure previous animations have started first
      setTimeout(() => {
        this.animateTextIn(index, isQuickClick);
      }, isQuickClick ? 100 : 300);
    }

    updateCounterNumbers(newIndex) {
      // Ensure elements exist before updating text content
      if (this.countHeading) this.countHeading.textContent = this.formatIndex(newIndex + 1);
      if (this.prevHeading) {
        const prevIndex = newIndex === 0 ? this.totalSlides - 1 : newIndex - 1;
        this.prevHeading.textContent = this.formatIndex(prevIndex + 1);
      }
      if (this.nextHeading) {
        const nextIndex = (newIndex + 1) % this.totalSlides;
        this.nextHeading.textContent = this.formatIndex(nextIndex + 1);
      }
      if (this.extraHeading) {
        const extraIndex = (newIndex + 2) % this.totalSlides;
        this.extraHeading.textContent = this.formatIndex(extraIndex + 1);
      }

      // Set opacities directly
      if (this.countHeading) this.countHeading.style.opacity = '1';
      if (this.prevHeading) this.prevHeading.style.opacity = '0.5';
      if (this.nextHeading) this.nextHeading.style.opacity = '0.5';
      if (this.extraHeading) this.extraHeading.style.opacity = '0.5';

      return gsap.timeline(); // Return empty timeline to maintain compatibility
    }

    updateContent(index, isInitial = false) {
      this.worldButtons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
        button.classList.toggle('is--active', i === index);
        
        // If initial load, move navCorners to active button
        if (isInitial && i === index && this.navCorners) {
          button.appendChild(this.navCorners);
        }
      });

      if (isInitial) {
        // Initial load - make sure everything is set up properly
        this.worldHeadings.forEach((heading, i) => {
          if (i === index) {
            heading.style.display = 'block';
          } else {
            heading.style.display = 'none';
          }
        });
        
        // Set initial counter numbers without animation
        this.updateCounterNumbers(index);
      }
    }

    formatIndex(index) {
      return index < 10 ? `0${index}` : `${index}`;
    }
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
