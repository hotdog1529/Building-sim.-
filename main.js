// Build & Destroy Simulator v5 – Intelligent People AI
const { Engine, Render, Runner, Composite, Bodies, Body, Mouse, MouseConstraint, Events, Vector, Query } = Matter;

// DOM
const canvas = document.getElementById('stage');
const gravityCheckbox = document.getElementById('gravityToggle');
const snapCheckbox = document.getElementById('snapToggle');
const sizeRange = document.getElementById('sizeRange');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const rotationDisplay = document.getElementById('rotationDisplay');

const toolbarTools = document.querySelectorAll('.tool');
const toolbarShapes = document.querySelectorAll('.shape');
const weaponEls = document.querySelectorAll('.weapon');

let currentTool = 'spawn';
let currentShape = 'rectangle';
let rotationAngle = 0;

// Score
let scoreDisplay = document.createElement('div');
scoreDisplay.style.position = 'absolute';
scoreDisplay.style.top = '10px';
scoreDisplay.style.left = '240px';
scoreDisplay.style.color = '#ffcc00';
scoreDisplay.style.fontWeight = 'bold';
scoreDisplay.style.fontSize = '18px';
scoreDisplay.textContent = `People alive: 0`;
document.body.appendChild(scoreDisplay);

// Toolbar events
toolbarTools.forEach(t => t.addEventListener('click', () => {
    toolbarTools.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    currentTool = t.dataset.tool;
}));
toolbarShapes.forEach(s => s.addEventListener('click', () => {
    toolbarShapes.forEach(x => x.classList.remove('active'));
    s.classList.add('active');
    currentShape = s.dataset.shape;
}));

// Matter.js setup
const engine = Engine.create();
const world = engine.world;
world.gravity.y = gravityCheckbox.checked ? 1 : 0;

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: { width: window.innerWidth - 220, height: window.innerHeight, wireframes: false, background: 'transparent' }
});
Render.run(render);
Runner.run(Runner.create(), engine);

// Bounds
const wallThickness = 80;
function createBounds() {
    if (world.boundsBodies) Composite.remove(world, world.boundsBodies);
    const w = render.options.width;
    const h = render.options.height;
    const left = Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true });
    const right = Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true });
    const floor = Bodies.rectangle(w / 2, h + wallThickness / 2, w * 2, wallThickness, { isStatic: true });
    const ceiling = Bodies.rectangle(w / 2, -wallThickness / 2, w * 2, wallThickness, { isStatic: true });
    world.boundsBodies = [left, right, floor, ceiling];
    Composite.add(world, world.boundsBodies);
}
createBounds();
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth - 220;
    render.canvas.height = window.innerHeight;
    createBounds();
});

// Mouse
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
Composite.add(world, mouseConstraint);

// Helpers
function snap(v) { return snapCheckbox.checked ? Math.round(v / 20) * 20 : v; }
function randomColor() { return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'); }

// Hover preview
let previewEl = document.createElement('div');
previewEl.className = 'preview-shape';
document.body.appendChild(previewEl);
function updatePreview(x, y) {
    const size = parseInt(sizeRange.value) || 50;
    previewEl.style.width = size + 'px';
    previewEl.style.height = size + 'px';
    previewEl.style.left = x + 'px';
    previewEl.style.top = y + 'px';
    previewEl.style.transform = `translate(-50%,-50%) rotate(${rotationAngle}rad)`;
    previewEl.style.backgroundColor = currentTool === 'person' ? '#ffcc00' : randomColor();
    previewEl.style.borderRadius = currentShape === 'circle' || currentTool === 'person' ? '50%' : '6px';
}

// Spawn shapes
function spawnShape(x, y) {
    const size = parseInt(sizeRange.value) || 50;
    const opts = { friction: 0.3, restitution: 0.1, render: { fillStyle: randomColor() } };
    let body;
    switch (currentShape) {
        case 'rectangle': body = Bodies.rectangle(snap(x), snap(y), size, Math.max(20, size * 0.6), opts); break;
        case 'circle': body = Bodies.circle(snap(x), snap(y), Math.max(8, size / 2), opts); break;
        case 'beam': body = Bodies.rectangle(snap(x), snap(y), size * 2, Math.max(10, size * 0.4), opts); break;
        case 'glass': body = Bodies.rectangle(snap(x), snap(y), size, Math.max(15, size * 0.4), { ...opts, render: { fillStyle: 'rgba(173,216,230,0.5)' } }); break;
        case 'trampoline': body = Bodies.rectangle(snap(x), snap(y), size, Math.max(8, size * 0.3), { ...opts, restitution: 1.2, label: 'trampoline' }); break;
    }
    Body.rotate(body, rotationAngle);
    Composite.add(world, body);
    return body;
}

// Spawn person
function spawnPerson(x, y) {
    const radius = 12;
    const person = Bodies.circle(snap(x), snap(y), radius, { restitution: 0.2, friction: 0.5, label: 'person', render: { fillStyle: '#ffcc00' } });
    person.custom = { dir: Math.random() < 0.5 ? -1 : 1, alive: true, jumpTimer: Math.random() * 100 };
    Composite.add(world, person);
    updateScore();
    return person;
}

// Update score
function updateScore() {
    const people = Composite.allBodies(world).filter(b => b.label === 'person' && b.custom.alive);
    scoreDisplay.textContent = `People alive: ${people.length}`;
}

// Animate people and AI
Events.on(engine, 'beforeUpdate', () => {
    const people = Composite.allBodies(world).filter(b => b.label === 'person' && b.custom.alive);
    const explosives = Composite.allBodies(world).filter(b => b.label === 'weapon');

    people.forEach(p => {
        // Random jumping
        if (p.custom.jumpTimer <= 0) {
            Body.setVelocity(p, { x: p.velocity.x, y: -12 - Math.random() * 5 });
            p.custom.jumpTimer = 150 + Math.random() * 200;
        } else {
            p.custom.jumpTimer--;
        }

        // Walking
        let moveDir = p.custom.dir;
        // Escape nearby explosives
        explosives.forEach(ex => {
            const d = Vector.magnitude(Vector.sub(p.position, ex.position));
            if (d < 200) moveDir = (p.position.x < ex.position.x) ? -1 : 1;
        });

        Body.setVelocity(p, { x: 1.5 * moveDir, y: p.velocity.y });
        p.custom.dir = moveDir;

        // Bounce on walls
        if (p.position.x < 40 || p.position.x > render.options.width - 40) p.custom.dir *= -1;

        // Trampoline bouncing
        const trampolines = Composite.allBodies(world).filter(t => t.label === 'trampoline');
        trampolines.forEach(tr => {
            const dx = Math.abs(p.position.x - tr.position.x);
            const dy = p.position.y - tr.position.y;
            if (dx < 30 && dy > -15 && dy < 10 && p.velocity.y > -1) {
                Body.setVelocity(p, { x: p.velocity.x, y: -15 });
            }
        });
    });
});

// Pointer events
canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    updatePreview(x, y);
});
canvas.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (currentTool === 'spawn') spawnShape(x, y);
    else if (currentTool === 'person') spawnPerson(x, y);
    else if (currentTool === 'erase') {
        const bodies = Composite.allBodies(world);
        for (let i = bodies.length - 1; i >= 0; i--) {
            const b = bodies[i];
            if (b.isStatic) continue;
            const dx = b.position.x - x;
            const dy = b.position.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 50) { 
                if (b.label === 'person') b.custom.alive = false;
                Composite.remove(world, b); break; 
            }
        }
        updateScore();
    }
});

// Rotation keys
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') rotationAngle -= Math.PI / 16;
    if (e.key === 'ArrowRight') rotationAngle += Math.PI / 16;
    rotationDisplay.textContent = Math.round(rotationAngle * 180 / Math.PI) + '°';
});

// Mobile multi-touch rotation
let touchStart = null;
canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        touchStart = { t0: e.touches[0], t1: e.touches[1], angle: rotationAngle };
    }
});
canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && touchStart) {
        const [p0, p1] = e.touches;
        const dx1 = p1.clientX - p0.clientX;
        const dy1 = p1.clientY - p0.clientY;
        const newAngle = Math.atan2(dy1, dx1);
        const dx0 = touchStart.t1.clientX - touchStart.t0.clientX;
        const dy0 = touchStart.t1.clientY - touchStart.t0.clientY;
        const startAngle = Math.atan2(dy0, dx0);
        rotationAngle = touchStart.angle + (newAngle - startAngle);
        rotationDisplay.textContent = Math.round(rotationAngle * 180 / Math.PI) + '°';
    }
});
canvas.addEventListener('touchend', e => { if (e.touches.length < 2) touchStart = null; });

// Weapons
let dragging = null, ghost = null;
weaponEls.forEach(w => {
    w.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        dragging = { type: w.dataset.weapon };
        ghost = document.createElement('div');
        ghost.className = 'weapon-ghost';
        ghost.textContent = w.textContent;
        document.body.appendChild(ghost);
        moveGhost(ev);
        window.addEventListener('pointermove', moveGhost);
        window.addEventListener('pointerup', dropWeapon, { once: true });
    });
});
function moveGhost(ev) { if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; } }
function dropWeapon(ev) {
    const rect = canvas.getBoundingClientRect();
    if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
        const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
        const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
        spawnWeapon(x, y, dragging.type);
    }
    if (ghost) ghost.remove();
    dragging = null;
    window.removeEventListener('pointermove', moveGhost);
}

// spawn weapons
function spawnWeapon(x, y, type) {
    const size = parseInt(sizeRange.value) || 40;
    const opts = { friction: 0.4, restitution: 0.2, label: 'weapon' };
    let body;
    if (type === 'bomb') body = Bodies.circle(snap(x), snap(y), Math.max(12, size / 2), { ...opts, plugin: { weaponType: 'bomb' }, render: { fillStyle: '#222', strokeStyle: '#444', lineWidth: 3 } });
    else if (type === 'tnt') body = Bodies.rectangle(snap(x), snap(y), size * 0.9, Math.max(18, size * 0.6), { ...opts, plugin: { weaponType: 'tnt' }, render: { fillStyle: '#b14d2a', strokeStyle: '#8a2f14', lineWidth: 3 } });
    else body = Bodies.circle(snap(x), snap(y), Math.max(8, size / 2.2), { ...opts, plugin: { weaponType: 'grenade' }, render: { fillStyle: '#2f7a2f', strokeStyle: '#1e4f1e', lineWidth: 3 } });
    Composite.add(world, body);
}

// tap-to-explode
Events.on(mouseConstraint, 'mousedown', e => {
    const mousePos = e.mouse.position;
    const found = Query.point(Composite.allBodies(world), mousePos)[0];
    if (found && found.label === 'weapon') detonate(found);
});

function detonate(body) {
    if (!body || body._destroying) return; body._destroying = true;
    const type = (body.plugin && body.plugin.weaponType) || 'bomb';
    const pos = body.position;
    let radius = 120, force = 0.06;
    if (type === 'grenade') { radius = 100; force = 0.12; }
    else if (type === 'bomb') { radius = 160; force = 0.09; }
    else { radius = 300; force = 0.07; spawnFragments(pos.x, pos.y, 12); }
    explode(pos.x, pos.y, force, radius);
    Composite.remove(world, body);
}

function explode(x, y, force = 0.06, radius = 120) {
    Composite.allBodies(world).forEach(b => {
        if (b.isStatic) return;
        const dir = Vector.sub(b.position, { x, y });
        const d = Math.max(1, Vector.magnitude(dir));
        if (d > radius) return;
        const mag = (force * (1 - (d / radius))) * (b.mass || 1);
        Body.applyForce(b, b.position, Vector.mult(Vector.normalise(dir), mag));
        Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.2 * (1 - (d / radius)));
        if (b.label === 'person') {
            b.custom.dir = (b.position.x < x) ? -1 : 1;
            if (d < radius / 2) { b.custom.alive = false; Composite.remove(world, b); updateScore(); }
        }
    });
}

function spawnFragments(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
        const w = 6 + Math.round(Math.random() * 12); const h = 6 + Math.round(Math.random() * 12);
        const frag = Bodies.rectangle(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, w, h, { friction: 0.3, restitution: 0.2, render: { fillStyle: '#' + Math.floor(Math.random() * 16777215).toString(16) } });
        Body.setVelocity(frag, { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.8) * 8 });
        Composite.add(world, frag);
        setTimeout(() => { try { Composite.remove(world, frag); } catch (e) { } }, 8000 + Math.random() * 6000);
    }
}

// clear & download
clearBtn.addEventListener('click', () => { 
    Composite.allBodies(world).slice().forEach(b => { if (!b.isStatic) Composite.remove(world, b); }); 
    updateScore();
});
downloadBtn.addEventListener('click', () => { const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href = url; a.download = 'build-destroy.png'; a.click(); });

// gravity toggle
gravityCheckbox.addEventListener('change', () => { world.gravity.y = gravityCheckbox.checked ? 1 : 0; });

console.log('Simulator v5 Loaded: Intelligent People AI, trampolines, explosives, debris, score!');
