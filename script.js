// ----- Words (5 letters) -----
const WORDS = [
  "table", "chair", "piano", "mouse", "house",
  "plant", "brain", "cloud", "beach", "fruit",
  // a few extra 5-letter words (still simple)
  "candy", "sugar", "green", "stone", "light"
];

// ----- DOM -----
const boardEl = document.getElementById("board");
const inputEl = document.getElementById("guessInput");
const submitBtn = document.getElementById("submitBtn");
const newGameBtn = document.getElementById("newGameBtn");
const messageEl = document.getElementById("message");

const gamesPlayedEl = document.getElementById("gamesPlayed");
const winPercentEl = document.getElementById("winPercent");
const currentStreakEl = document.getElementById("currentStreak");

// ----- Game State -----
const ROWS = 6;
const COLS = 5;

let targetWord = "";
let currentRow = 0;
let gameOver = false;

// Stats stored in localStorage
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

// ----- Board creation -----
let cells = []; // 2D array [row][col] of cell elements

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

// ----- Helpers -----
function pickRandomWord() {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx].toUpperCase(); // store as uppercase for easy compare
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

// ----- Correct Wordle-like feedback with duplicates -----
// returns array of states: "correct" | "present" | "absent"
function evaluateGuess(guess, target) {
  const result = Array(COLS).fill("absent");

  const targetArr = target.split("");
  const guessArr = guess.split("");

  // count letters in target that are NOT already matched as "correct"
  const remainingCounts = {};

  // pass 1: correct positions
  for (let i = 0; i < COLS; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = "correct";
    } else {
      const ch = targetArr[i];
      remainingCounts[ch] = (remainingCounts[ch] || 0) + 1;
    }
  }

  // pass 2: present letters (yellow) using remaining counts
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

// ----- Animations: reveal each cell with delay -----
function revealRow(r, guess, states) {
  for (let c = 0; c < COLS; c++) {
    const cell = cells[r][c];

    // put letter in cell
    cell.textContent = guess[c];
    cell.classList.add("filled");

    // flip animation stagger
    const delay = c * 120; // ms
    setTimeout(() => {
      cell.classList.add("reveal");
      // apply color state (the flip makes it look like it reveals)
      cell.classList.add(states[c]);
    }, delay);
  }
}

// ----- Game flow -----
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

  // 2) Validation: 5 letters exactly
  if (!isFiveLetters(guess)) {
    setMessage("Your guess must be exactly 5 letters.", "error");
    return;
  }
  // optional extra validation (letters only)
  if (!isLettersOnly(guess)) {
    setMessage("Use only letters A–Z (no spaces/numbers).", "error");
    return;
  }

  setMessage(""); // clear errors

  // reveal and evaluate
  const states = evaluateGuess(guess, targetWord);
  revealRow(currentRow, guess, states);

  // Win check
  if (guess === targetWord) {
    // wait until last flip is done so it feels nicer
    setTimeout(() => endGame(true), 120 * COLS + 50);
    return;
  }

  currentRow += 1;

  // Lose check
  if (currentRow >= ROWS) {
    setTimeout(() => endGame(false), 120 * COLS + 50);
    return;
  }

  // prepare next row input
  inputEl.value = "";
  inputEl.focus();
}

// ----- New Game -----
function resetGame() {
  targetWord = pickRandomWord();
  currentRow = 0;
  gameOver = false;

  buildBoard();

  // reset UI
  setMessage("New word selected. Good luck!");
  submitBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.value = "";
  inputEl.focus();
  newGameBtn.classList.add("hidden");
}

// ----- Events -----
submitBtn.addEventListener("click", submitGuess);

// 5) Keyboard support: Enter submits guess
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    submitGuess();
  }
});

newGameBtn.addEventListener("click", resetGame);

// ----- Init -----
updateStatsUI();
resetGame();
