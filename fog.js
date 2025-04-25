class FogParticle {
    constructor(ctx, canvasWidth, canvasHeight) {
        this.ctx = ctx;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.x = 0;
        this.y = 0;
        this.opacity = 1;
        this.scale = 1;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.image = null;
        // Track lifetime for smooth transitions
        this.lifetime = 0;
        this.maxLifetime = Math.random() * 60000 + 60000; // 60-120 seconds
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    setVelocity(x, y) {
        this.xVelocity = x;
        this.yVelocity = y;
    }
    
    setImage(image) {
        this.image = image;
    }
    
    setOpacity(opacity) {
        this.opacity = opacity;
    }
    
    setScale(scale) {
        this.scale = scale;
    }
    
    render(deltaTime, globalOpacity) {
        if (!this.image) return;
        
        // Update lifetime
        this.lifetime += deltaTime;
        
        // Apply combined opacity
        this.ctx.globalAlpha = this.opacity * globalOpacity;
        
        // Calculate size based on scale
        const size = 400 * this.scale;
        const halfSize = size / 2;
        
        this.ctx.drawImage(
            this.image,
            this.x - halfSize,
            this.y - halfSize,
            size,
            size
        );
        
        // Use deltaTime to make movement consistent regardless of frame rate
        const timeScale = deltaTime / 16.67; // Normalize to ~60fps
        
        this.x += this.xVelocity * timeScale;
        this.y += this.yVelocity * timeScale;
        
        // Instead of wrapping or bouncing, gradually reposition particles
        // that move far off-screen to maintain fog consistency
        const bufferZone = size * 1.5;
        
        if (this.x < -bufferZone || 
            this.x > this.canvasWidth + bufferZone || 
            this.y < -bufferZone || 
            this.y > this.canvasHeight + bufferZone || 
            this.lifetime > this.maxLifetime) {
            
            // Reset lifetime
            this.lifetime = 0;
            this.maxLifetime = Math.random() * 60000 + 60000;
            
            // Reposition particle on the opposite side with slight randomization
            // This creates a more continuous fog effect
            if (this.x < -bufferZone) {
                this.x = this.canvasWidth + Math.random() * 100;
                this.y = Math.random() * this.canvasHeight;
            } else if (this.x > this.canvasWidth + bufferZone) {
                this.x = -100 - Math.random() * 100;
                this.y = Math.random() * this.canvasHeight;
            } else if (this.y < -bufferZone) {
                this.y = this.canvasHeight + Math.random() * 100;
                this.x = Math.random() * this.canvasWidth;
            } else if (this.y > this.canvasHeight + bufferZone) {
                this.y = -100 - Math.random() * 100;
                this.x = Math.random() * this.canvasWidth;
            } else {
                // Reposition to a random edge
                const edge = Math.floor(Math.random() * 4);
                switch (edge) {
                    case 0: // top
                        this.x = Math.random() * this.canvasWidth;
                        this.y = -100 - Math.random() * 100;
                        break;
                    case 1: // right
                        this.x = this.canvasWidth + Math.random() * 100;
                        this.y = Math.random() * this.canvasHeight;
                        break;
                    case 2: // bottom
                        this.x = Math.random() * this.canvasWidth;
                        this.y = this.canvasHeight + Math.random() * 100;
                        break;
                    case 3: // left
                        this.x = -100 - Math.random() * 100;
                        this.y = Math.random() * this.canvasHeight;
                        break;
                }
            }
            
            // Slightly adjust velocity for variation
            this.xVelocity *= 0.8 + Math.random() * 0.4; // 80-120% of original
            this.yVelocity *= 0.8 + Math.random() * 0.4;
        }
    }
}

class Fog {
    constructor({ 
        selector, 
        density = 50, 
        velocity = 0.7, // Slower default velocity for more cohesive look
        particle, 
        opacity = 1,
        variableSize = true,
        layeredOpacity = true
    } = {}) {
        this.canvas = document.querySelector(selector);
        const bcr = this.canvas.parentElement.getBoundingClientRect();
        this.ctx = this.canvas.getContext("2d", { alpha: true });
        this.canvasWidth = this.canvas.width = bcr.width;
        this.canvasHeight = this.canvas.height = bcr.height;
        this.particleCount = density;
        this.maxVelocity = velocity;
        this.particle = particle;
        this.opacity = opacity;
        this.variableSize = variableSize;
        this.layeredOpacity = layeredOpacity;
        this.lastTimestamp = 0;
        this.particles = [];
        this.imageLoaded = false;
        
        // Store original size for responsive adjustments
        this.originalWidth = this.canvasWidth;
        this.originalHeight = this.canvasHeight;
        
        // Set blending mode for more cohesive fog
        this.ctx.globalCompositeOperation = "lighter";
        
        // Pre-allocate particles and load image
        this._createParticles();
        this._loadImage();
        
        // Optimize resize handling with debounce
        this.resizeTimeout = null;
        window.addEventListener('resize', this._handleResizeDebounced.bind(this));
        
        // Start animation
        this.animationId = requestAnimationFrame(this._render.bind(this));
    }
    
    _createParticles() {
        this.particles = new Array(this.particleCount);
        
        // Create particles with varied attributes for a layered effect
        for (let i = 0; i < this.particleCount; i++) {
            const particle = new FogParticle(
                this.ctx,
                this.canvasWidth,
                this.canvasHeight
            );
            
            // Position particles throughout the entire canvas
            // with some beyond the edges for smooth transitions
            const extendedX = this.canvasWidth * 1.2;
            const extendedY = this.canvasHeight * 1.2;
            const offsetX = -this.canvasWidth * 0.1;
            const offsetY = -this.canvasHeight * 0.1;
            
            particle.setPosition(
                offsetX + Math.random() * extendedX,
                offsetY + Math.random() * extendedY
            );
            
            // Assign size-dependent velocities (larger particles move slower)
            let scale;
            if (this.variableSize) {
                // Create 3 distinct size layers for depth
                const sizeLayer = Math.floor(Math.random() * 3);
                switch (sizeLayer) {
                    case 0: // small background particles
                        scale = 0.5 + Math.random() * 0.3;
                        break;
                    case 1: // medium middle particles
                        scale = 0.8 + Math.random() * 0.3;
                        break;
                    case 2: // large foreground particles
                        scale = 1.1 + Math.random() * 0.3;
                        break;
                }
            } else {
                scale = 1.0;
            }
            
            particle.setScale(scale);
            
            // Slower velocity for larger particles
            const velocityScale = 1.5 - scale;
            particle.setVelocity(
                (Math.random() * 2 - 1) * this.maxVelocity * velocityScale,
                (Math.random() * 2 - 1) * this.maxVelocity * velocityScale
            );
            
            // Layered opacity based on size for depth effect
            if (this.layeredOpacity) {
                // Larger particles are more opaque
                const baseOpacity = 0.4 + Math.min(0.6, scale * 0.4);
                particle.setOpacity(baseOpacity);
            } else {
                particle.setOpacity(0.6 + Math.random() * 0.4);
            }
            
            this.particles[i] = particle;
        }
    }
    
    _loadImage() {
        if (!this.particle) return;
        
        // Use cached image if available
        if (!Fog.cachedImages) {
            Fog.cachedImages = {};
        }
        
        if (Fog.cachedImages[this.particle]) {
            this._setImageToParticles(Fog.cachedImages[this.particle]);
            this.imageLoaded = true;
        } else {
            const img = new Image();
            img.onload = () => {
                Fog.cachedImages[this.particle] = img;
                this._setImageToParticles(img);
                this.imageLoaded = true;
            };
            img.src = this.particle;
        }
    }
    
    _setImageToParticles(img) {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].setImage(img);
        }
    }
    
    _handleResizeDebounced() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(this._handleResize.bind(this), 200);
    }
    
    _handleResize() {
        const bcr = this.canvas.parentElement.getBoundingClientRect();
        const prevWidth = this.canvasWidth;
        const prevHeight = this.canvasHeight;
        
        this.canvasWidth = this.canvas.width = bcr.width;
        this.canvasHeight = this.canvas.height = bcr.height;
        
        // Scale particle positions proportionally
        const scaleX = this.canvasWidth / prevWidth;
        const scaleY = this.canvasHeight / prevHeight;
        
        this.particles.forEach(particle => {
            particle.x *= scaleX;
            particle.y *= scaleY;
            // Update canvas dimensions in particle
            particle.canvasWidth = this.canvasWidth;
            particle.canvasHeight = this.canvasHeight;
        });
    }
    
    _render(timestamp) {
        // Calculate delta time
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
        }
        const deltaTime = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        
        if (this.imageLoaded) {
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            
            // Single save operation for efficiency
            this.ctx.save();
            
            // Sort particles by scale for proper layering (paint smaller first)
            if (this.layeredOpacity && !this._particlesSorted) {
                this.particles.sort((a, b) => a.scale - b.scale);
                this._particlesSorted = true;
            }
            
            // Render all particles
            for (let i = 0; i < this.particles.length; i++) {
                this.particles[i].render(deltaTime, this.opacity);
            }
            
            this.ctx.restore();
        }
        
        this.animationId = requestAnimationFrame(this._render.bind(this));
    }
    
    // Public methods
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }
    
    setVelocity(velocity) {
        this.maxVelocity = velocity;
        // Update all particle velocities proportionally
        const ratio = velocity / this.maxVelocity;
        this.particles.forEach(p => {
            p.xVelocity *= ratio;
            p.yVelocity *= ratio;
        });
    }
    
    destroy() {
        cancelAnimationFrame(this.animationId);
        window.removeEventListener('resize', this._handleResizeDebounced);
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.particles = [];
    }
}

// Create cohesive fog effect
const fogEffect = new Fog({
    selector: "#fog",
    particle: "https://maciekmaciej.github.io/assets/fog-particle.png",
    density: 60,  // Increased for better coverage
    velocity: 0.8, // Slower for more cohesive movement
    opacity: 0.8,
    variableSize: true,
    layeredOpacity: true
});
