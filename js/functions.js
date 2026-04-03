/**
 * FUNCTIONS JS
 * Helper fuctions for app.js.
 */


/**
 * TLE Parser
 * @param {string} raw - The raw tle data found in tle.js
 * @return {array} tle data formated as js array. 
 */
function parseTLEs(raw) {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const sats = [];
    const linesLen = lines.length - 1 
    let i = 0;

    while (i < linesLen) {
        const l1 = lines[i];
        const l2 = lines[i+1];
        if (!l1.startsWith('1') || !l2.startsWith('2')) continue;

        try {
            // break out line 1 data
            const epStr = l1.substring(18, 32).trim();
            const yr2 = parseInt(epStr.substring(0, 2));
            const dayF = parseFloat(epStr.substring(2));
            const yr = yr2 >= 57 ? 1900 + yr2 : 2000 + yr2;
            const epochMs = Date.UTC(yr, 0, 1) + (dayF - 1) * 86400000;

            // same for line two
            const inc = parseFloat(l2.substring(8,  16)) * Math.PI / 180;
            const raan = parseFloat(l2.substring(17, 25)) * Math.PI / 180;
            const ecc = parseFloat('0.' + l2.substring(26, 33).trim());
            const argp = parseFloat(l2.substring(34, 42)) * Math.PI / 180;
            const m0 = parseFloat(l2.substring(43, 51)) * Math.PI / 180;
            const mmRPD = parseFloat(l2.substring(52, 63));
            const n = mmRPD * 2 * Math.PI / 86400;

            // semi-major axis in Earth radii
            const mu  = 398600.4418; // km2/s2
            const a   = Math.cbrt(mu / (n * n)) / 6371.0;

            // set colors
            let color;
            if (mmRPD > 10) {      
                color = new THREE.Color(0x00FFEE);
            } else if (mmRPD > 2)  {
                color = new THREE.Color(0x0073FF);
            } else {
                color = new THREE.Color(0x8000FF);
            }

            //V2 TODO this should be cached
            sats.push({ inc, raan, ecc, argp, m0, n, a, epochMs, color });

        } catch(e) { 
            //skip bad lines 
        }
        i += 2;
    }
    return sats;
}

/**
 * Kepler equation
 * @param {float} M
 * @param {float} e
 * @return {float} equation solution 
 */
function kepler(M, e) {
    let E = M;
    for (let i = 0; i < 8; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
}

/**
 * Set space object position
 * @param {obj} sat - space object js obj
 * @param {float} simMs
 * @return {obj} 3d corordanets for three.js 
 */
function satPos(sat, simMs) {
    const dt = (simMs - sat.epochMs) / 1000;
    const M = ((sat.m0 + sat.n * dt) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
    const E = kepler(M, sat.ecc);
    const nu = 2 * Math.atan2(Math.sqrt(1 + sat.ecc) * Math.sin(E/2), Math.sqrt(1 - sat.ecc) * Math.cos(E/2));
    const r = sat.a * (1 - sat.ecc * Math.cos(E));

    const cosO = Math.cos(sat.raan), sinO = Math.sin(sat.raan);
    const cosI = Math.cos(sat.inc),  sinI = Math.sin(sat.inc);
    const cosW = Math.cos(sat.argp), sinW = Math.sin(sat.argp);
    const cosV = Math.cos(nu),       sinV = Math.sin(nu);

    const xP = r * cosV, yP = r * sinV;
    const xE = (cosO*cosW - sinO*sinW*cosI)*xP + (-cosO*sinW - sinO*cosW*cosI)*yP;
    const yE = (sinO*cosW + cosO*sinW*cosI)*xP + (-sinO*sinW + cosO*cosW*cosI)*yP;
    const zE = (sinI*sinW)*xP + (sinI*cosW)*yP;

    return { x: xE, y: zE, z: -yE };
}

/**
 * Add orbit rings
 * @param {obj} sat - space object js obj
 * @return {void} adds rings to three js scene 
 */
function addOrbitRing(sat) {
    const pts = [];
    const steps = 32;
    const cosO = Math.cos(sat.raan), sinO = Math.sin(sat.raan);
    const cosI = Math.cos(sat.inc),  sinI = Math.sin(sat.inc);
    const cosW = Math.cos(sat.argp), sinW = Math.sin(sat.argp);
    let nu, r, xP, xE, yE, zE;
    let i = 0
    while (i <= steps) {
        nu = (i / steps) * 2 * Math.PI;
        r  = sat.a * (1 - sat.ecc * sat.ecc) / (1 + sat.ecc * Math.cos(nu));
        xP = r * Math.cos(nu), yP = r * Math.sin(nu);
        xE = (cosO * cosW - sinO * sinW * cosI ) * xP + ( -cosO * sinW - sinO * cosW * cosI ) * yP;
        yE = (sinO * cosW + cosO * sinW * cosI ) * xP + ( -sinO * sinW + cosO * cosW * cosI ) * yP;
        zE = sinI * sinW * xP + sinI * cosW * yP;
        pts.push(new THREE.Vector3(xE, zE, -yE));
        i++;
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color:sat.color, transparent:true, opacity:0.075, depthWrite:false });
    scene.add(new THREE.Line(geo, mat));
}
