class SchefflerStars {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width = 800;
        this.height = canvas.height = 600;
        this.horizon = this.height / 2;
        this.center = { x: this.width / 2, y: this.horizon };
        
        // Default parameters
        this.rotationSpeed = 10; // degrees per second
        this.bgSpeed = 10; // pixels per second
        this.dotCount = 16;
        this.dotSize = 8;
        this.circleDiameter = 300;
        this.bgPattern = 'stars'; // Default background pattern
        
        // Background patterns
        this.bgStars = [];
        this.bgCracks = [];
        this.bgOffset = 0;
        
        // SVG pattern
        this.svgPattern = null;
        this.svgImage = new Image();
        this.svgImage.src = 'craquele_white.svg';
        this.svgImage.onload = () => {
            // Create pattern with repeat- to ensure vertical repetition
            this.svgPattern = this.ctx.createPattern(this.svgImage, 'repeat-y');
        };
        
        // Animation state
        this.rotationAngle = 0;
        this.lastTime = 0;
        
        this.init();
    }

    init() {
        // Generate background patterns
        // Stars
        for (let i = 0; i < 1000; i++) {
            this.bgStars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.horizon
            });
        }
        
        // Cracks
        const crackCount = 50; // Number of crack lines
        for (let i = 0; i < crackCount; i++) {
            // Random crack properties
            const startX = Math.random() * this.width;
            const startY = Math.random() * this.horizon;
            const length = 100 + Math.random() * 200; // Crack length
            const angle = Math.random() * Math.PI; // Crack angle
            const width = 1 + Math.random() * 2; // Crack width
            
            // Calculate crack points
            const endX = startX + Math.cos(angle) * length;
            const endY = startY + Math.sin(angle) * length;
            
            this.bgCracks.push({
                startX,
                startY,
                endX,
                endY,
                width
            });
        }
        
        // Set up event listeners with validation
        document.getElementById('rotationSpeed').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.rotationSpeed = !isNaN(value) ? value : this.rotationSpeed;
        });
        document.getElementById('bgSpeed').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bgSpeed = !isNaN(value) ? value : this.bgSpeed;
        });
        document.getElementById('dotCount').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.dotCount = !isNaN(value) ? value : this.dotCount;
        });
        document.getElementById('dotSize').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.dotSize = !isNaN(value) ? value : this.dotSize;
        });
        document.getElementById('circleDiameter').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.circleDiameter = !isNaN(value) ? value : this.circleDiameter;
        });
        document.getElementById('bgPattern').addEventListener('change', (e) => {
            this.bgPattern = e.target.value;
        });
        
        // Start animation
        requestAnimationFrame(() => this.animate(0));
    }

    animate(timestamp) {
        if (this.lastTime === 0) {
            this.lastTime = timestamp;
        }
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        // Update rotation
        this.rotationAngle += (this.rotationSpeed * deltaTime) / 1000;
        
        // Update background offset
        this.bgOffset += (this.bgSpeed * deltaTime) / 1000;
        
        this.draw();
        requestAnimationFrame(this.animate.bind(this));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw background pattern
        if (this.bgPattern === 'stars') {
            // Draw stars
            this.ctx.fillStyle = '#fff';
            for (const star of this.bgStars) {
                const y = (star.y + this.bgOffset + this.horizon) % this.horizon;
                if (y < 0) {
                    this.ctx.rect(star.x, y + this.horizon, 1, 1);
                } else {
                    this.ctx.rect(star.x, y, 1, 1);
                }
            }
            this.ctx.fill();
        } else if (this.bgPattern === 'svg') {
            // Draw SVG pattern with movement and clipping
            if (this.svgPattern) {
                // Save context
                this.ctx.save();
                
                // Create clipping path above horizon
                this.ctx.beginPath();
                this.ctx.moveTo(0, this.horizon);
                this.ctx.lineTo(this.width, this.horizon);
                this.ctx.lineTo(this.width, 0);
                this.ctx.lineTo(0, 0);
                this.ctx.closePath();
                this.ctx.clip();
                
                // Calculate pattern dimensions
                const patternWidth = this.svgImage.width;
                const patternHeight = this.svgImage.height;
                
                // Draw multiple copies of the pattern to create a seamless background
                for (let x = -patternWidth; x < this.width + patternWidth; x += patternWidth) {
                    for (let y = -patternHeight; y < this.horizon + patternHeight; y += patternHeight) {
                        // Save context for each pattern piece
                        this.ctx.save();
                        
                        // Move pattern piece based on background offset
                        this.ctx.translate(0, this.bgOffset);
                        
                        // Draw pattern piece
                        this.ctx.drawImage(this.svgImage, x, y);
                        
                        // Restore context for this piece
                        this.ctx.restore();
                    }
                }
                
                // Restore main context
                this.ctx.restore();
            } else {
                // If pattern isn't loaded yet, draw a temporary white background
                this.ctx.fillStyle = '#fff';
                this.ctx.fillRect(0, 0, this.width, this.horizon);
            }
        } else {
            // Draw cracked pattern
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            
            // Save context before clipping
            this.ctx.save();
            
            // Create clipping path above horizon
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.horizon);
            this.ctx.lineTo(this.width, this.horizon);
            this.ctx.lineTo(this.width, 0);
            this.ctx.lineTo(0, 0);
            this.ctx.closePath();
            this.ctx.clip();
            
            // Draw crack segments with proper handling of edge cases
            for (const crack of this.bgCracks) {
                // Calculate crack positions
                let startY = crack.startY + this.bgOffset + this.horizon;
                let endY = crack.endY + this.bgOffset + this.horizon;

                // Handle negative values
                startY = startY % this.horizon;
                endY = endY % this.horizon;
                
                // Handle wrapping
                if (Math.max(startY, endY) < 0) {
                    this.ctx.moveTo(crack.startX, startY + this.horizon);
                    this.ctx.lineTo(crack.endX, endY + this.horizon);
                }
                
                // Draw crack segment
                this.ctx.moveTo(crack.startX, startY);
                this.ctx.lineTo(crack.endX, endY);
            }
            
            // Restore context
            this.ctx.restore();
            this.ctx.stroke();
        }
        
        // Draw horizon line
        this.ctx.strokeStyle = '#444';
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.horizon);
        this.ctx.lineTo(this.width, this.horizon);
        this.ctx.stroke();
        
        // Create clipping path above horizon for dots
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.horizon);
        this.ctx.lineTo(this.width, this.horizon);
        this.ctx.lineTo(this.width, 0);
        this.ctx.lineTo(0, 0);
        this.ctx.closePath();
        this.ctx.clip();
        
        // Draw rotating dots
        this.ctx.fillStyle = '#fff';
        for (let i = 0; i < this.dotCount; i++) {
            const angle = (i / this.dotCount) * 360 + this.rotationAngle;
            const rad = angle * Math.PI / 180;
            
            // Calculate dot position
            const x = this.center.x + Math.cos(rad) * (this.circleDiameter / 2);
            const y = this.center.y + Math.sin(rad) * (this.circleDiameter / 2);
            
            // Skip dots that would be drawn below the horizon
            if (y > this.horizon) continue;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.dotSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Restore context
        this.ctx.restore();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('starsCanvas');
    new SchefflerStars(canvas);
});
