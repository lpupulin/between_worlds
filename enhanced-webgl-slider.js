document.addEventListener('DOMContentLoaded', () => {
  class WebGLSlider {
    constructor() {
      this.container = document.querySelector('.section.is-gallery');
      this.imageElement = document.querySelector('.autumn');
      this.leftArrow = document.querySelector('.btn_arrow_wrap.is-left');
      this.rightArrow = document.querySelector('.btn_arrow_wrap.is-right');
      this.worldButtons = document.querySelectorAll('.button');
      this.countHeading = document.querySelector('.count-heading.current') || null;
      this.prevHeading = document.querySelector('.count-heading.is-2') || null;
      this.nextHeading = document.querySelector('.count-heading.is-3') || null;
      this.extraHeading = document.querySelector('.count-heading.is-4') || null;
      this.worldHeadings = document.querySelectorAll('.world_heading-wrap');

      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.isAnimating = false;
      this.transitionDuration = 0.8;
      this.transitionStrength = 0.1;
      this.imageScale = 0.4; // Easily control image size (0.0 - 1.0)
      this.allTexturesLoaded = false;
      
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
      this.updateContent(0, true); // true for initial load
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

    animateTextIn(index) {
      const headingSplit = this.splitInstances[`heading-${index}`];
      const textSplit = this.splitInstances[`text-${index}`];
      
      // Timeline for animations
      const tl = gsap.timeline();
      
      // Animate heading chars
      if (headingSplit && headingSplit.chars) {
        tl.fromTo(headingSplit.chars, 
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
        tl.fromTo(lines, 
          { y: 50 },
          { 
            y: 0, 
            duration: 0.7, 
            stagger: 0.05,
            ease: "power2.out" 
          }, 0.2);
      }
      
      return tl;
    }
    
    animateTextOut(index) {
      const headingSplit = this.splitInstances[`heading-${index}`];
      const textSplit = this.splitInstances[`text-${index}`];
      
      const tl = gsap.timeline();
      
      // Animate heading chars out
      if (headingSplit && headingSplit.chars) {
        tl.to(headingSplit.chars, { 
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
        tl.to(lines, { 
          y: -30, 
          duration: 0.4, 
          stagger: 0.03,
          ease: "power2.in" 
        }, 0);
      }
      
      return tl;
    }
    
    animateCounterUpdate(newIndex) {
      // Get the current, previous and next instances
      const currentSplit = this.splitInstances['counter-current'];
      const prevSplit = this.splitInstances['counter-prev'];
      const nextSplit = this.splitInstances['counter-next'];
      
      // Update text content first
      this.updateCounterNumbers(newIndex);
      
      // Create animation timeline
      const tl = gsap.timeline();
      
      // Animate the numbers
      if (currentSplit && currentSplit.chars) {
        tl.fromTo(currentSplit.chars, 
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: "back.out" },
          0);
      }
      
      if (prevSplit && prevSplit.chars) {
        tl.fromTo(prevSplit.chars, 
          { y: 10, opacity: 0 },
          { y: 0, opacity: 0.7, duration: 0.5, stagger: 0.05, ease: "power2.out" },
          0.1);
      }
      
      if (nextSplit && nextSplit.chars) {
        tl.fromTo(nextSplit.chars, 
          { y: 10, opacity: 0 },
          { y: 0, opacity: 0.7, duration: 0.5, stagger: 0.05, ease: "power2.out" },
          0.1);
      }
      
      return tl;
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
      
      // When the first texture is loaded, initialize the material properly
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
          if (this.currentIndex !== index && !this.isAnimating) {
            const direction = index > this.currentIndex ? 1 : -1;
            this.goTo(index, direction);
          }
        });
      });
    }

    navigate(direction) {
      if (this.isAnimating || !this.allTexturesLoaded) return;
      let nextIndex = (this.currentIndex + direction + this.totalSlides) % this.totalSlides;
      this.goTo(nextIndex, direction);
    }

    goTo(index, direction) {
      if (this.isAnimating || !this.allTexturesLoaded) return;
      this.isAnimating = true;
      
      // Store current index before updating
      const previousIndex = this.currentIndex;

      // Timeline for all animations
      const masterTimeline = gsap.timeline({
        onComplete: () => {
          this.isAnimating = false;
        }
      });

      // Start by animating out the current text
      masterTimeline.add(this.animateTextOut(previousIndex))
      
      // Update counters with animation
      masterTimeline.add(this.animateCounterUpdate(index), "<0.3")
      
      // Handle image transition
      this.material.uniforms.fromTexture.value = this.textures[this.currentIndex] || this.textures[0];
      this.material.uniforms.toTexture.value = this.textures[index] || this.textures[0];
      this.material.uniforms.progress.value = 0;

      this.setPlaneSize(this.textures[index].image);
      
      // Image transition timeline
      masterTimeline.to(this.material.uniforms.progress, {
        value: 1,
        duration: this.transitionDuration,
        ease: "power2.inOut",
        onUpdate: () => {
          this.renderer.render(this.scene, this.camera);
        }
      }, "<0.1");
      
      // Update current index
      this.currentIndex = index;
      
      // Hide previous content, show new content
      this.worldHeadings.forEach((heading, i) => {
        if (i === index) {
          heading.style.display = 'block';
        } else if (i === previousIndex) {
          // Keep old content visible until animation is done
          masterTimeline.call(() => {
            heading.style.display = 'none';
          }, null, null, ">-0.1");
        }
      });
      
      // Update active buttons
      this.worldButtons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
      });
      
      // Animate in new content
      masterTimeline.add(this.animateTextIn(index), "<0.4");
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

      // Re-split text after changing content
      const counterElements = [
        { el: this.countHeading, name: 'current' },
        { el: this.prevHeading, name: 'is-2' },
        { el: this.nextHeading, name: 'is-3' },
        { el: this.extraHeading, name: 'is-4' }
      ];

      counterElements.forEach(item => {
        if (item.el && this.splitInstances[`counter-${item.name}`]) {
          // Revert the split if possible (SplitType has a revert method similar to SplitText)
          if (typeof this.splitInstances[`counter-${item.name}`].revert === 'function') {
            this.splitInstances[`counter-${item.name}`].revert();
          }

          // Re-split with new content
          this.splitInstances[`counter-${item.name}`] = new SplitType(item.el, {
            types: 'chars',
            tagName: 'span'
          });
        }
      });

      // Update visibility and animation states
      if (this.countHeading) this.countHeading.style.opacity = 1;
      if (this.prevHeading) this.prevHeading.style.opacity = 0.5;
      if (this.nextHeading) this.nextHeading.style.opacity = 0.5;
      if (this.extraHeading) this.extraHeading.style.opacity = 0.5;

      gsap.to(this.countHeading, { opacity: 1, duration: 0.5, ease: "power2.out" });
      gsap.to(this.prevHeading, { opacity: 0.5, duration: 0.5, ease: "power2.out" });
      gsap.to(this.nextHeading, { opacity: 0.5, duration: 0.5, ease: "power2.out" });
      gsap.to(this.extraHeading, { opacity: 0.5, duration: 0.5, ease: "power2.out" });
    }

    updateContent(index, isInitial = false) {
      this.worldButtons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
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
    if (typeof THREE !== 'undefined') {
      new WebGLSlider();
    } else {
      console.error('WebGL Slider: Three.js library not loaded');
    }
  } catch (error) {
    console.error('WebGL Slider: Error initializing slider', error);
  }
});
