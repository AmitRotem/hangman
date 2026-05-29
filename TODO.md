# hangman todo list
* done: make style minimal and clean
    * done: remove some text, no need explaining the game and instructions, no need to explin the usgae of the input field, no need to explain the language detection nor game mechanics.
* done: add animation to the hangman drawing - fade and stroke reveal
* done: win state only shows happy stickfigure, not the hanging poles
    * done: win state should show all the stickfigure. if there are visable poles, make them half visible, not fully hidden
    * error; visible poles vanish, then show half visible - they should fade to half visible, not vanish then appear
* done: when using hebrew, the letters are displayed right-to-left
* done: make fonts larger and more readable, especially for the letters to guess
    * done: no bold font, use more readable fonts, we are using this game on a big screen for kids in class
* done: on chrome, entering a word no longer uses a password field, so it does not trigger save-password prompts
    * make sure this issue wont popup in other browsers
* english with numbers fall back to latin with custom word bank
    * hebrew with numbers is ok - shows the numbers (and others , \ ' . ) as solved and word bank is hebrew
    * dont fallback, no custom word bank, just show the numbers and let the user guess the word
* make stick figure different color, orange like it used to be. sad eye should be red.