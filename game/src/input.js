// Keyboard and mouse input. Held keys give movement and steering; one-shot
// presses (enter car, punch, pause, confirm, mission key) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse gives an aim point in world space.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MISSION = 16;
export const ACTION_BUY = 32;
export const ACTION_MUTE = 64;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) {
      held[move] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { held.sprint = true; return; }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'Space') {
      held.handbrake = true;
      actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyN') actions |= ACTION_MISSION;
    else if (event.code === 'KeyB') actions |= ACTION_BUY;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) held[move] = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sprint = false;
    if (event.code === 'Space') held.handbrake = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sprint = held.handbrake = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseClicked = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    if (event.button === 0) actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    held,
    /** Screen-space mouse position, in canvas pixels. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    mouseDown() {
      return mouseDown;
    },
    /** True once after a click, then cleared. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** For scripted shots: pretend keys are held. */
    setHeld(name, value) {
      held[name] = value;
    },
    /** For scripted shots: queue a one-shot action. */
    queueAction(flag) {
      actions |= flag;
    },
  };
}
