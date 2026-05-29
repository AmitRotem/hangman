# Rope & Letters

## For Players

- A simple hangman game.
- Supports English and Hebrew.
- Guess letters from the on-screen bank or with the keyboard.
- Letters are hidden, but spaces, numbers, commas, and other non-letter characters stay visible.
- Use one language per word or phrase. Do not mix Hebrew and English in the same answer.

## Dev Notes

- The welcome input is masked without using a password field, so the browser does not treat the secret word like a saved login value.
- On Windows, the setup field uses a readonly capture flow to avoid OS autocomplete and writing-suggestion popups while still showing masked dots.
- Language detection is used to choose the correct letter bank and text direction.
- The drawing is an SVG hangman built in steps, so each wrong guess reveals one more part.
- `smoke-tests.html` is a small browser test page for the shared logic in `logic.js`, including language detection and keyboard matching.