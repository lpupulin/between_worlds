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
        if (img) this.images.push(img.src);
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

      const stickyWrapper = document.querySelector('.gallery-sticky');
      if (stickyWrapper) {
        stickyWrapper.appendChild(this.renderer.domElement);
      } else {
        console.warn('WebGLSlider: .gallery-sticky not found, appending to container as fallback.');
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
      const promises = this.images.map((src, i) => new Promise(res => {
        loader.load(src, (tex) => {
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          tex.generateMipmaps = false;
          tex.needsUpdate = true;
          this.textures[i] = tex;
          res();
        });
      }));

      Promise.all(promises).then(() => {
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

    setPlaneSize(image) {
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

    navigate(direction) {
      if (!this.allTexturesLoaded) return;
      const nextIndex = (this.currentIndex + direction + this.totalSlides) % this.totalSlides;
      this.goTo(nextIndex, direction);
    }

    goTo(index, direction) {
      if (!this.allTexturesLoaded) return;
      if (this.masterTimeline) this.masterTimeline.kill();

      const prevIndex = this.currentIndex;
      const quick = !!this.pendingNavigation;
      const speed = quick ? this.fastTransitionDuration : this.transitionDuration;

      this.pendingNavigation = { index, direction };
      this.currentIndex = index;

      this.animateTextOut(prevIndex, quick);
      this.updateCounterNumbers(index);

      this.material.uniforms.fromTexture.value = this.textures[prevIndex];
      this.material.uniforms.toTexture.value = this.textures[index];
      this.material.uniforms.progress.value = 0;

      this.setPlaneSize(this.textures[index].image);

      gsap.to(this.material.uniforms.progress, {
        value: 1,
        duration: speed,
        ease: 'power2.inOut',
        onUpdate: () => this.renderer.render(this.scene, this.camera)
      });

      this.worldButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
        btn.classList.toggle('is--active', i === index);
      });

      if (this.navCorners) {
        const activeButton = this.worldButtons[index];
        const state = Flip.getState(this.navCorners);
        activeButton.appendChild(this.navCorners);
        Flip.from(state, {
          duration: Math.min(0.3, speed),
          ease: 'power1.out'
        });
      }

      setTimeout(() => this.animateTextIn(index, quick), quick ? 100 : 300);
    }

    animateTextIn(index, quick = false) {
      if (this.textInTimeline) this.textInTimeline.kill();
      const heading = this.worldHeadings[index];
      if (heading) heading.style.display = 'block';
      const split = this.splitInstances[`heading-${index}`];
      const text = this.splitInstances[`text-${index}`];

      this.textInTimeline = gsap.timeline({ timeScale: quick ? 1.5 : 1.0 });
      if (split?.chars) {
        this.textInTimeline.fromTo(split.chars, { y: 40, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.6, stagger: 0.03, ease: 'power3.out'
        }, 0);
      }
      if (text?.lines) {
        this.textInTimeline.fromTo(text.lines, { y: 50 }, {
          y: 0, duration: 0.7, stagger: 0.05, ease: 'power2.out'
        }, 0.2);
      }
    }

    animateTextOut(index, quick = false) {
      if (this.textOutTimeline) this.textOutTimeline.kill();
      const heading = this.worldHeadings[index];
      const split = this.splitInstances[`heading-${index}`];
      const text = this.splitInstances[`text-${index}`];

      this.textOutTimeline = gsap.timeline({
        timeScale: quick ? 2 : 1,
        onComplete: () => { if (heading) heading.style.display = 'none'; }
      });
      if (split?.chars) {
        this.textOutTimeline.to(split.chars, {
          y: -20, opacity: 0, duration: 0.4, stagger: 0.02, ease: 'power2.in'
        }, 0);
      }
      if (text?.lines) {
        this.textOutTimeline.to(text.lines, {
          y: -30, duration: 0.4, stagger: 0.03, ease: 'power2.in'
        }, 0);
      }
    }

    updateCounterNumbers(index) {
      const format = (i) => (i < 9 ? `0${i + 1}` : `${i + 1}`);
      const total = this.totalSlides;
      if (this.countHeading) this.countHeading.textContent = format(index);
      if (this.prevHeading) this.prevHeading.textContent = format((index - 1 + total) % total);
      if (this.nextHeading) this.nextHeading.textContent = format((index + 1) % total);
      if (this.extraHeading) this.extraHeading.textContent = format((index + 2) % total);
    }

    initTextSplitting() {
      if (typeof gsap === 'undefined' || typeof SplitType === 'undefined') {
        console.error('GSAP or SplitType not found');
        return;
      }

      this.worldHeadings.forEach((el, i) => {
        const heading = el.querySelector('.world_heading');
        const wrap = el.querySelector('.text-wrap');
        if (heading) {
          this.splitInstances[`heading-${i}`] = new SplitType(heading, {
            types: 'chars,words', tagName: 'span'
          });
        }
        if (wrap) {
          const split = new SplitType(wrap, {
            types: 'lines', tagName: 'span'
          });
          this.splitInstances[`text-${i}`] = split;
          gsap.set(split.lines, { overflow: 'hidden' });
          split.lines.forEach(line => {
            const wrapper = document.createElement('div');
            wrapper.className = 'line-wrapper';
            wrapper.style.overflow = 'hidden';
            line.parentNode.insertBefore(wrapper, line);
            wrapper.appendChild(line);
          });
        }
      });

      this.worldHeadings.forEach((el, i) => {
        if (i !== this.currentIndex) el.style.display = 'none';
      });

      this.animateTextIn(this.currentIndex);
    }

    setupNavCorners() {
      if (!this.navCorners || !this.worldButtons.length) return;
      this.worldButtons[0].classList.add('is--active');
      this.worldButtons[0].appendChild(this.navCorners);

      this.worldButtons.forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          if (this.cornerTimeline) this.cornerTimeline.kill();
          const state = Flip.getState(this.navCorners);
          btn.appendChild(this.navCorners);
          this.cornerTimeline = Flip.from(state, { duration: 0.3, ease: 'power1.out' });
        });

        btn.addEventListener('mouseleave', () => {
          const active = document.querySelector('.button.is--active');
          if (!active) return;
          const state = Flip.getState(this.navCorners);
          active.appendChild(this.navCorners);
          this.cornerTimeline = Flip.from(state, { duration: 0.3, ease: 'power1.out' });
        });
      });
    }

    updateContent(index, isInitial = false) {
      this.worldButtons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
        button.classList.toggle('is--active', i === index);
        if (isInitial && i === index && this.navCorners) {
          button.appendChild(this.navCorners);
        }
      });

      if (isInitial) {
        this.worldHeadings.forEach((heading, i) => {
          heading.style.display = i === index ? 'block' : 'none';
        });
        this.updateCounterNumbers(index);
      }
    }
  }

  try {
    if (typeof THREE !== 'undefined' && typeof Flip !== 'undefined') {
      new WebGLSlider();
    } else {
      if (typeof THREE === 'undefined') {
        console.error('WebGL Slider: Three.js not loaded');
      }
      if (typeof Flip === 'undefined') {
        console.error('WebGL Slider: GSAP Flip plugin not loaded');
      }
    }
  } catch (error) {
    console.error('WebGL Slider: Error initializing slider', error);
  }
});
