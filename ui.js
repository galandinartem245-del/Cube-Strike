// Функции интерфейса и меню (ui.js)

let selectedServerId = null;
let selectedServerData = null;

function openMenu(menuId) {
    document.querySelectorAll('.menu-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    document.getElementById(menuId).style.display = 'flex';

    if (menuId === 'settings-menu') {
        document.getElementById('player-id-display').textContent = myId;
    }
    if (menuId === 'rooms-menu') {
        loadServersList();
        loadFriendsList();
    }
    if (menuId === 'friends-menu') {
        loadFriendsList();
    }
    if (menuId === 'add-friend-modal') {
        document.getElementById('friend-id-input').value = '';
        document.getElementById('friend-error-msg').textContent = '';
    }
}

// Загрузка серверов
function loadServersList() {
    const listDiv = document.getElementById('servers-list');
    listDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px;">Обновление...</div>';

    db.ref('servers').once('value', (snapshot) => {
        listDiv.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const srvId = child.key;
                const srv = child.val();
                const hasPassword = srv.password && srv.password.length > 0;

                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; margin-bottom: 8px;';
                div.innerHTML = `
                    <div>
                        <span style="color: #fff; font-weight: bold; font-size: 15px;">${srv.name}</span>
                        <div style="color: #aaa; font-size: 12px;">Хост: ${srv.hostName} ${hasPassword ? '🔒' : '🔓'}</div>
                    </div>
                `;

                const joinBtn = document.createElement('button');
                joinBtn.className = 'menu-btn';
                joinBtn.style.cssText = 'width: auto; padding: 10px 20px; font-size: 14px; margin: 0; background: #2ed573; cursor: pointer;';
                joinBtn.textContent = 'Войти';
                
                joinBtn.onclick = () => {
                    tryJoinServer(srvId);
                };

                div.appendChild(joinBtn);
                listDiv.appendChild(div);
            });
        } else {
            listDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 15px;">Нет активных серверов</div>';
        }
    });
}

function createServer() {
    const nameInput = document.getElementById('new-server-name');
    const passInput = document.getElementById('new-server-password');
    const err = document.getElementById('create-error-msg');
    
    const name = nameInput.value.trim();
    const password = passInput.value.trim();

    if (!name) {
        err.textContent = 'Введите название!';
        return;
    }

    const serverRef = db.ref('servers').push();
    serverRef.set({
        name: name,
        password: password,
        hostId: myId,
        hostName: myName
    }).then(() => {
        enterGameRoom(serverRef.key, name);
    });
}

function tryJoinServer(serverId) {
    db.ref('servers/' + serverId).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            alert('Сервер не найден!');
            return;
        }
        const srv = snapshot.val();
        selectedServerId = serverId;
        selectedServerData = srv;

        if (srv.password && typeof srv.password === 'string' && srv.password.trim() !== '') {
            document.querySelectorAll('.menu-screen').forEach(screen => {
                screen.style.display = 'none';
            });
            document.getElementById('password-modal').style.display = 'flex';
            document.getElementById('target-server-title').textContent = 'Сервер: ' + srv.name;
            document.getElementById('join-server-password').value = '';
            document.getElementById('password-error-msg').textContent = '';
        } else {
            enterGameRoom(serverId, srv.name);
        }
    });
}

function verifyAndJoinServer() {
    const passInput = document.getElementById('join-server-password');
    const err = document.getElementById('password-error-msg');

    if (passInput.value === selectedServerData.password) {
        enterGameRoom(selectedServerId, selectedServerData.name);
    } else {
        err.textContent = 'Неверный пароль!';
    }
}

function enterGameRoom(serverId, serverName) {
    db.ref('users/' + myId).update({ currentServer: serverId });

    document.getElementById('ui-container').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';

    if (typeof init3DGame === 'function') {
        init3DGame(serverId, serverName, myId, myName);
    } else {
        alert('Ошибка: 3D скрипт игры не загружен!');
    }
}

function sendFriendId() {
    const input = document.getElementById('friend-id-input');
    const err = document.getElementById('friend-error-msg');
    const targetId = input.value.trim();

    if (!targetId) {
        err.textContent = 'Введите ID!';
        return;
    }

    if (targetId === myId) {
        err.textContent = 'Нельзя добавить себя!';
        return;
    }

    err.textContent = 'Поиск игрока...';

    db.ref('users/' + targetId).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const friendData = snapshot.val();
            db.ref('friends/' + myId + '/' + targetId).set({
                id: friendData.id || targetId,
                name: friendData.name || "Друг " + targetId
            }).then(() => {
                openMenu('friends-menu');
            });
        } else {
            err.textContent = 'Игрок с таким ID не найден!';
        }
    }).catch(() => {
        err.textContent = 'Ошибка сети.';
    });
}

function loadFriendsList() {
    const listDiv = document.getElementById('friends-list');
    const counterEl = document.getElementById('friends-counter');

    db.ref('friends/' + myId).once('value', (snapshot) => {
        listDiv.innerHTML = '';
        let count = 0;
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                count++;
                const f = child.val();
                
                db.ref('users/' + f.id).once('value', (userSnap) => {
                    let srvId = null;
                    if (userSnap.exists()) {
                        const uData = userSnap.val();
                        srvId = uData.currentServer;
                    }

                    const div = document.createElement('div');
                    div.style.cssText = 'background: rgba(255,255,255,0.08); padding: 10px; border-radius: 8px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;';
                    div.innerHTML = `
                        <div>
                            <div style="color: #fff; font-weight: bold; font-size: 14px;">👤 ${f.name}</div>
                            <div style="color: #2ed573; font-size: 11px;">ID: ${f.id}</div>
                        </div>
                    `;

                    const friendBtn = document.createElement('button');
                    friendBtn.className = 'menu-btn';
                    friendBtn.style.cssText = 'width: auto; padding: 8px 14px; font-size: 12px; margin: 0; background: #ffa502; cursor: pointer;';
                    friendBtn.textContent = srvId ? 'К другу' : 'Не в игре';

                    friendBtn.onclick = () => {
                        if (srvId) {
                            tryJoinServer(srvId);
                        } else {
                            alert('Этот друг сейчас не на сервере!');
                        }
                    };

                    div.appendChild(friendBtn);
                    listDiv.appendChild(div);
                });
            });
        } else {
            listDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 10px;">Пока нет друзей</div>';
        }
        if (counterEl) counterEl.textContent = count;
    });
}

