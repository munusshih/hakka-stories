import { DepartureBoard } from "./DepartureBoard.js";

// Audio context management for browser autoplay policy
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;

  // Create a silent audio context to unlock audio
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  gainNode.gain.value = 0;

  oscillator.start();
  oscillator.stop();

  audioUnlocked = true;

  // Remove the click listener after first interaction
  document.removeEventListener("click", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);

  console.log("Audio unlocked - ready for playback");
}

// Initialize departure board when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Add audio unlock listeners for first user interaction
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });

    // Fetch stories data
    const response = await fetch("/src/data/stories.json");
    const storiesData = await response.json();

    // Initialize departure board
    const board = new DepartureBoard();
    await board.initialize(storiesData);

    // Make board globally accessible for debugging
    window.departureBoard = board;
  } catch (error) {
    console.error("Error initializing departure board:", error);
  }
});
