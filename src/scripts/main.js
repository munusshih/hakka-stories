import { DepartureBoard } from "./DepartureBoard.js";

// Initialize departure board when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  try {
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
