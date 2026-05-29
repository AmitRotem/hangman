(function attachHangmanLogic(globalScope) {
  const ASCII_ALPHABET = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const HEBREW_ALPHABET = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
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

  function isGuessableCharacter(character) {
    return typeof character === "string" && character.length > 0 && LETTER_PATTERN.test(character);
  }

  function canonicalizeLetter(character, languageId = "english") {
    const uppercased = character.toLocaleUpperCase();

    if (languageId === "hebrew") {
      return HEBREW_FINALS[uppercased] ?? uppercased;
    }

    return uppercased;
  }

  function sortLetters(letterList, locale = "en") {
    return [...letterList].sort((first, second) => first.localeCompare(second, locale, { sensitivity: "base" }));
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

    if (match.id === "english" && !letters.every((character) => /[A-Za-z]/.test(character))) {
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

  function getLanguageDirection(language = {}) {
    return RTL_LANGUAGE_IDS.has(language.id) || ["he", "ar"].includes(language.locale) ? "rtl" : "ltr";
  }

  function buildTargetLetters(answerChars, languageId) {
    return new Set(
      answerChars
        .filter(isGuessableCharacter)
        .map((character) => canonicalizeLetter(character, languageId))
    );
  }

  function resolveKeyboardGuess(key, bank, languageId) {
    if (typeof key !== "string" || key.length !== 1) {
      return null;
    }

    if (!isGuessableCharacter(key)) {
      return null;
    }

    const canonicalKey = canonicalizeLetter(key, languageId);

    return bank.find((letter) => canonicalizeLetter(letter, languageId) === canonicalKey) ?? null;
  }

  const HangmanLogic = {
    ASCII_ALPHABET,
    HEBREW_ALPHABET,
    RTL_LANGUAGE_IDS,
    HEBREW_FINALS,
    LANGUAGE_PROFILES,
    LETTER_PATTERN,
    isGuessableCharacter,
    canonicalizeLetter,
    buildCustomBank,
    detectLanguage,
    getLanguageDirection,
    buildTargetLetters,
    resolveKeyboardGuess
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = HangmanLogic;
  }

  globalScope.HangmanLogic = HangmanLogic;
})(typeof globalThis !== "undefined" ? globalThis : this);