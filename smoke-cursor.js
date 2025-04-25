// Smoke cursor effect
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    
    // Apply styles to canvas
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    canvas.style.position = 'fixed';
    canvas.style.bottom = 'auto';
    canvas.style.left = '0';
    canvas.style.right = 'auto';
    canvas.style.top = '0';
    canvas.style.opacity = '0.3';
    canvas.style.pointerEvents = 'none'; // Ensure canvas doesn't interfere with page interactions
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Particle array
    let particles = [];
    const maxParticles = 50;

    // Mouse coordinates
    let mouse = {
        x: 0,
        y: 0
    };

    // Track mouse movement
    document.addEventListener('mousemove', function(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        
        // Create particles on mouse move
        for(let i = 0; i < 2; i++) {
            particles.push(new Particle());
        }
    });

    class Particle {
        constructor() {
            this.x = mouse.x;
            this.y = mouse.y;
            
            this.size = Math.random() * 15 + 5;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.life = 1;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.size > 0.3) this.size -= 0.1;
            this.life -= 0.01;
        }

        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.life})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }
        
        // Limit particles
        if (particles.length > maxParticles) {
            particles = particles.slice(particles.length - maxParticles);
        }
        
        requestAnimationFrame(animate);
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    animate();
}); 
