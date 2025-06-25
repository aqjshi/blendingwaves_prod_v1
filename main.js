/**
 * Main application namespace for the liquid displacement effect.
 * This helps to avoid polluting the global scope.
 * @namespace LIQUID_HERO
 */
const LIQUID_HERO = {};

// --- UTILITY FUNCTIONS ---

/**
 * Scrolls the page smoothly to the element with the ID 'services'.
 */
function scrollDown() {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Manages the visibility of a fixed header based on scroll direction.
 * @param {HTMLElement} header The header element to control.
 */
function manageHeaderVisibility(header) {
    if (!header) return;

    let lastScrollY = window.scrollY;
    const updateHeader = () => {
        const currentScrollY = window.scrollY;
        // Hide header only if scrolling down and past its own height
        if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) {
            header.classList.add('hidden');
        } else {
            header.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', updateHeader);
}

// --- MAIN INITIALIZATION ---

/**
 * Initializes the entire application after the DOM is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the dynamic header
    manageHeaderVisibility(document.querySelector('.header-container'));

    // Find the canvas and initialize the WebGL liquid effect
    const canvas = document.getElementById('interactive-liquid-canvas');
    if (canvas && typeof THREE !== 'undefined') {
        LIQUID_HERO.init(canvas);
    } else {
        console.error("The canvas element #interactive-liquid-canvas or the THREE.js library was not found.");
        // Optionally add a fallback class if WebGL fails to initialize
        document.body.classList.add('webgl-failed');
    }
});


/**
 * Initializes the Three.js scene and liquid simulation.
 * @param {HTMLCanvasElement} canvas The canvas element for rendering.
 */
LIQUID_HERO.init = function(canvas) {

    // --- Scene, Camera, and Renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // --- Textures ---
    const textureLoader = new THREE.TextureLoader();
    const topTexture = textureLoader.load('/static/images/pond_top.jpg');
    const bottomTexture = textureLoader.load('/static/images/pond_bottom.jpg');

    // --- Mouse Tracking & State ---
    // We track the mouse position relative to the canvas for accuracy
    const mouse = new THREE.Vector2(-1, -1);
    const lastMouse = new THREE.Vector2(-1, -1);
    const mouseVelocity = new THREE.Vector2(0, 0);
    
    // --- FIX: Correct mouse tracking relative to the canvas element ---
    const updateMousePosition = (event) => {
        const rect = canvas.getBoundingClientRect();
        // Calculate the mouse position relative to the canvas dimensions
        mouse.x = (event.clientX - rect.left) / rect.width;
        mouse.y = 1.0 - ((event.clientY - rect.top) / rect.height);
    };
    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('touchmove', (event) => {
        if (event.touches.length > 0) {
            updateMousePosition(event.touches[0]);
        }
    });

    // --- Off-screen Render Targets for Displacement Physics (Ping-Pong Buffers) ---
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    let currentRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.FloatType });
    let previousRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.FloatType });

    // --- Shaders ---
    // This shader updates the displacement map each frame based on mouse movement
    const displacementUpdateMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uLastFrame: { value: previousRenderTarget.texture },
            uMousePos: { value: mouse },
            uMouseVelocity: { value: mouseVelocity },
            uResolution: { value: new THREE.Vector2(size.x, size.y) }
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `
            uniform sampler2D uLastFrame;
            uniform vec2 uMousePos;
            uniform vec2 uMouseVelocity;
            uniform vec2 uResolution;
            varying vec2 vUv;

            void main() {
                // Get the displacement from the last frame and apply damping (fades over time)
                vec4 lastDisp = texture2D(uLastFrame, vUv) * 0.95;

                // Create a "brush" for the mouse with an aspect-ratio corrected radius
                float aspectRatio = uResolution.x / uResolution.y;
                vec2 correctedUv = vec2(vUv.x * aspectRatio, vUv.y);
                vec2 correctedMouse = vec2(uMousePos.x * aspectRatio, uMousePos.y);
                float dist = distance(correctedUv, correctedMouse);
                float radius = 0.2; // Radius of the "spoon"
                float strength = smoothstep(radius, 0.0, dist);

                // Add the brush to the displacement, driven by mouse velocity for a natural feel
                lastDisp.rg += uMouseVelocity * strength * 2.5;

                gl_FragColor = lastDisp;
            }
        `
    });

    // This shader renders the final scene, using the displacement map to warp the images
    const finalRenderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uDisplacementMap: { value: currentRenderTarget.texture },
            uTopTexture: { value: topTexture },
            uBottomTexture: { value: bottomTexture },
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `
            uniform sampler2D uDisplacementMap;
            uniform sampler2D uTopTexture;
            uniform sampler2D uBottomTexture;
            varying vec2 vUv;

            void main() {
                vec2 displacement = texture2D(uDisplacementMap, vUv).rg;

                // Displace top layer significantly
                vec2 topUV = vUv + displacement * 0.1;
                vec4 topColor = texture2D(uTopTexture, topUV);

                // Displace bottom layer less for a parallax/depth effect
                vec2 bottomUV = vUv + displacement * 0.05; // 50% of top displacement
                vec4 bottomColor = texture2D(uBottomTexture, bottomUV);
                bottomColor.rgb *= 0.2; // Apply 40% black shade

                // Blend the layers. Make top layer more transparent where it's displaced.
                float displacementAmount = length(displacement);
                topColor.a = smoothstep(0.1, 0.0, displacementAmount);
                
                // Final mix based on the top layer's transparency
                gl_FragColor = mix(bottomColor, topColor, topColor.a);
            }
        `
    });

    // --- Scene Setup ---
    const fullScreenQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(fullScreenQuad);

    // --- Animation Loop ---
    const animate = () => {
        requestAnimationFrame(animate);

        // Update mouse velocity (how fast the mouse is moving)
        mouseVelocity.copy(mouse).sub(lastMouse);
        lastMouse.copy(mouse);

        // --- Render Pass 1: Update the displacement map ---
        fullScreenQuad.material = displacementUpdateMaterial;
        renderer.setRenderTarget(currentRenderTarget);
        renderer.render(scene, camera);

        // --- Render Pass 2: Render the final scene to the screen ---
        fullScreenQuad.material = finalRenderMaterial;
        renderer.setRenderTarget(null); 
        renderer.render(scene, camera);

        // --- Swap render targets for the next frame (Ping-Pong) ---
        const temp = previousRenderTarget;
        previousRenderTarget = currentRenderTarget;
        currentRenderTarget = temp;
        // Update uniforms with the new textures
        displacementUpdateMaterial.uniforms.uLastFrame.value = previousRenderTarget.texture;
        finalRenderMaterial.uniforms.uDisplacementMap.value = currentRenderTarget.texture;
    };

    // --- Event Handler for Window Resize ---
    const onWindowResize = () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        renderer.setSize(newWidth, newHeight);
        currentRenderTarget.setSize(newWidth, newHeight);
        previousRenderTarget.setSize(newWidth, newHeight);
        displacementUpdateMaterial.uniforms.uResolution.value.set(newWidth, newHeight);
    };
    window.addEventListener('resize', onWindowResize);

    // Start the animation
    animate();
};
