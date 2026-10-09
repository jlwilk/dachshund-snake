# Dachshund Snake

Snake, but you're a dachshund, and the pup only ever gets longer.

**Play:** https://jlwilk.github.io/dachshund-snake/

## Controls

- **Desktop:** arrow keys or WASD to steer, Space or P to pause, Space or Enter to play again.
- **Phone:** swipe on the board or use the on-screen arrows; tap to start, the pause button to pause.

## Run locally

No build step and no dependencies. ES modules need to be served over HTTP:

    python3 -m http.server 8000

Then open http://localhost:8000/.

## Tests

    npm test

Uses Node's built-in test runner (Node 18+).
