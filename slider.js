document.addEventListener('DOMContentLoaded', () => {
  class WebGLSlider {
    constructor() {
      this.container = document.querySelector('.section.is-gallery');
      this.imageElement = document.querySelector('.autumn');
      this.leftArrow = document.querySelector('.btn_arrow_wrap.is-left');
      this.rightArrow = document.querySelector('.btn_arrow_wrap.is-right');
      this.worldButtons = document.querySelectorAll('.button');
      this.countHeading = document.querySelector('.count-heading.is-1');
      this.prevHeading = document.querySelector('.count-heading.is-2');
      this.nextHeading = document.querySelector('.count-heading.is-3');
      this.extraHeading = document.querySelector('.count-heading.is-4');
      this.worldHeadings = document.querySelectorAll('.world_heading-wrap');
      this.navCorners = document.querySelector('.nav-corners');

      this.currentIndex = 0;
      this.totalSlides = this.worldButtons.length;
      this.images = [];
      this.textures = [];
      this.allTexturesLoaded = false;

      this.transitionDuration = 0.8;
      this.fastTransitionDuration = 0.4;
      this.transitionStrength = 0.1;
      this.imageScale = 0.35;

      this.masterTimeline = null;
      this.textInTimeline = null;
      this.textOutTimeline = null;
      this.cornerTimeline = null;
      this.imageTimeline = null;
      this.splitInstances = {};

      // Load images from buttons
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
      this.initTextSplitting();
      this.setupNavCorners();
      this.updateContent(this.currentIndex, true);
    }

    initTextSplitting() {
      if (typeof gsap === 'undefined' || typeof SplitType === 'undefined') return;

      this.worldHeadings.forEach((heading, index) => {
        const headingEl = heading.querySelector('.world_heading');
        const textWrap = heading.querySelector('.text-wrap');

        if (headingEl) {
          this.splitInstances[`heading-${index}`] = new SplitType(headingEl, {
            types: 'chars,words',
            tagName: 'span'
          });
        }

        if (textWrap) {
          this.splitInstances[`text-${index}`] = new SplitType(textWrap, {
            types: 'lines',
            tagName: 'span'
          });

          const lines = this.splitInstances[`text-${index}`].lines || [];
          gsap.set(lines, { overflow: 'hidden' });
          lines.forEach(line => {
            const wrapper = document.createElement('div');
            wrapper.className = 'line-wrapper';
            wrapper.style.overflow = 'hidden';
            line.parentNode.insertBefore(wrapper, line);
            wrapper.appendChild(line);
          });
        }
      });

      const counterEls = [this.countHeading, this.prevHeading, this.nextHeading, this.extraHeading];
      ['current', 'prev', 'next', 'extra'].forEach((name, i) => {
        const el = counterEls[i];
        if (el) {
          this.splitInstances[`counter-${name}`] = new SplitType(el, {
            types: 'chars',
            tagName: 'span'
          });
        }
      });

      this.worldHeadings.forEach((el, i) => {
        el.style.display = i === this.currentIndex ? 'block' : 'none';
      });

      this.animateTextIn(this.currentIndex);
    }

    animateTextIn(index, quick = false) {
      if (this.textInTimeline) this.textInTimeline.kill();
      const heading = this.splitInstances[`heading-${index}`];
      const text = this.splitInstances[`text-${index}`];

      this.textInTimeline = gsap.timeline();
      if (this.worldHeadings[index]) this.worldHeadings[index].style.display = 'block';
      const ts = quick ? 1.5 : 1.0;
      this.textInTimeline.timeScale(ts);

      if (heading?.chars) {
        this.textInTimeline.fromTo(heading.chars, { y: 40, opacity: 0 }, {
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
      const heading = this.splitInstances[`heading-${index}`];
      const text = this.splitInstances[`text-${index}`];

      this.textOutTimeline = gsap.timeline({
        onComplete: () => {
          if (this.worldHeadings[index]) this.worldHeadings[index].style.display = 'none';
        }
      });

      const ts = quick ? 2.0 : 1.0;
      this.textOutTimeline.timeScale(ts);

      if (heading?.chars) {
        this.textOutTimeline.to(heading.chars, {
          y: -20, opacity: 0, duration: 0.4, stagger: 0.02, ease: 'power2.in'
        }, 0);
      }

      if (text?.lines) {
        this.textOutTimeline.to(text.lines, {
          y: -30, duration: 0.4, stagger: 0.03, ease: 'power2.in'
        }, 0);
      }
    }

    setupNavCorners() {
      if (!this.navCorners) return;
      this.worldButtons[0]?.classList.add('is--active');
      this.worldButtons[0]?.appendChild(this.navCorners);

      this.worldButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          if (!this.navCorners) return;
          if (this.cornerTimeline) this.cornerTimeline.kill();
          const state = Flip.getState(this.navCorners);
          btn.appendChild(this.navCorners);
          this.cornerTimeline = Flip.from(state, {
            duration: 0.3,
            ease: 'power1.out'
          });
        });

        btn.addEventListener('mouseleave', () => {
          const active = document.querySelector('.button.is--active');
          if (!active || !this.navCorners) return;
          if (this.cornerTimeline) this.cornerTimeline.kill();
          const state = Flip.getState(this.navCorners);
          active.appendChild(this.navCorners);
          this.cornerTimeline = Flip.from(state, {
            duration: 0.3,
            ease: 'power1.out'
          });
        });
      });
    }

    setupEventListeners() {
      this.leftArrow.addEventListener('click', () => this.navigate(-1));
      this.rightArrow.addEventListener('click', () => this.navigate(1));
      this.worldButtons.forEach((btn, i) => {
        btn.addEventListener('click', () => {
          if (this.currentIndex !== i) {
            const dir = i > this.currentIndex ? 1 : -1;
            this.goTo(i, dir);
          }
        });
      });
    }

    navigate(direction) {
      if (!this.allTexturesLoaded) return;
      const next = (this.currentIndex + direction + this.totalSlides) % this.totalSlides;
      this.goTo(next, direction);
    }

    goTo(index, direction) {
      if (!this.allTexturesLoaded) return;
      const prev = this.currentIndex;
      const isQuick = this.masterTimeline && this.masterTimeline.isActive();
      const speed = isQuick ? this.fastTransitionDuration : this.transitionDuration;

      if (this.masterTimeline) this.masterTimeline.kill();
      if (this.textInTimeline) this.textInTimeline.kill();
      if (this.textOutTimeline) this.textOutTimeline.kill();

      this.masterTimeline = gsap.timeline({ onComplete: () => { } });

      this.animateTextOut(prev, isQuick);
      this.updateCounterNumbers(index);
      this.currentIndex = index;

      this.material.uniforms.fromTexture.value = this.textures[prev];
      this.material.uniforms.toTexture.value = this.textures[index];
      this.material.uniforms.progress.value = 0;
      this.setPlaneSize(this.textures[index].image);

      this.imageTimeline = gsap.to(this.material.uniforms.progress, {
        value: 1,
        duration: speed,
        ease: "power2.inOut",
        onUpdate: () => {
          this.renderer.render(this.scene, this.camera);
        }
      });

      this.worldButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
        btn.classList.toggle('is--active', i === index);
      });

      if (this.navCorners) {
        const active = this.worldButtons[index];
        if (this.cornerTimeline) this.cornerTimeline.kill();
        const state = Flip.getState(this.navCorners);
        active.appendChild(this.navCorners);
        this.cornerTimeline = Flip.from(state, {
          duration: Math.min(0.3, speed),
          ease: "power1.out"
        });
      }

      setTimeout(() => this.animateTextIn(index, isQuick), isQuick ? 100 : 300);
    }

    updateCounterNumbers(index) {
      const format = (i) => (i < 9 ? `0${i + 1}` : `${i + 1}`);
      const prev = index === 0 ? this.totalSlides - 1 : index - 1;
      const next = (index + 1) % this.totalSlides;
      const extra = (index + 2) % this.totalSlides;

      if (this.countHeading) this.countHeading.textContent = format(index);
      if (this.prevHeading) this.prevHeading.textContent = format(prev);
      if (this.nextHeading) this.nextHeading.textContent = format(next);
      if (this.extraHeading) this.extraHeading.textContent = format(extra);

      if (this.countHeading) this.countHeading.style.opacity = '1';
      if (this.prevHeading) this.prevHeading.style.opacity = '0.5';
      if (this.nextHeading) this.nextHeading.style.opacity = '0.5';
      if (this.extraHeading) this.extraHeading.style.opacity = '0.5';
    }

    updateContent(index, isInitial = false) {
      this.worldButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
        btn.classList.toggle('is--active', i === index);
        if (isInitial && i === index && this.navCorners) {
          btn.appendChild(this.navCorners);
        }
      });

      if (isInitial) {
        this.worldHeadings.forEach((el, i) => {
          el.style.display = i === index ? 'block' : 'none';
        });
        this.updateCounterNumbers(index);
      }
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

    setPlaneSize(image) {
      const imgAspect = image.width / image.height;
      const screenAspect = window.innerWidth / window.innerHeight;
      let width, height;

      if (imgAspect > screenAspect) {
        width = 2 * this.imageScale;
        height = (2 / imgAspect) * screenAspect * this.imageScale;
      } else {
        height = 2 * this.imageScale;
        width = (2 * imgAspect / screenAspect) * this.imageScale;
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
        vertexShader: `varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `varying vec2 vUv;
          uniform float progress;
          uniform float strength;
          uniform sampler2D fromTexture;
          uniform sampler2D toTexture;

          vec4 transition(vec2 p) {
            vec4 ca = texture2D(fromTexture, p);
            vec4 cb = texture2D(toTexture, p);
            vec2 oc = mix((ca.rg + ca.b) * 0.5, (cb.rg + cb.b) * 0.5, 0.5) * 2.0 - 1.0;
            float w0 = progress;
            float w1 = 1.0 - w0;
            return mix(texture2D(fromTexture, p + oc * w0 * strength), texture2D(toTexture, p - oc * w1 * strength), progress);
          }

          void main() {
            gl_FragColor = transition(vUv);
          }`,
        transparent: true
      });

      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);
    }
  }

  if (typeof THREE !== 'undefined' && typeof Flip !== 'undefined') {
    new WebGLSlider();
  } else {
    console.error('Missing THREE.js or Flip plugin');
  }
});
