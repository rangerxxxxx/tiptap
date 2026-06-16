const gameShell = document.querySelector(".game-shell");
const playField = document.getElementById("playField");
const levelLabel = document.getElementById("levelLabel");
const progressBar = document.getElementById("progressBar");
const medals = document.getElementById("medals");
const restLabel = document.getElementById("restLabel");
const restCountdown = document.getElementById("restCountdown");
const rewardOverlay = document.getElementById("rewardOverlay");
const rewardTitle = document.getElementById("rewardTitle");
const rewardText = document.getElementById("rewardText");
const restOverlay = document.getElementById("restOverlay");
const startOverlay = document.getElementById("startOverlay");
const startButton = document.getElementById("startButton");
const nextLevelButton = document.getElementById("nextLevelButton");
const musicButton = document.getElementById("musicButton");
const themeButton = document.getElementById("themeButton");
const pauseButton = document.getElementById("pauseButton");

const PLAY_LIMIT_MS = 3 * 60 * 1000;
const REST_MS = 30 * 1000;
const LEVELS = [
  { name: "第1关", theme: "泡泡", target: 7, count: 4, size: [84, 120], speed: [3.9, 5.2] },
  { name: "第2关", theme: "星星", target: 9, count: 5, size: [74, 112], speed: [3.1, 4.4] },
  { name: "第3关", theme: "荷叶光", target: 11, count: 6, size: [66, 104], speed: [2.4, 3.6] },
  { name: "第4关", theme: "月光", target: 13, count: 7, size: [58, 96], speed: [1.9, 3.1] }
];

const palettes = [
  ["oklch(0.9 0.12 190)", "oklch(0.76 0.14 198)", "oklch(0.62 0.12 210)", "oklch(0.78 0.14 190 / 0.65)"],
  ["oklch(0.94 0.12 88)", "oklch(0.84 0.17 74)", "oklch(0.72 0.15 48)", "oklch(0.88 0.16 82 / 0.65)"],
  ["oklch(0.88 0.13 155)", "oklch(0.72 0.15 165)", "oklch(0.55 0.12 180)", "oklch(0.8 0.14 162 / 0.65)"],
  ["oklch(0.86 0.12 315)", "oklch(0.75 0.16 332)", "oklch(0.58 0.14 305)", "oklch(0.78 0.15 318 / 0.65)"],
  ["oklch(0.93 0.1 28)", "oklch(0.78 0.15 24)", "oklch(0.61 0.12 20)", "oklch(0.8 0.13 28 / 0.62)"]
];

let audioContext;
let levelIndex = 0;
let score = 0;
let playStartedAt = Date.now();
let restRemaining = REST_MS;
let restTimer = null;
let playTimer = null;
let isPaused = false;
let manualTheme = null;
let musicTimer = null;
let musicStep = 0;
let musicMuted = false;

const DEFAULT_LOCATION = {
  latitude: 31.2,
  longitude: 121.5
};

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(type = "tap") {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  const base = type === "reward" ? 660 : 430 + levelIndex * 45 + random(-20, 20);
  osc.type = "sine";
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * (type === "reward" ? 1.8 : 1.32), now + 0.16);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, now);
  filter.Q.setValueAtTime(0.3, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(type === "reward" ? 0.18 : 0.09, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "reward" ? 0.42 : 0.18));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + (type === "reward" ? 0.44 : 0.2));
}

const melody = [
  ["C5", 1], ["C5", 1], ["G5", 1], ["G5", 1], ["A5", 1], ["A5", 1], ["G5", 2],
  ["F5", 1], ["F5", 1], ["E5", 1], ["E5", 1], ["D5", 1], ["D5", 1], ["C5", 2],
  ["G5", 1], ["G5", 1], ["F5", 1], ["F5", 1], ["E5", 1], ["E5", 1], ["D5", 2],
  ["G5", 1], ["G5", 1], ["F5", 1], ["F5", 1], ["E5", 1], ["E5", 1], ["D5", 2],
  ["C5", 1], ["C5", 1], ["G5", 1], ["G5", 1], ["A5", 1], ["A5", 1], ["G5", 2],
  ["F5", 1], ["F5", 1], ["E5", 1], ["E5", 1], ["D5", 1], ["D5", 1], ["C5", 2]
];

const chordCycle = [
  ["C4", "E4", "G4"],
  ["F4", "A4", "C5"],
  ["C4", "E4", "G4"],
  ["G3", "D4", "G4"]
];

const noteMap = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196,
  A3: 220,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392,
  A4: 440,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880
};

function startMusic() {
  if (!audioContext || musicMuted || musicTimer || isPaused || !restOverlay.hidden) return;

  musicStep = musicStep % melody.length;
  scheduleMusicStep();
  musicTimer = window.setInterval(scheduleMusicStep, 560);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function scheduleMusicStep() {
  if (!audioContext || musicMuted || isPaused || !restOverlay.hidden) return;

  const [noteName, beats] = melody[musicStep];
  const now = audioContext.currentTime + 0.02;
  const duration = 0.42 * beats;
  playMusicNote(noteMap[noteName], now, duration, 0.035, "sine");

  if (musicStep % 4 === 0) {
    const chord = chordCycle[Math.floor(musicStep / 4) % chordCycle.length];
    chord.forEach((chordNote, index) => {
      playMusicNote(noteMap[chordNote], now + index * 0.018, 1.8, 0.012, "triangle");
    });
  }

  musicStep = (musicStep + 1) % melody.length;
}

function playMusicNote(frequency, startAt, duration, volume, type) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1450, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.06);
}

function setTheme(theme) {
  gameShell.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "night" ? "#1a335f" : "#8fdff0");
}

function autoTheme() {
  if (manualTheme) {
    setTheme(manualTheme);
    return;
  }

  setTheme(isAfterSunset(new Date()) ? "night" : "day");
}

function isAfterSunset(date) {
  const currentHour = date.getHours() + date.getMinutes() / 60;
  const sunsetHour = estimateSunsetHour(date, DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
  const sunriseHour = Math.max(5.2, sunsetHour - 13.1);
  return currentHour >= sunsetHour || currentHour < sunriseHour;
}

function estimateSunsetHour(date, latitude, longitude) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  const latitudeRad = (latitude * Math.PI) / 180;
  const declination = 0.409 * Math.sin(((2 * Math.PI) / 365) * dayOfYear - 1.39);
  const sunsetAngle = Math.acos(-Math.tan(latitudeRad) * Math.tan(declination));
  const daylightHours = (24 / Math.PI) * sunsetAngle;
  const timezoneMeridian = -date.getTimezoneOffset() / 4;
  const solarNoon = 12 + (timezoneMeridian - longitude) / 15;
  return Math.min(20.2, Math.max(17.1, solarNoon + daylightHours / 2));
}

function updateRestLabel() {
  const remaining = Math.max(0, PLAY_LIMIT_MS - (Date.now() - playStartedAt));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  restLabel.textContent = `休息 ${minutes}:${String(seconds).padStart(2, "0")}`;
}

function startPlayTimer() {
  clearInterval(playTimer);
  playStartedAt = Date.now();
  updateRestLabel();
  playTimer = setInterval(() => {
    updateRestLabel();
    autoTheme();
    if (Date.now() - playStartedAt >= PLAY_LIMIT_MS) {
      beginRest();
    }
  }, 1000);
}

function beginRest() {
  clearInterval(playTimer);
  clearInterval(restTimer);
  stopMusic();
  restRemaining = REST_MS;
  gameShell.classList.add("is-resting");
  restOverlay.hidden = false;
  renderRestCountdown();

  restTimer = setInterval(() => {
    restRemaining -= 1000;
    renderRestCountdown();
    if (restRemaining <= 0) {
      clearInterval(restTimer);
      restOverlay.hidden = true;
      gameShell.classList.remove("is-resting");
      startPlayTimer();
      startMusic();
    }
  }, 1000);
}

function renderRestCountdown() {
  restCountdown.textContent = Math.max(0, Math.ceil(restRemaining / 1000));
}

function renderTargets() {
  const level = LEVELS[levelIndex];
  playField.querySelectorAll(".target").forEach((target) => target.remove());

  for (let i = 0; i < level.count; i += 1) {
    const target = document.createElement("button");
    const size = random(level.size[0], level.size[1]);
    const palette = palettes[(i + levelIndex) % palettes.length];
    const shape = levelIndex === 1 ? "star" : levelIndex === 2 ? "lily-target" : "";

    target.className = `target ${shape}`;
    target.type = "button";
    target.setAttribute("aria-label", `点击${level.theme}`);
    target.style.setProperty("--x", `${random(12, 88)}%`);
    target.style.setProperty("--y", `${random(12, 86)}%`);
    target.style.setProperty("--size", `${size}px`);
    target.style.setProperty("--speed", `${random(level.speed[0], level.speed[1])}s`);
    target.style.setProperty("--dx", `${random(-18, 18)}px`);
    target.style.setProperty("--dy", `${random(-24, 24)}px`);
    target.style.setProperty("--target-a", palette[0]);
    target.style.setProperty("--target-b", palette[1]);
    target.style.setProperty("--target-c", palette[2]);
    target.style.setProperty("--target-glow", palette[3]);
    target.style.animationDelay = `${random(-3, 0)}s`;
    target.addEventListener("pointerdown", (event) => hitTarget(event, target));
    playField.appendChild(target);
  }
}

function hitTarget(event, target) {
  if (isPaused || !restOverlay.hidden || !rewardOverlay.hidden) return;

  initAudio();
  playTone("tap");
  const fieldBox = playField.getBoundingClientRect();
  const x = event.clientX - fieldBox.left;
  const y = event.clientY - fieldBox.top;
  createSpark(x, y);
  moveTarget(target);

  score += 1;
  updateProgress();
  if (score >= LEVELS[levelIndex].target) {
    completeLevel();
  }
}

function moveTarget(target) {
  target.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)" },
      { transform: "translate(-50%, -50%) scale(0.78)", opacity: 0.75 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 }
    ],
    { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)" }
  );
  window.setTimeout(() => {
    target.style.setProperty("--x", `${random(12, 88)}%`);
    target.style.setProperty("--y", `${random(12, 86)}%`);
  }, 130);
}

function createSpark(x, y) {
  const spark = document.createElement("div");
  spark.className = "spark";
  spark.style.setProperty("--x", `${x}px`);
  spark.style.setProperty("--y", `${y}px`);
  spark.style.setProperty("--size", `${random(96, 148)}px`);
  playField.appendChild(spark);
  spark.addEventListener("animationend", () => spark.remove());

  for (let i = 0; i < 10; i += 1) {
    const particle = document.createElement("div");
    const angle = (Math.PI * 2 * i) / 10 + random(-0.2, 0.2);
    const distance = random(34, 86);
    const color = palettes[(i + levelIndex) % palettes.length][i % 3];
    particle.className = "particle";
    particle.style.setProperty("--x", `${x}px`);
    particle.style.setProperty("--y", `${y}px`);
    particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--p-size", `${random(8, 15)}px`);
    particle.style.setProperty("--p-color", color);
    playField.appendChild(particle);
    particle.addEventListener("animationend", () => particle.remove());
  }
}

function updateProgress() {
  const level = LEVELS[levelIndex];
  const progress = Math.min(100, (score / level.target) * 100);
  levelLabel.textContent = level.name;
  progressBar.style.width = `${progress}%`;
}

function completeLevel() {
  playTone("reward");
  addMedal();
  rewardTitle.textContent = "真棒";
  rewardText.textContent = `完成${LEVELS[levelIndex].name}`;
  rewardOverlay.hidden = false;
}

function addMedal() {
  const medal = document.createElement("div");
  medal.className = "mini-medal";
  medal.setAttribute("aria-hidden", "true");
  medals.appendChild(medal);
}

function nextLevel() {
  rewardOverlay.hidden = true;
  levelIndex = (levelIndex + 1) % LEVELS.length;
  score = 0;
  updateProgress();
  renderTargets();
}

function togglePause() {
  isPaused = !isPaused;
  gameShell.classList.toggle("is-paused", isPaused);
  pauseButton.setAttribute("aria-label", isPaused ? "继续" : "暂停");
  if (isPaused) {
    stopMusic();
  } else {
    startMusic();
  }
}

startButton.addEventListener("click", () => {
  initAudio();
  startOverlay.hidden = true;
  autoTheme();
  renderTargets();
  updateProgress();
  startPlayTimer();
  startMusic();
});

nextLevelButton.addEventListener("click", nextLevel);
musicButton.addEventListener("click", () => {
  initAudio();
  musicMuted = !musicMuted;
  musicButton.classList.toggle("music-off", musicMuted);
  musicButton.setAttribute("aria-label", musicMuted ? "打开音乐" : "关闭音乐");
  if (musicMuted) {
    stopMusic();
  } else {
    startMusic();
  }
});
pauseButton.addEventListener("click", togglePause);
themeButton.addEventListener("click", () => {
  manualTheme = gameShell.dataset.theme === "night" ? "day" : "night";
  setTheme(manualTheme);
});

autoTheme();
updateProgress();
