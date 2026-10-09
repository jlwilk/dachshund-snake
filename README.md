# Dachshund Snake

Snake, but you're a dachshund, and the pup only ever gets longer.

**Play:** https://jlwilk.github.io/dachshund-snake/

## Controls

- **Desktop:** arrow keys or WASD to steer, Space or P to pause, Space or Enter to play again.
- **Phone:** swipe on the board or use the on-screen arrows; tap to start or play again, the pause button to pause.

## Pick your pup

On the start screen (or after a bonk), choose a color — Red, Black & tan (the default), Dapple or Cream — and a coat — Smooth, Long-haired or Wire-haired. Your choice is remembered.

### Easy mode

Also on the start screen, choose Easy and the pup turns itself instead of bonking into walls (it still can't run into itself). Easy mode keeps its own best score.

## Run locally

No build step and no dependencies. ES modules need to be served over HTTP:

    python3 -m http.server 8000

Then open http://localhost:8000/.

## Tests

    npm test

Uses Node's built-in test runner (Node 20+).
