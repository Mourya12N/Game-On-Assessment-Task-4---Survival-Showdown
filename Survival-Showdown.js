
 // SURVIVAL SHOWDOWN
const $ = id => document.getElementById(id);

const LEVELS = [
    { name: "BEGINNER ARENA", time: 60, target: 15, spawnRate: 850, speed: 145, obstacles: ["bomb"] },
    { name: "INTERMEDIATE ARENA", time: 45, target: 20, spawnRate: 700, speed: 180, obstacles: ["bomb", "blade"] },
    { name: "ADVANCED ARENA", time: 30, target: 25, spawnRate: 550, speed: 220, obstacles: ["bomb", "blade", "fireball"] }
];

const OBJECTS = {
    coin: { image: "assets/coin.svg", points: 1, damage: 0 },
    bomb: { image: "assets/bomb.svg", points: 0, damage: 0.5 },
    blade: { image: "assets/blade.svg", points: 0, damage: 1 },
    fireball: { image: "assets/fireball.svg", points: 0, damage: 1.5 }
};

const PLAYER_SIZE = 32, PLAYER_SPEED = 260, STARTING_HEALTH = 3;
const mainMenu = $("mainMenu"), levelMenu = $("levelMenu");
const gameScreen = $("gameScreen"), gameMessage = $("gameMessage");
const pauseMenu = $("pauseMenu"), arena = $("gameArena");
const playerInformation = $("playerInformation");

let gameMode = "single", currentLevel = 0, timer = 0;
let players = [], objects = [], pressedKeys = {};
let running = false, paused = false, spawnElapsed = 0;
let previousFrame = 0, animationId, audioContext;
let lastCountdownSecond = -1;

// SCREEN CONTROL
function showScreen(screen) {
    [mainMenu, levelMenu, gameScreen].forEach(s => s.classList.add("hidden"));
    screen.classList.remove("hidden");
}

function openLevelMenu(mode) {
    gameMode = mode;
    $("selectedModeText").textContent =
        mode === "single" ? "Single-player mode" : "Two-player mode";
    $("headerSubtitle").textContent = "Choose a level to play.";
    showScreen(levelMenu);
}

// PLAYER SETUP
function createPlayers() {
    players = [1, ...(gameMode === "two" ? [2] : [])].map(id => ({
        id, x: 0, y: 0, score: 0, health: STARTING_HEALTH, alive: true,
        keys: id === 1
            ? { up: "w", down: "s", left: "a", right: "d" }
            : { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }
    }));
}

function createPlayerCharacters() {
    arena.innerHTML = "";
    const width = arena.clientWidth, height = arena.clientHeight;

    players.forEach(p => {
        p.element = document.createElement("div");
        p.element.className = "player-character" + (p.id === 2 ? " player-two" : "");
        arena.appendChild(p.element);
        p.x = gameMode === "single" ? (width - PLAYER_SIZE) / 2 :
            width * (p.id === 1 ? .25 : .75) - PLAYER_SIZE / 2;
        p.y = height - 55;
        drawPlayer(p);
    });
}

function drawPlayer(p) {
    p.element.style.left = `${p.x}px`;
    p.element.style.top = `${p.y}px`;
}

// INTERFACE UPDATES
function updateInterface() {
    const level = LEVELS[currentLevel];
    $("levelTitle").textContent = `LEVEL ${currentLevel + 1} – ${level.name}`;
    $("modeSubtitle").textContent = gameMode === "single"
        ? `PLAYER 1 - Minimum score: ${level.target}`
        : "PLAYER 1 VS PLAYER 2";

    playerInformation.classList.toggle("two-player", gameMode === "two");
    $("player2Controls").classList.toggle("hidden", gameMode !== "two");
    $("player1Controls").textContent = gameMode === "single"
        ? "P1: WASD controls"
        : "P1: WASD";
    players.forEach(p => $(`player${p.id}Score`).textContent = `Score: ${p.score}`);
    updateHealth();
    updateTimer();
}

function updateHealth() {
    players.forEach(p => {
        $(`player${p.id}Hearts`).querySelectorAll(".heart").forEach((heart, i) => {
            const value = p.health - i;
            heart.className = "heart " +
                (value >= 1 ? "full" : value >= .5 ? "half" : "empty");
        });
        $(`player${p.id}Hearts`).setAttribute("aria-label",
            `Player ${p.id} has ${p.health} health`);
    });
}

function updateTimer() {
    $("timerDisplay").textContent = `${Math.ceil(timer)}S`;
}

// START OR RETRY A LEVEL
function startLevel(index) {
    currentLevel = index;
    timer = LEVELS[index].time;
    running = false;
    paused = false;
    cancelAnimationFrame(animationId);

    pauseMenu.classList.add("hidden");
    gameMessage.classList.add("hidden");
    objects.forEach(o => o.element.remove());
    objects = [];
    pressedKeys = {};
    spawnElapsed = 0;
    lastCountdownSecond = -1;

    createPlayers();
    showScreen(gameScreen);
    $("headerSubtitle").textContent = "Dodge obstacles. Collect coins. Survive!";
    createPlayerCharacters();
    updateInterface();

    running = true;
    previousFrame = performance.now();
    animationId = requestAnimationFrame(gameLoop);
}

// PLAYER MOVEMENT
function movePlayers(dt) {
    const maxX = arena.clientWidth - PLAYER_SIZE;
    const maxY = arena.clientHeight - PLAYER_SIZE;

    players.forEach(p => {
        if (!p.alive) return;
        const distance = PLAYER_SPEED * dt, k = p.keys;
        const other = players.find(otherPlayer => otherPlayer !== p && otherPlayer.alive);

        const overlapsOther = (x, y) => other &&
            x < other.x + PLAYER_SIZE && x + PLAYER_SIZE > other.x &&
            y < other.y + PLAYER_SIZE && y + PLAYER_SIZE > other.y;

        if (pressedKeys[k.left]) {
            const nextX = Math.max(0, p.x - distance);
            if (!overlapsOther(nextX, p.y)) p.x = nextX;
        }

        if (pressedKeys[k.right]) {
            const nextX = Math.min(maxX, p.x + distance);
            if (!overlapsOther(nextX, p.y)) p.x = nextX;
        }

        if (pressedKeys[k.up]) {
            const nextY = Math.max(0, p.y - distance);
            if (!overlapsOther(p.x, nextY)) p.y = nextY;
        }

        if (pressedKeys[k.down]) {
            const nextY = Math.min(maxY, p.y + distance);
            if (!overlapsOther(p.x, nextY)) p.y = nextY;
        }

        drawPlayer(p);
    });
}

// OBJECT CREATION AND MOVEMENT
function spawnObject() {
    const level = LEVELS[currentLevel];
    const type = Math.random() < .55 ? "coin" :
        level.obstacles[Math.floor(Math.random() * level.obstacles.length)];
    const size = 32, element = document.createElement("div");
    const image = document.createElement("img");

    element.className = "game-object";
    element.style.width = element.style.height = `${size}px`;
    image.src = OBJECTS[type].image;
    image.alt = type;

    image.onerror = () => {
        element.textContent = { coin: "🪙", bomb: "💣", blade: "⚔️", fireball: "🔥" }[type];
        element.style.fontSize = "26px";
        image.remove();
    };

    element.appendChild(image);
    arena.appendChild(element);

    objects.push({
        type, x: Math.random() * (arena.clientWidth - size), y: -size,
        width: size, height: size,
        speed: level.speed * (.85 + Math.random() * .3), element
    });
}

function moveObjects(dt) {
    objects.forEach(o => {
        o.y += o.speed * dt;
        o.element.style.left = `${o.x}px`;
        o.element.style.top = `${o.y}px`;
    });

    for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].y > arena.clientHeight) removeObject(i);
    }
}

function removeObject(i) {
    objects[i].element.remove();
    objects.splice(i, 1);
}

// COLLISION AND SCORING
function hasCollision(p, o) {
    return p.x < o.x + o.width && p.x + PLAYER_SIZE > o.x &&
        p.y < o.y + o.height && p.y + PLAYER_SIZE > o.y;
}

function checkCollisions() {
    for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];

        for (const p of players) {
            if (!p.alive || !hasCollision(p, o)) continue;

            const settings = OBJECTS[o.type];

            if (o.type === "coin") {
                p.score += settings.points;
                $(`player${p.id}Score`).textContent = `Score: ${p.score}`;
                playSound("coin");
            } else {
                p.health = Math.max(0, p.health - settings.damage);
                updateHealth();
                playSound(o.type);

                if (p.health === 0) {
                    p.alive = false;
                    p.element.classList.add("hidden");
                }
            }

            removeObject(i);
            break;
        }
    }
}

// SOUND
function playSound(kind) {
    try {
        audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === "suspended") audioContext.resume();

        const sounds = {
            coin: 880,
            bomb: 120,
            blade: 500,
            fireball: 220,
            win: 700,
            lose: 180,
            countdown: 950
        };

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = "sine";
        osc.frequency.value = sounds[kind] || 300;

        gain.gain.setValueAtTime(.07, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .2);

        osc.start();
        osc.stop(audioContext.currentTime + .2);

    } catch (error) {
        // Game continues if sound is unavailable.
    }
}

// RESULTS
function endGame(title, message, buttons) {
    if (!running) return;
    running = false;
    paused = false;
    cancelAnimationFrame(animationId);

    playSound(
        title.includes("WIN") || title.includes("COMPLETE") ? "win" : "lose"
    );

    $("messageTitle").textContent = title;
    $("messageText").textContent = message;

    const area = $("messageButtons");
    area.innerHTML = "";

    buttons.forEach(item => {
        const button = document.createElement("button");
        button.className = "secondary-button";
        button.textContent = item.label;
        button.addEventListener("click", item.action);
        area.appendChild(button);
    });

    gameMessage.classList.remove("hidden");
}

function resultButton(label, action) {
    return { label, action };
}

function completeSinglePlayerLevel() {
    const score = players[0].score;

    if (currentLevel === 2) {
        endGame("GAME COMPLETE!",
            `You completed all three levels with ${score} coins!`,
            [resultButton("PLAY AGAIN", () => startLevel(0)),
             resultButton("MAIN MENU", returnToMainMenu)]);
    } else {
        endGame("LEVEL COMPLETE!",
            `You collected ${score} coins and passed the level!`,
            [resultButton("REDO LEVEL", () => startLevel(currentLevel)),
             resultButton("NEXT LEVEL", () => startLevel(currentLevel + 1)),
             resultButton("LEVEL MENU", returnToLevelMenu)]);
    }
}

// LEVEL IS COMPLETED ONLY WHEN TIMER RUNS OUT AND MINIMUM SCORE IS REACHED
function checkLevelProgress() {
    // Level completion is now checked when the timer reaches zero.
}

function checkElimination() {
    const survivors = players.filter(p => p.alive);

    if (gameMode === "single" && !survivors.length) {
        endGame("GAME OVER", "You ran out of health. Try the level again!",
            [resultButton("RETRY LEVEL", () => startLevel(currentLevel)),
             resultButton("MAIN MENU", returnToMainMenu)]);
    } else if (gameMode === "two" && survivors.length <= 1) {
        endGame(survivors.length ? `PLAYER ${survivors[0].id} WINS!` : "IT'S A DRAW!",
            survivors.length ? `Player ${survivors[0].id} survived the round!` :
                "Both players were eliminated!",
            [resultButton("PLAY AGAIN", () => startLevel(currentLevel)),
             resultButton("MAIN MENU", returnToMainMenu)]);
    }
}

function finishTimedRound() {
    if (gameMode === "single") {
        const score = players[0].score;
        const target = LEVELS[currentLevel].target;

        if (score >= target) {
            completeSinglePlayerLevel();
        } else {
            endGame("LEVEL NOT COMPLETED",
                `You collected ${score} coins. You need ${target} to pass.`,
                [resultButton("RETRY LEVEL", () => startLevel(currentLevel)),
                 resultButton("LEVEL MENU", returnToLevelMenu)]);
        }
        return;
    }

    const [p1, p2] = players;
    const title = p1.score === p2.score ? "IT'S A DRAW!" :
        p1.score > p2.score ? "PLAYER 1 WINS!" : "PLAYER 2 WINS!";

    const buttons = [resultButton("PLAY AGAIN", () => startLevel(currentLevel))];

    if (currentLevel < 2) {
        buttons.push(resultButton("NEXT LEVEL", () => startLevel(currentLevel + 1)));
    }

    buttons.push(resultButton("MAIN MENU", returnToMainMenu));
    endGame(title, `Player 1: ${p1.score} coins. Player 2: ${p2.score} coins.`, buttons);
}

// PAUSE AND MENU
function pauseGame() {
    if (!running || paused) return;
    paused = true;
    pressedKeys = {};
    pauseMenu.classList.remove("hidden");
}

function resumeGame() {
    if (!paused) return;
    paused = false;
    pauseMenu.classList.add("hidden");
    previousFrame = performance.now();
    animationId = requestAnimationFrame(gameLoop);
}

function returnToLevelMenu() {
    running = paused = false;
    cancelAnimationFrame(animationId);
    pauseMenu.classList.add("hidden");
    gameMessage.classList.add("hidden");
    openLevelMenu(gameMode);
}

function returnToMainMenu() {
    running = paused = false;
    cancelAnimationFrame(animationId);
    objects.forEach(o => o.element.remove());
    objects = [];
    pressedKeys = {};
    pauseMenu.classList.add("hidden");
    gameMessage.classList.add("hidden");
    $("headerSubtitle").textContent = "Choose your game mode to begin.";
    showScreen(mainMenu);
}

// MAIN GAME LOOP
function gameLoop(now) {
    if (!running || paused) return;

    const dt = Math.min((now - previousFrame) / 1000, .05);
    previousFrame = now;
    timer = Math.max(0, timer - dt);
    updateTimer();

    // Sound warning during the final five seconds
    const secondsLeft = Math.ceil(timer);
    if (secondsLeft <= 5 && secondsLeft > 0 &&
        secondsLeft !== lastCountdownSecond) {
        playSound("countdown");
        lastCountdownSecond = secondsLeft;
    }

    spawnElapsed += dt * 1000;
    if (spawnElapsed >= LEVELS[currentLevel].spawnRate) {
        spawnObject();
        spawnElapsed = 0;
    }

    movePlayers(dt);
    moveObjects(dt);
    checkCollisions();
    checkElimination();
    if (!running) return;

    checkLevelProgress();
    if (!running) return;

    if (timer <= 0) {
        finishTimedRound();
        return;
    }

    animationId = requestAnimationFrame(gameLoop);
}

// KEYBOARD CONTROLS
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        event.preventDefault();
        if (event.repeat) return;
        paused ? resumeGame() : pauseGame();
        return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        event.preventDefault();
    }

    pressedKeys[key] = true;
});

document.addEventListener("keyup", event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    pressedKeys[key] = false;
});

window.addEventListener("blur", () => pressedKeys = {});

// BUTTON EVENTS
$("singleModeButton").addEventListener("click", () => openLevelMenu("single"));
$("twoModeButton").addEventListener("click", () => openLevelMenu("two"));
$("backToMenuButton").addEventListener("click", returnToMainMenu);
$("quitButton").addEventListener("click", returnToMainMenu);
$("resumeButton").addEventListener("click", resumeGame);
$("retryButton").addEventListener("click", () => startLevel(currentLevel));
$("homeButton").addEventListener("click", returnToMainMenu);

document.querySelectorAll(".level-button").forEach(button => {
    button.addEventListener("click", () => startLevel(Number(button.dataset.level)));
});

showScreen(mainMenu);
