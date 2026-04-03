/**
 * APP JS
 * Primary scripts for the app.
 */

// Scene ---------------------------------------------------------------------->
const container = document.getElementById('root');
const W = () => container.clientWidth, H = () => container.clientHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(85, W() / H(), 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W(), H());
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x55555));
const sun = new THREE.DirectionalLight(0xFFFFFF, 1);
sun.position.set(5, 5, 5);
scene.add(sun);

// Earth ---------------------------------------------------------------------->
const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshPhongMaterial({ 
        map:new THREE.TextureLoader().load("./data/earthmap.jpg"), 
        shininess: 5
    })
);
scene.add(earth);

// Space Objects -------------------------------------------------------------->
const satellites = parseTLEs(TLE_RAW);
const satMeshes = [];
const groups = {};
let i = 0;
document.getElementById('sat-count').textContent = satellites.length; // Update count

function makeDotTex() { // basic canvas circle/dote for objects
    const c = document.createElement('canvas'); 
    const ctx = c.getContext('2d');
    c.width = 8; 
    c.height = 8;
    ctx.arc(4, 4, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff"; // this is needed, but the color is set in functions.js lines: 40 - 45
    ctx.fill();
    return new THREE.CanvasTexture(c);
}
const dotTex = makeDotTex();

while (i < satellites.length) { // Group objects by color for batched rendering
    const sat = satellites[i];
    const key = sat.color.getHexString();

    if (!groups[key]) {
        groups[key] = { 
            sats: [], 
            color: sat.color 
        };
    }
    
    groups[key].sats.push(sat);
    i++;
}

i = 0;
const keys = Object.keys(groups);
while (i < keys.length) {
    const key = keys[i];
    const { sats, color } = groups[key];
    const positions = new Float32Array(sats.length * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color, 
        map: dotTex, 
        size: 0.0025, 
        sizeAttenuation: true,
        transparent: true, 
        opacity: 0.9, 
        depthWrite: false,
        blending: THREE.AdditiveBlending, 
        alphaTest: 0.01
    });
    const pts = new THREE.Points(geo, mat);

    scene.add(pts);
    satMeshes.push({ pts, geo, sats });
    i++;
}

// Orbit rings ---------------------------------------------------------------->
i = 0;
while (i < satellites.length) {
    addOrbitRing(satellites[i]) // this was just for fun, it's been reduced for proformance, therefor not complete/accuret
    i += 75;
}

// Camera and event listeners ------------------------------------------------->
const MIN_PHI = 0.1; 
const MAX_PHI = Math.PI - 0.1; 
const MIN_R = 1.3; 
const MAX_R = 50;
let theta = 0; 
let phi = Math.PI / 2; 
let radius = 3.5; 
let targetRadius = 3.5;
let velTheta = 0; 
let velPhi = 0;
let isDragging = false; 
let prevX = 0; 
let prevY = 0;

function updateCamera() {
    camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(0, 0, 0);
}

container.addEventListener('mousedown', (e) =>{
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
    velTheta = velPhi = 0;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    velTheta = (e.clientX - prevX) * 0.005; 
    velPhi = (e.clientY - prevY) * 0.005;
    theta -= velTheta; 
    phi = Math.max(MIN_PHI, Math.min(MAX_PHI, phi - velPhi));
    prevX = e.clientX; 
    prevY = e.clientY;
});

container.addEventListener('wheel', (e) =>{
    e.preventDefault();
    targetRadius = Math.min(MAX_R, Math.max(MIN_R, targetRadius + e.deltaY * 0.01));
},{passive:false});

let lastPinchDist = null;
container.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1){
        isDragging = true;
        velTheta = velPhi = 0;
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
    }
    lastPinchDist = null;
});

container.addEventListener('touchend', () => {
    isDragging = false;
});

container.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(e.touches.length === 2){
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX; 
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if(lastPinchDist !== null) targetRadius = Math.min(MAX_R, Math.max(MIN_R, targetRadius - (d - lastPinchDist) * 0.02));
        lastPinchDist = d;
    } else if(isDragging && e.touches.length === 1){
        velTheta = (e.touches[0].clientX - prevX) * 0.005; 
        velPhi = (e.touches[0].clientY - prevY) * 0.005;
        theta -= velTheta; 
        phi = Math.max(MIN_PHI, Math.min(MAX_PHI, phi - velPhi));
        prevX = e.touches[0].clientX; 
        prevY = e.touches[0].clientY;
    }
},{ passive:false });

window.addEventListener('resize', () => {
    camera.aspect = W() / H(); 
    camera.updateProjectionMatrix(); 
    renderer.setSize(W(), H());
});

// Speed control -------------------------------------------------------------->
const slider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
let simSpeed = 5;
let simSpeedFormatted = 000;

slider.addEventListener('input', ()=>{
    simSpeed = parseInt(slider.value);
    if (simSpeed < 10) {
        simSpeedFormatted = '00' + simSpeed;
    } else if (simSpeed > 10 && simSpeed < 100) {
        simSpeedFormatted = '0' + simSpeed;
    } else {
        simSpeedFormatted = simSpeed;
    }
    speedLabel.textContent = simSpeedFormatted + 'X';
});

// Animate ------------------------------------------------------------------->
let simMs = Date.now();
let lastRealMs = Date.now();

function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();
    const dtReal = now - lastRealMs;
    lastRealMs = now;
    simMs += dtReal * simSpeed;

    if (!isDragging) {
        velTheta *= 0.93; 
        velPhi *= 0.93;
        theta -= velTheta; 
        phi = Math.max(MIN_PHI, Math.min(MAX_PHI, phi+velPhi));
        theta -= 0.00001;
    }
    radius += (targetRadius - radius) * 0.08;
    updateCamera();

    // Update space objects position (using reverve while loop for profomance)
    let mi = satMeshes.length;
    while (mi--) {
        const { pts, geo, sats } = satMeshes[mi];
        const pos = geo.attributes.position.array;
        let i = sats.length;
        while (i--) {
            const p = satPos(sats[i], simMs);
            pos[i * 3] = p.x;
            pos[i * 3 + 1] = p.y;
            pos[i * 3 + 2] = p.z;
        }
        geo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
}
// init
animate();
