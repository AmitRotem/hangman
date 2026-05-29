const logic = window.HangmanLogic;

if (!logic) {
  throw new Error("HangmanLogic is not available.");
}

const platform = [navigator.userAgentData?.platform, navigator.platform, navigator.userAgent].find((value) => typeof value === "string") ?? "";
const useReadonlySetupCapture = /Windows/i.test(platform);
const supportsNativeSecretMask = typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc");

const SEGMENT_ORDER = ["head", "body", "left-arm", "right-arm", "left-leg", "right-leg", "floor", "pole", "beam", "rope"];
const BODY_SEGMENTS = SEGMENT_ORDER.slice(0, 6);
const GALLOWS_SEGMENTS = SEGMENT_ORDER.slice(BODY_SEGMENTS.length);
const SOFT_GALLOWS_STROKE = "rgba(190, 220, 255, 0.42)";
const dom = {
  welcomePanel: document.querySelector('[data-screen="welcome"]'),
  gamePanel: document.querySelector('[data-screen="game"]'),
  setupForm: document.querySelector("#setup-form"),
  secretWordField: document.querySelector("[data-secret-field]"),
  secretWordInput: document.querySelector("#secret-word"),
  secretWordMask: document.querySelector("#secret-word-mask"),
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
  statusMessage: "Pick a letter.",
  status: "idle",
  celebrationTimer: null,
  setupAnswer: ""
};

function isGuessableCharacter(character) {
  return logic.isGuessableCharacter(character);
}

function canonicalizeLetter(character, languageId = state.language.id) {
  return logic.canonicalizeLetter(character, languageId);
}

function getLanguageDirection(language = state.language) {
  return logic.getLanguageDirection(language);
}

function buildCustomBank(text, languageId, locale = "en") {
  return logic.buildCustomBank(text, languageId, locale);
}

function detectLanguage(text) {
  return logic.detectLanguage(text);
}

function formatMaskedSecret(value) {
  return [...value].map((character) => (/\s/u.test(character) ? character : "•")).join("");
}

function renderSecretWordMask() {
  const value = state.setupAnswer;
  const hasValue = value.length > 0;
  const captureMode = useReadonlySetupCapture ? "readonly" : supportsNativeSecretMask ? "native" : "overlay";

  dom.secretWordField.dataset.masked = String(hasValue);
  dom.secretWordField.dataset.captureMode = captureMode;
  dom.secretWordField.dir = dom.secretWordInput.dir;
  dom.secretWordInput.classList.toggle("is-masked", hasValue);

  if (captureMode === "readonly") {
    dom.secretWordInput.classList.remove("use-native-mask");
    dom.secretWordInput.value = hasValue ? formatMaskedSecret(value) : "";
    dom.secretWordMask.textContent = "";
    return;
  }

  dom.secretWordInput.classList.toggle("use-native-mask", captureMode === "native" && hasValue);
  dom.secretWordInput.value = value;
  dom.secretWordMask.dir = dom.secretWordInput.dir;
  dom.secretWordMask.textContent = captureMode === "overlay" && hasValue ? formatMaskedSecret(value) : "";
  dom.secretWordMask.scrollLeft = dom.secretWordInput.scrollLeft;
}

function syncSetupPreview() {
  renderLanguagePreview();
  renderSecretWordMask();
}

function setSetupAnswer(nextValue) {
  state.setupAnswer = nextValue;
  syncSetupPreview();
}

function trimLastSetupCharacter() {
  setSetupAnswer(Array.from(state.setupAnswer).slice(0, -1).join(""));
}

function appendSetupCharacter(character) {
  setSetupAnswer(`${state.setupAnswer}${character}`);
}

function handleSetupKeydown(event) {
  if (!useReadonlySetupCapture) {
    return;
  }

  if (state.screen !== "welcome" || event.defaultPrevented) {
    return;
  }

  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    dom.setupForm.requestSubmit();
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    setSetupError("");
    trimLastSetupCharacter();
    return;
  }

  if (event.key === "Delete") {
    event.preventDefault();
    setSetupError("");
    setSetupAnswer("");
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    setSetupError("");
    appendSetupCharacter(event.key);
  }
}

function handleSetupPaste(event) {
  if (!useReadonlySetupCapture) {
    return;
  }

  if (state.screen !== "welcome") {
    return;
  }

  const pastedText = event.clipboardData?.getData("text");

  if (!pastedText) {
    return;
  }

  event.preventDefault();
  setSetupError("");
  setSetupAnswer(`${state.setupAnswer}${pastedText}`);
}

function resetSetupState() {
  dom.setupForm.reset();
  state.setupAnswer = "";
  dom.secretWordInput.dir = "ltr";
  dom.languageValue.textContent = "Waiting for input";
  dom.setupError.textContent = "";
  renderSecretWordMask();
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
  state.statusMessage = "Pick a letter.";
  state.status = "idle";
}

function switchScreen(nextScreen) {
  state.screen = nextScreen;
  dom.welcomePanel.classList.toggle("hidden", nextScreen !== "welcome");
  dom.gamePanel.classList.toggle("hidden", nextScreen !== "game");
}

function renderLanguagePreview() {
  const detectedLanguage = detectLanguage(state.setupAnswer.trim());
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
  return logic.buildTargetLetters(answerChars, languageId);
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
  state.statusMessage = "Pick a letter.";
  state.status = "playing";
  switchScreen("game");
  renderGame();
  dom.gamePanel.focus();
}

function allLettersFound() {
  return [...state.targetLetters].every((letter) => state.guessedLetters.has(letter));
}

function finishGame(result) {
  state.status = result;
  dom.resetButton.classList.remove("hidden");
  dom.celebrationBanner.classList.remove("hidden");

  if (result === "won") {
    state.statusMessage = "Solved.";
    dom.celebrationBanner.textContent = "Nice work.";
    launchCelebration();
  } else {
    state.statusMessage = `Answer: ${state.answer}`;
    dom.celebrationBanner.textContent = "Too bad.";
  }
}

function handleGuess(letter) {
  if (state.status !== "playing") {
    return;
  }

  const canonicalLetter = canonicalizeLetter(letter, state.language.id);

  if (state.guessedLetters.has(canonicalLetter)) {
    state.statusMessage = "Already used.";
    renderGame();
    return;
  }

  const isCorrect = state.targetLetters.has(canonicalLetter);

  state.guessedLetters.add(canonicalLetter);
  state.guessHistory.push({ letter, correct: isCorrect });

  if (isCorrect) {
    state.correctGuesses.push(letter);
    state.statusMessage = "Correct.";
  } else {
    state.wrongGuesses.push(letter);
    state.mistakes = Math.min(state.mistakes + 1, SEGMENT_ORDER.length);
    state.statusMessage = "Miss.";
  }

  if (allLettersFound()) {
    finishGame("won");
  } else if (state.mistakes >= SEGMENT_ORDER.length) {
    finishGame("lost");
  }

  renderGame();
}

function resolveKeyboardGuess(key) {
  return logic.resolveKeyboardGuess(key, state.bank, state.language.id);
}

function handleKeyboardGuess(event) {
  if (state.screen !== "game" || state.status !== "playing") {
    return;
  }

  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const target = event.target;
  if (target instanceof HTMLElement) {
    const tagName = target.tagName;
    if (target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return;
    }
  }

  const guessedLetter = resolveKeyboardGuess(event.key);
  if (!guessedLetter) {
    return;
  }

  event.preventDefault();
  handleGuess(guessedLetter);
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
    ? [...BODY_SEGMENTS, ...SEGMENT_ORDER.slice(BODY_SEGMENTS.length, state.mistakes)]
    : SEGMENT_ORDER.slice(0, state.mistakes);
  const visibleSet = new Set(visibleSegments);

  dom.hangmanParts.forEach((segment) => {
    const wasVisible = segment.dataset.visible === "true";
    const segmentIndex = visibleSegments.indexOf(segment.dataset.segment);
    const shouldShow = visibleSet.has(segment.dataset.segment);
    const shouldSoftShow = state.status === "won" && GALLOWS_SEGMENTS.includes(segment.dataset.segment) && shouldShow;

    segment.dataset.visible = String(shouldShow);
    segment.dataset.animate = String(shouldShow && !wasVisible);
    segment.dataset.soft = String(shouldSoftShow);
    segment.style.setProperty("--reveal-order", segmentIndex === -1 ? "0" : String(segmentIndex));
    segment.style.opacity = shouldShow ? "1" : "0";
    segment.style.stroke = shouldSoftShow ? SOFT_GALLOWS_STROKE : "";
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
  startGame(state.setupAnswer);
});

dom.secretWordInput.addEventListener("input", () => {
  if (useReadonlySetupCapture) {
    return;
  }

  state.setupAnswer = dom.secretWordInput.value;
  setSetupError("");
  syncSetupPreview();
});

dom.secretWordInput.addEventListener("keydown", handleSetupKeydown);
dom.secretWordInput.addEventListener("paste", handleSetupPaste);
dom.secretWordInput.addEventListener("scroll", renderSecretWordMask);

dom.letterBank.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-letter]");

  if (!button) {
    return;
  }

  handleGuess(button.dataset.letter);
});

dom.resetButton.addEventListener("click", returnToWelcome);
document.addEventListener("keydown", handleKeyboardGuess);

dom.secretWordInput.readOnly = useReadonlySetupCapture;

syncSetupPreview();