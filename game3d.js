// Глобальные переменные для управления игровым циклом
let isGameRunning = false;
let currentAnimationFrameId = null;

// Глобальная функция инициализации 3D-игры
function init3DGame(serverId, serverName, playerId, playerName) {
    console.log("Запуск 3D игры CubeStrike...");

    const container = document.getElementById('game-container') || document.body;

    if (typeof THREE === 'undefined') {
        alert("Ошибка: Библиотека Three.js не загружена!");
        return;
    }

    isGameRunning = false;
    if (currentAnimationFrameId) {
        cancelAnimationFrame(currentAnimationFrameId);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Небо

    // 1. Настройка Камеры (Вид от первого лица)
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const oldCanvas = document.getElementById('game-canvas');
    if (oldCanvas) oldCanvas.remove();
    
    renderer.domElement.id = 'game-canvas';
    container.appendChild(renderer.domElement);

    // Свет
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
    scene.add(directionalLight);

    // Границы карты (50x50)
    const MAP_SIZE = 50;
    const BOUNDARY = MAP_SIZE / 2 - 1;

    // Арена (пол)
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x55aa55 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Стены по краям карты
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.4 });
    const wallGeo = new THREE.BoxGeometry(MAP_SIZE, 10, 1);
    
    const wallN = new THREE.Mesh(wallGeo, wallMat); wallN.position.set(0, 5, -MAP_SIZE/2); scene.add(wallN);
    const wallS = new THREE.Mesh(wallGeo, wallMat); wallS.position.set(0, 5, MAP_SIZE/2); scene.add(wallS);
    const wallE = new THREE.Mesh(wallGeo, wallMat); wallE.position.set(MAP_SIZE/2, 5, 0); wallE.rotation.y = Math.PI/2; scene.add(wallE);
    const wallW = new THREE.Mesh(wallGeo, wallMat); wallW.position.set(-MAP_SIZE/2, 5, 0); wallW.rotation.y = Math.PI/2; scene.add(wallW);

    // Массив препятствий (Дома и блоки)
    const obstacles = [];

    function createHouse(x, z, color) {
        const houseGroup = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(6, 4, 6),
            new THREE.MeshStandardMaterial({ color: color })
        );
        body.position.y = 2;
        houseGroup.add(body);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(5, 3, 4),
            new THREE.MeshStandardMaterial({ color: 0x8b0000 })
        );
        roof.position.y = 5.5;
        roof.rotation.y = Math.PI / 4;
        houseGroup.add(roof);

        houseGroup.position.set(x, 0, z);
        scene.add(houseGroup);
        obstacles.push({ x: x, z: z, sizeX: 6, sizeZ: 6 });
    }

    createHouse(-12, -12, 0xddaa77);
    createHouse(12, -10, 0x77aadd);
    createHouse(-10, 12, 0xdd77aa);

    function createBlock(x, z) {
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
        );
        block.position.set(x, 1, z);
        scene.add(block);
        obstacles.push({ x: x, z: z, sizeX: 2, sizeZ: 2 });
    }

    createBlock(0, -8);
    createBlock(5, 5);
    createBlock(-5, 5);

    // Игрок и его лицо
    const playerGroup = new THREE.Group();
    const playerBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x00ff88 })
    );
    playerBody.position.y = 1;
    playerGroup.add(playerBody);

    // Глаза и рот
    const eyeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.05);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.BoxGeometry(0.1, 0.1, 0.06);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.3, 1.4, -0.61);
    leftEye.add(new THREE.Mesh(pupilGeo, pupilMat));
    playerGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.3, 1.4, -0.61);
    rightEye.add(new THREE.Mesh(pupilGeo, pupilMat));
    playerGroup.add(rightEye);

    const mouth = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.15, 0.05),
        new THREE.MeshBasicMaterial({ color: 0x990000 })
    );
    mouth.position.set(0, 1.0, -0.61);
    playerGroup.add(mouth);

    scene.add(playerGroup);

    let yaw = 0;
    let velocityY = 0;
    const gravity = -0.018;
    let isGrounded = true;
    const bullets = [];

    function shoot() {
        if (!isGameRunning) return;
        const bullet = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0055 })
        );
        bullet.position.set(playerGroup.position.x, playerGroup.position.y + 1.4, playerGroup.position.z);
        
        const dirX = -Math.sin(yaw);
        const dirZ = -Math.cos(yaw);
        
        scene.add(bullet);
        bullets.push({ mesh: bullet, dirX: dirX, dirZ: dirZ, speed: 0.6, life: 50 });
    }

    function jump() {
        if (!isGameRunning) return;
        if (isGrounded) {
            velocityY = 0.38;
            isGrounded = false;
        }
    }

    function exitToMenu() {
        isGameRunning = false;
        if (currentAnimationFrameId) {
            cancelAnimationFrame(currentAnimationFrameId);
        }

        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.remove();

        const ui = document.getElementById('mobile-controls');
        if (ui) ui.remove();

        if (typeof showMenu === 'function') {
            showMenu();
        } else {
            window.location.reload();
        }
    }

    // Управление
    const input = { forward: false, backward: false, left: false, right: false, turnLeft: false, turnRight: false };

    window.addEventListener('keydown', (e) => {
        if (!isGameRunning) return;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') input.backward = true;
        if (e.code === 'KeyA') input.left = true;
        if (e.code === 'KeyD') input.right = true;
        if (e.code === 'ArrowLeft') input.turnLeft = true;
        if (e.code === 'ArrowRight') input.turnRight = true;
        if (e.code === 'Space') jump();
        if (e.code === 'KeyF' || e.code === 'ControlLeft') shoot();
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') input.backward = false;
        if (e.code === 'KeyA') input.left = false;
        if (e.code === 'KeyD') input.right = false;
        if (e.code === 'ArrowLeft') input.turnLeft = false;
        if (e.code === 'ArrowRight') input.turnRight = false;
    });

    // Красивый и чистый сенсорный интерфейс (только стрелочки, прыжок, огонь и выход)
    const oldUI = document.getElementById('mobile-controls');
    if (oldUI) oldUI.remove();

    const mobileUI = document.createElement('div');
    mobileUI.id = 'mobile-controls';
    mobileUI.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none; z-index: 999; touch-action: none;
    `;

    function createBtn(text, styleObj, onClick, onDown, onUp) {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = `
            position: absolute; font-size: 16px; font-weight: bold;
            background: rgba(255, 255, 255, 0.2); color: white;
            border: 2px solid rgba(255, 255, 255, 0.6); border-radius: 12px; outline: none;
            pointer-events: auto; user-select: none; -webkit-user-select: none;
            backdrop-filter: blur(4px);
        `;
        Object.assign(btn.style, styleObj);
        
        if (onClick) {
            btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onClick(); });
        } else {
            btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (onDown) onDown(); btn.style.background = 'rgba(0, 255, 136, 0.5)'; });
            const resetBtn = (e) => { e.preventDefault(); if (onUp) onUp(); btn.style.background = 'rgba(255, 255, 255, 0.2)'; };
            btn.addEventListener('pointerup', resetBtn);
            btn.addEventListener('pointerleave', resetBtn);
        }
        return btn;
    }

    // 🚪 Кнопка ВЫХОД в правом верхнем углу
    mobileUI.appendChild(createBtn('✕ ВЫЙТИ', { top: '15px', right: '15px', width: '90px', height: '38px', background: 'rgba(200, 0, 0, 0.4)', fontSize: '13px' }, () => {
        exitToMenu();
    }));

    // ⬅️➡️ Аккуратная крестовина стрелочек слева (без лишнего фона-джойстика)
    mobileUI.appendChild(createBtn('▲', { bottom: '100px', left: '65px', width: '48px', height: '48px' }, null, () => input.forward = true, () => input.forward = false));
    mobileUI.appendChild(createBtn('◀', { bottom: '50px', left: '15px', width: '48px', height: '48px' }, null, () => input.left = true, () => input.left = false));
    mobileUI.appendChild(createBtn('▼', { bottom: '0px', left: '65px', width: '48px', height: '48px' }, null, () => input.backward = true, () => input.backward = false));
    mobileUI.appendChild(createBtn('▶', { bottom: '50px', left: '115px', width: '48px', height: '48px' }, null, () => input.right = true, () => input.right = false));

    // 🔄 Кнопки поворота камеры (чуть выше справа)
    mobileUI.appendChild(createBtn('↺', { bottom: '100px', right: '110px', width: '48px', height: '48px' }, null, () => input.turnLeft = true, () => input.turnLeft = false));
    mobileUI.appendChild(createBtn('↻', { bottom: '100px', right: '15px', width: '48px', height: '48px' }, null, () => input.turnRight = true, () => input.turnRight = false));

    // ⬆️ Прыжок и 🔥 Огонь (справа внизу, стильно и аккуратно)
    mobileUI.appendChild(createBtn('▲ ПРЫЖОК', { bottom: '45px', right: '110px', width: '95px', height: '45px', fontSize: '12px' }, null, () => jump()));
    mobileUI.appendChild(createBtn('🔥 ОГОНЬ', { bottom: '45px', right: '15px', width: '85px', height: '45px', background: 'rgba(255, 0, 85, 0.4)', fontSize: '12px' }, null, () => shoot()));

    container.appendChild(mobileUI);

    let blinkTimer = 0;
    let mouthTimer = 0;
    isGameRunning = true;

    // Игровой цикл
    function animate() {
        if (!isGameRunning) return;
        currentAnimationFrameId = requestAnimationFrame(animate);

        // Поворот
        if (input.turnLeft) yaw += 0.04;
        if (input.turnRight) yaw -= 0.04;
        playerGroup.rotation.y = yaw;

        // Движение
        const speed = 0.12;
        let moveX = 0;
        let moveZ = 0;

        if (input.forward) { moveX -= Math.sin(yaw) * speed; moveZ -= Math.cos(yaw) * speed; }
        if (input.backward) { moveX += Math.sin(yaw) * speed; moveZ += Math.cos(yaw) * speed; }
        if (input.left) { moveX -= Math.cos(yaw) * speed; moveZ += Math.sin(yaw) * speed; }
        if (input.right) { moveX += Math.cos(yaw) * speed; moveZ -= Math.sin(yaw) * speed; }

        let newX = playerGroup.position.x + moveX;
        let newZ = playerGroup.position.z + moveZ;

        // Ограничение границ карты
        newX = Math.max(-BOUNDARY, Math.min(BOUNDARY, newX));
        newZ = Math.max(-BOUNDARY, Math.min(BOUNDARY, newZ));

        // Коллизия с домами
        let collide = false;
        for (let obs of obstacles) {
            const halfX = obs.sizeX / 2 + 0.6;
            const halfZ = obs.sizeZ / 2 + 0.6;
            if (Math.abs(newX - obs.x) < halfX && Math.abs(newZ - obs.z) < halfZ) {
                collide = true;
                break;
            }
        }

        if (!collide) {
            playerGroup.position.x = newX;
            playerGroup.position.z = newZ;
        }

        // Физика гравитации
        playerGroup.position.y += velocityY;
        if (!isGrounded) {
            velocityY += gravity;
        }

        if (playerGroup.position.y <= 0) {
            playerGroup.position.y = 0;
            velocityY = 0;
            isGrounded = true;
        }

        // Камера от первого лица
        camera.position.set(playerGroup.position.x, playerGroup.position.y + 1.5, playerGroup.position.z);
        camera.rotation.y = yaw;

        // Анимация лица
        blinkTimer += 0.05;
        if (Math.sin(blinkTimer) > 0.95) {
            leftEye.scale.y = 0.1;
            rightEye.scale.y = 0.1;
        } else {
            leftEye.scale.y = 1.0;
            rightEye.scale.y = 1.0;
        }

        mouthTimer += 0.08;
        mouth.scale.y = 1 + Math.sin(mouthTimer) * 0.4;

        // Полет пуль
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.mesh.position.x += b.dirX * b.speed;
            b.mesh.position.z += b.dirZ * b.speed;
            b.life--;

            if (b.life <= 0) {
                scene.remove(b.mesh);
                bullets.splice(i, 1);
            }
        }

        renderer.render(scene, camera);
    }

    currentAnimationFrameId = requestAnimationFrame(animate);

    window.addEventListener('resize', () => {
        if (!isGameRunning) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

