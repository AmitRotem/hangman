const ASCII_ALPHABET = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const HEBREW_ALPHABET = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
const SEGMENT_ORDER = ["head", "body", "left-arm", "right-arm", "left-leg", "right-leg", "floor", "pole", "beam", "rope"];
const BODY_SEGMENTS = SEGMENT_ORDER.slice(0, 6);
const RTL_LANGUAGE_IDS = new Set(["hebrew", "arabic"]);
const HEBREW_FINALS = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ"
};

const LANGUAGE_PROFILES = [
  {
    id: "english",
    label: "English",
    scriptPattern: /\p{Script=Latin}/u,
    bank: ASCII_ALPHABET,
    locale: "en"
  },
  {
    id: "hebrew",
    label: "עברית",
    scriptPattern: /\p{Script=Hebrew}/u,
    bank: HEBREW_ALPHABET,
    locale: "he"
  },
  {
    id: "arabic",
    label: "العربية",
    scriptPattern: /\p{Script=Arabic}/u,
    locale: "ar"
  },
  {
    id: "cyrillic",
    label: "Кириллица",
    scriptPattern: /\p{Script=Cyrillic}/u,
    locale: "ru"
  },
  {
    id: "greek",
    label: "Ελληνικά",
    scriptPattern: /\p{Script=Greek}/u,
    locale: "el"
  }
];

const LETTER_PATTERN = /\p{L}/u;
const ENGLISH_PATTERN = /^[A-Za-z\s' -]+$/;

const dom = {
  welcomePanel: document.querySelector('[data-screen="welcome"]'),
  gamePanel: document.querySelector('[data-screen="game"]'),
  setupForm: document.querySelector("#setup-form"),
  secretWordInput: document.querySelector("#secret-word"),
  languageValue: document.querySelector("#language-value"),
  setupError: document.querySelector("#setup-error"),
  gameLanguageLabel: document.querySelector("#game-language-label"),
  statusMessage: document.querySelector("#status-message"),
  wordSlots: document.querySelector("#word-slots"),
  letterBank: document.querySelector("#letter-bank"),
  usedSummary: document.querySelector("#used-summary"),
  usedCorrect: document.querySelector("#used-correct"),
  usedWrong: document.querySelector("#used-wrong"),
  hangmanSvg: document.querySelector("#hangman-svg"),
  hangmanParts: Array.from(document.querySelectorAll("[data-segment]")),
  mistakeCount: document.querySelector("#mistake-count"),
  celebrationBanner: document.querySelector("#celebration-banner"),
  resetButton: document.querySelector("#reset-button"),
  confettiLayer: document.querySelector("#confetti-layer")
};

const state = {
  screen: "welcome",
  answer: "",
  answerChars: [],
  bank: [],
  language: { id: "auto", label: "Waiting for input", locale: "en" },
  targetLetters: new Set(),
  guessedLetters: new Set(),
  correctGuesses: [],
  wrongGuesses: [],
  guessHistory: [],
  mistakes: 0,
  statusMessage: "Choose a letter to start guessing.",
  status: "idle",
  celebrationTimer: null
};

function isGuessableCharacter(character) {
  return LETTER_PATTERN.test(character);
}

function canonicalizeLetter(character, languageId = state.language.id) {
  const uppercased = character.toLocaleUpperCase();

  if (languageId === "hebrew") {
    return HEBREW_FINALS[uppercased] ?? uppercased;
  }

  return uppercased;
}

function sortLetters(letterList, locale = "en") {
  return [...letterList].sort((first, second) => first.localeCompare(second, locale, { sensitivity: "base" }));
}

function getLanguageDirection(language = state.language) {
  return RTL_LANGUAGE_IDS.has(language.id) || ["he", "ar"].includes(language.locale) ? "rtl" : "ltr";
}

function buildCustomBank(text, languageId, locale = "en") {
  const seenLetters = new Map();

  for (const character of text) {
    if (!isGuessableCharacter(character)) {
      continue;
    }

    const canonicalLetter = canonicalizeLetter(character, languageId);

    if (!seenLetters.has(canonicalLetter)) {
      seenLetters.set(canonicalLetter, canonicalLetter);
    }
  }

  return sortLetters([...seenLetters.values()], locale);
}

function detectLanguage(text) {
  const letters = [...text].filter(isGuessableCharacter);

  if (!letters.length) {
    return {
      id: "auto",
      label: "Waiting for input",
      bank: [],
      locale: "en"
    };
  }

  const matches = LANGUAGE_PROFILES.filter((profile) => letters.some((character) => profile.scriptPattern.test(character)));

  if (matches.length > 1) {
    return {
      id: "mixed",
      label: "Mixed / custom",
      bank: buildCustomBank(text, "mixed"),
      locale: "en"
    };
  }

  const match = matches[0];

  if (!match) {
    return {
      id: "custom",
      label: "Custom letters",
      bank: buildCustomBank(text, "custom"),
      locale: "en"
    };
  }

  if (match.id === "english" && !ENGLISH_PATTERN.test(text)) {
    return {
      id: "latin",
      label: "Latin",
      bank: buildCustomBank(text, "latin", match.locale),
      locale: match.locale
    };
  }

  return {
    id: match.id,
    label: match.label,
    bank: match.bank ? [...match.bank] : buildCustomBank(text, match.id, match.locale),
    locale: match.locale
  };
}

function resetSetupState() {
  dom.setupForm.reset();
  dom.secretWordInput.dir = "ltr";
  dom.languageValue.textContent = "Waiting for input";
  dom.setupError.textContent = "";
}

function clearCelebration() {
  clearTimeout(state.celebrationTimer);
  state.celebrationTimer = null;
  dom.confettiLayer.classList.remove("active");
  dom.confettiLayer.replaceChildren();
  dom.gamePanel.classList.remove("celebrating");
}

function resetGameState() {
  clearCelebration();
  state.answer = "";
  state.answerChars = [];
  state.bank = [];
  state.language = { id: "auto", label: "Waiting for input", locale: "en" };
  state.targetLetters = new Set();
  state.guessedLetters = new Set();
  state.correctGuesses = [];
  state.wrongGuesses = [];
  state.guessHistory = [];
  state.mistakes = 0;
  state.statusMessage = "Choose a letter to start guessing.";
  state.status = "idle";
}

function switchScreen(nextScreen) {
  state.screen = nextScreen;
  dom.welcomePanel.classList.toggle("hidden", nextScreen !== "welcome");
  dom.gamePanel.classList.toggle("hidden", nextScreen !== "game");
}

function renderLanguagePreview() {
  const detectedLanguage = detectLanguage(dom.secretWordInput.value.trim());
  dom.secretWordInput.dir = getLanguageDirection(detectedLanguage);
  dom.languageValue.textContent = detectedLanguage.label;
}

function applyBoardDirection() {
  const direction = getLanguageDirection();

  [dom.wordSlots, dom.letterBank, dom.usedCorrect, dom.usedWrong].forEach((element) => {
    element.dir = direction;
  });

  dom.gameLanguageLabel.dir = direction;
}

function buildTargetLetters(answerChars, languageId) {
  return new Set(
    answerChars
      .filter(isGuessableCharacter)
      .map((character) => canonicalizeLetter(character, languageId))
  );
}

function setSetupError(message) {
  dom.setupError.textContent = message;
}

function startGame(rawAnswer) {
  const answer = rawAnswer.trim();
  const answerChars = [...answer];
  const detectedLanguage = detectLanguage(answer);
  const targetLetters = buildTargetLetters(answerChars, detectedLanguage.id);

  if (!answer) {
    setSetupError("Enter a word or phrase before starting the game.");
    return;
  }

  if (!targetLetters.size) {
    setSetupError("Enter at least one real letter so the game has something to guess.");
    return;
  }

  resetGameState();

  state.answer = answer;
  state.answerChars = answerChars;
  state.language = detectedLanguage;
  state.bank = detectedLanguage.bank.length ? [...detectedLanguage.bank] : buildCustomBank(answer, detectedLanguage.id, detectedLanguage.locale);
  state.targetLetters = targetLetters;
  state.statusMessage = "Choose a letter to start guessing.";
  state.status = "playing";
  switchScreen("game");
  renderGame();
}

function allLettersFound() {
  return [...state.targetLetters].every((letter) => state.guessedLetters.has(letter));
}

function finishGame(result) {
  state.status = result;
  dom.resetButton.classList.remove("hidden");
  dom.celebrationBanner.classList.remove("hidden");

  if (result === "won") {
    state.statusMessage = "The word is solved. The board is locked.";
    dom.celebrationBanner.textContent = "Solved. Enjoy the short celebration, then reset for the next round.";
    launchCelebration();
  } else {
    state.statusMessage = `The word was ${state.answer}.`;
    dom.celebrationBanner.textContent = "The hangman is complete. Reset to play again.";
  }
}

function handleGuess(letter) {
  if (state.status !== "playing") {
    return;
  }

  const canonicalLetter = canonicalizeLetter(letter, state.language.id);

  if (state.guessedLetters.has(canonicalLetter)) {
    state.statusMessage = `${letter} was already used.`;
    renderGame();
    return;
  }

  const isCorrect = state.targetLetters.has(canonicalLetter);

  state.guessedLetters.add(canonicalLetter);
  state.guessHistory.push({ letter, correct: isCorrect });

  if (isCorrect) {
    state.correctGuesses.push(letter);
    state.statusMessage = `${letter} is in the word.`;
  } else {
    state.wrongGuesses.push(letter);
    state.mistakes = Math.min(state.mistakes + 1, SEGMENT_ORDER.length);
    state.statusMessage = `${letter} is not in the word.`;
  }

  if (allLettersFound()) {
    finishGame("won");
  } else if (state.mistakes >= SEGMENT_ORDER.length) {
    finishGame("lost");
  }

  renderGame();
}

function renderWordSlots() {
  dom.wordSlots.replaceChildren();
  const revealAll = state.status === "won" || state.status === "lost";

  state.answerChars.forEach((character) => {
    const slot = document.createElement("span");
    slot.dir = "auto";

    if (character === " ") {
      slot.className = "slot slot-gap";
      slot.setAttribute("aria-hidden", "true");
      dom.wordSlots.append(slot);
      return;
    }

    if (!isGuessableCharacter(character)) {
      slot.className = "slot slot-fixed revealed";
      slot.textContent = character;
      dom.wordSlots.append(slot);
      return;
    }

    const canonicalLetter = canonicalizeLetter(character, state.language.id);
    const revealed = revealAll || state.guessedLetters.has(canonicalLetter);

    slot.className = `slot${revealed ? " revealed" : ""}`;
    slot.textContent = revealed ? character : "_";
    dom.wordSlots.append(slot);
  });
}

function createChip(letter, kind) {
  const chip = document.createElement("span");
  chip.className = `used-chip ${kind}`;
  chip.textContent = letter;
  chip.dir = "auto";
  return chip;
}

function renderUsedBanks() {
  dom.usedCorrect.replaceChildren(...state.correctGuesses.map((letter) => createChip(letter, "correct")));
  dom.usedWrong.replaceChildren(...state.wrongGuesses.map((letter) => createChip(letter, "wrong")));

  if (!state.guessHistory.length) {
    dom.usedSummary.textContent = "No letters used yet.";
    return;
  }

  dom.usedSummary.textContent = `${state.guessHistory.length} letters used, ${state.correctGuesses.length} correct, ${state.wrongGuesses.length} wrong.`;
}

function renderLetterBank() {
  dom.letterBank.replaceChildren();

  state.bank.forEach((letter) => {
    const button = document.createElement("button");
    const canonicalLetter = canonicalizeLetter(letter, state.language.id);
    const alreadyUsed = state.guessedLetters.has(canonicalLetter);

    button.type = "button";
    button.className = "letter-button";
    button.dataset.letter = letter;
    button.textContent = letter;
    button.dir = "auto";
    button.disabled = alreadyUsed || state.status !== "playing";
    button.setAttribute("aria-label", `Guess ${letter}`);

    dom.letterBank.append(button);
  });
}

function renderHangman() {
  const visibleSegments = state.status === "won"
    ? BODY_SEGMENTS
    : SEGMENT_ORDER.slice(0, state.mistakes);
  const visibleSet = new Set(visibleSegments);

  dom.hangmanParts.forEach((segment) => {
    const segmentIndex = visibleSegments.indexOf(segment.dataset.segment);
    const shouldShow = visibleSet.has(segment.dataset.segment);

    segment.dataset.visible = String(shouldShow);
    segment.style.setProperty("--reveal-order", segmentIndex === -1 ? "0" : String(segmentIndex));
  });

  if (state.status === "won") {
    dom.hangmanSvg.dataset.face = "happy";
  } else if (state.status === "lost") {
    dom.hangmanSvg.dataset.face = "sad";
  } else if (visibleSegments.length > 0) {
    dom.hangmanSvg.dataset.face = "neutral";
  } else {
    dom.hangmanSvg.dataset.face = "none";
  }

  dom.mistakeCount.textContent = `${state.mistakes} / ${SEGMENT_ORDER.length}`;
}

function renderGame() {
  dom.gameLanguageLabel.textContent = state.language.label;
  dom.statusMessage.textContent = state.statusMessage;
  applyBoardDirection();
  renderWordSlots();
  renderLetterBank();
  renderUsedBanks();
  renderHangman();

  if (state.status === "playing") {
    dom.resetButton.classList.add("hidden");
    dom.celebrationBanner.classList.add("hidden");
    dom.celebrationBanner.textContent = "";
  }
}

function launchCelebration() {
  clearCelebration();
  const colors = ["#ffd166", "#ff6b6b", "#4ecdc4", "#f4a261", "#7bd389", "#89c2ff"];

  for (let index = 0; index < 24; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${6 + (index * 3.8) % 88}%`);
    piece.style.setProperty("--delay", `${(index % 6) * 0.04}s`);
    piece.style.setProperty("--rotation", `${140 + index * 18}deg`);
    piece.style.setProperty("--drift", `${(index % 2 === 0 ? -1 : 1) * (12 + (index % 5) * 7)}px`);
    piece.style.setProperty("--tone", colors[index % colors.length]);
    dom.confettiLayer.append(piece);
  }

  dom.gamePanel.classList.add("celebrating");
  dom.confettiLayer.classList.add("active");

  state.celebrationTimer = window.setTimeout(() => {
    dom.confettiLayer.classList.remove("active");
    dom.confettiLayer.replaceChildren();
    dom.gamePanel.classList.remove("celebrating");
    state.celebrationTimer = null;
  }, 1600);
}

function returnToWelcome() {
  resetGameState();
  resetSetupState();
  switchScreen("welcome");
  dom.secretWordInput.focus();
}

dom.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setSetupError("");
  startGame(dom.secretWordInput.value);
});

dom.secretWordInput.addEventListener("input", () => {
  setSetupError("");
  renderLanguagePreview();
});

dom.letterBank.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-letter]");

  if (!button) {
    return;
  }

  handleGuess(button.dataset.letter);
});

dom.resetButton.addEventListener("click", returnToWelcome);

renderLanguagePreview();