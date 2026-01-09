const WORDS = [
  "table", "chair", "piano", "mouse", "house",
  "plant", "brain", "cloud", "beach", "fruit",
  "candy", "sugar", "green", "stone", "light"
];

const boardEl = document.getElementById("board");
const inputEl = document.getElementById("guessInput");
const submitBtn = document.getElementById("submitBtn");
const newGameBtn = document.getElementById("newGameBtn");
const messageEl = document.getElementById("message");

const gamesPlayedEl = document.getElementById("gamesPlayed");
const winPercentEl = document.getElementById("winPercent");
const currentStreakEl = document.getElementById("currentStreak");

const ROWS = 6;
const COLS = 5;

let targetWord = "";
let currentRow = 0;
let gameOver = false;

const STATS_KEY = "miniwordle_stats_v1";

function loadStats() {
  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) {
    return { gamesPlayed: 0, wins: 0, currentStreak: 0 };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      gamesPlayed: Number(parsed.gamesPlayed) || 0,
      wins: Number(parsed.wins) || 0,
      currentStreak: Number(parsed.currentStreak) || 0
    };
  } catch {
    return { gamesPlayed: 0, wins: 0, currentStreak: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function updateStatsUI() {
  const stats = loadStats();
  gamesPlayedEl.textContent = String(stats.gamesPlayed);

  const pct = stats.gamesPlayed === 0 ? 0 : Math.round((stats.wins / stats.gamesPlayed) * 100);
  winPercentEl.textContent = `${pct}%`;

  currentStreakEl.textContent = String(stats.currentStreak);
}

let cells = [];

function buildBoard() {
  boardEl.innerHTML = "";
  cells = [];

  for (let r = 0; r < ROWS; r++) {
    const rowCells = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = "";
      boardEl.appendChild(cell);
      rowCells.push(cell);
    }
    cells.push(rowCells);
  }
}

function pickRandomWord() {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx].toUpperCase(); 
}

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.classList.remove("error", "success");
  if (type) messageEl.classList.add(type);
}

function normalizeGuess(raw) {
  return raw.trim().toUpperCase();
}

function isFiveLetters(guess) {
  return guess.length === 5;
}

function isLettersOnly(guess) {
  return /^[A-Z]{5}$/.test(guess);
}

function clearRowVisual(r) {
  for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c];
    cell.textContent = "";
    cell.classList.remove("filled", "correct", "present", "absent", "reveal");
  }
}

function evaluateGuess(guess, target) {
  const result = Array(COLS).fill("absent");

  const targetArr = target.split("");
  const guessArr = guess.split("");

  const remainingCounts = {};

  for (let i = 0; i < COLS; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = "correct";
    } else {
      const ch = targetArr[i];
      remainingCounts[ch] = (remainingCounts[ch] || 0) + 1;
    }
  }

  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;

    const ch = guessArr[i];
    if (remainingCounts[ch] > 0) {
      result[i] = "present";
      remainingCounts[ch] -= 1;
    } else {
      result[i] = "absent";
    }
  }

  return result;
}

function revealRow(r, guess, states) {
  for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c];

    cell.textContent = guess[c];
    cell.classList.add("filled");

    const delay = c * 120;
    setTimeout(() => {
      cell.classList.add("reveal");
      cell.classList.add(states[c]);
    }, delay);
  }
}

function endGame(won) {
  gameOver = true;
  submitBtn.disabled = true;
  inputEl.disabled = true;
  newGameBtn.classList.remove("hidden");

  const stats = loadStats();
  stats.gamesPlayed += 1;

  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    saveStats(stats);
    updateStatsUI();
    setMessage("You won! 🎉", "success");
    alert("You won!");
  } else {
    stats.currentStreak = 0;
    saveStats(stats);
    updateStatsUI();
    setMessage(`You lost. The word was: ${targetWord}`, "error");
    alert(`You lost! The word was: ${targetWord}`);
  }
}

function submitGuess() {
  if (gameOver) return;

  const guess = normalizeGuess(inputEl.value);

  if (!isFiveLetters(guess)) {
    setMessage("Your guess must be exactly 5 letters.", "error");
    return;
  }
  if (!isLettersOnly(guess)) {
    setMessage("Use only letters A–Z (no spaces/numbers).", "error");
    return;
  }

  setMessage("");

  const states = evaluateGuess(guess, targetWord);
  revealRow(currentRow, guess, states);

  if (guess === targetWord) {
    setTimeout(() => endGame(true), 120 * COLS + 50);
    return;
  }

  currentRow += 1;

  if (currentRow >= ROWS) {
    setTimeout(() => endGame(false), 120 * COLS + 50);
    return;
  }

  inputEl.value = "";
  inputEl.focus();
}

function resetGame() {
  targetWord = pickRandomWord();
  currentRow = 0;
  gameOver = false;

  buildBoard();

  setMessage("New word selected. Good luck!");
  submitBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.value = "";
  inputEl.focus();
  newGameBtn.classList.add("hidden");
}

submitBtn.addEventListener("click", submitGuess);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    submitGuess();
  }
});

newGameBtn.addEventListener("click", resetGame);

updateStatsUI();
resetGame();

