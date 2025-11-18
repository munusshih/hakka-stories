import { Story } from "./Story.js";

class DepartureBoard {
  constructor() {
    this.stories = [];
    this.currentPlayingStory = null;
    this.updateInterval = null;
    this.columnWidths = {
      time: 30,
      destination: 50,
      id: 30,
      status: 20,
    };

    this.setupEventListeners();
  }

  async initialize(storiesData) {
    // Create Story objects
    this.stories = storiesData.map((data) => new Story(data));

    // Start the update loop
    this.startUpdateLoop();

    // Initial render
    this.renderBoard();
  }

  setupEventListeners() {
    // Listen for story events
    document.addEventListener("storyEnded", (event) => {
      this.onStoryEnded(event.detail.storyId);
    });

    document.addEventListener("storyStatusChanged", (event) => {
      this.updateStoryDisplay(event.detail.storyId);
    });
  }

  startUpdateLoop() {
    this.updateInterval = setInterval(() => {
      this.updateStories();
    }, 1000); // Update every second
  }

  updateStories() {
    let needsRerender = false;

    // Update all stories
    this.stories.forEach((story) => {
      const oldStatus = story.currentStatus;
      story.updateStatus();
      if (oldStatus !== story.currentStatus) {
        needsRerender = true;
      }
    });

    // Try to play next story if none is currently playing
    if (!this.currentPlayingStory) {
      this.playNextStory();
    }

    // Remove completed stories that should be removed
    const initialLength = this.stories.length;
    this.stories = this.stories.filter((story) => !story.shouldRemove());

    if (this.stories.length !== initialLength || needsRerender) {
      this.renderBoard();
    }
  }

  playNextStory() {
    // Find next story that can play
    const availableStory = this.stories.find(
      (story) => story.canPlay() && story !== this.currentPlayingStory
    );

    if (availableStory && availableStory.play()) {
      this.currentPlayingStory = availableStory;
      this.renderBoard();
    }
  }

  onStoryEnded(storyId) {
    const story = this.stories.find((s) => s.id == storyId);
    if (story === this.currentPlayingStory) {
      this.currentPlayingStory = null;
    }

    // Try to play next story after a short delay
    setTimeout(() => {
      this.playNextStory();
    }, 1000);

    this.renderBoard();
  }

  updateStoryDisplay(storyId) {
    this.renderBoard();
  }

  createCharacterBoxes(text, columnType) {
    const width = this.columnWidths[columnType];

    // Process text based on column type
    let processedText;
    if (columnType === "destination" || columnType === "status") {
      text =
        text.trim() || (columnType === "destination" ? "UNTITLED" : "ONTIME");
    }

    processedText = text.padEnd(width, " ").substring(0, width);

    const container = document.createElement("div");
    container.style.display = "flex";

    for (let i = 0; i < width; i++) {
      const char = processedText[i];
      const span = document.createElement("span");
      span.className = char === " " ? "char space" : "char";
      span.textContent = char === " " ? "\u00A0" : char;
      container.appendChild(span);
    }

    return container;
  }

  renderBoard() {
    const storiesList = document.querySelector(".stories-list");
    if (!storiesList) return;

    storiesList.innerHTML = "";

    this.stories.forEach((story) => {
      const storyData = story.getDisplayData();
      const row = document.createElement("div");
      row.className = "story-row";
      row.setAttribute("data-story-id", storyData.id);

      if (storyData.isPlaying) {
        row.classList.add("playing");
      }

      // Time column
      const timeCol = document.createElement("div");
      timeCol.className = "time-column";
      timeCol.appendChild(
        this.createCharacterBoxes(storyData.duration, "time")
      );
      row.appendChild(timeCol);

      // Destination column
      const destCol = document.createElement("div");
      destCol.className = "destination-column";
      destCol.appendChild(
        this.createCharacterBoxes(storyData.title, "destination")
      );
      row.appendChild(destCol);

      // ID column
      const idCol = document.createElement("div");
      idCol.className = "id-column";
      idCol.appendChild(
        this.createCharacterBoxes(storyData.id.toString(), "id")
      );
      row.appendChild(idCol);

      // Status column
      const statusCol = document.createElement("div");
      statusCol.className = "status-column";
      statusCol.appendChild(
        this.createCharacterBoxes(storyData.status, "status")
      );
      row.appendChild(statusCol);

      storiesList.appendChild(row);

      // Add subtitle if story is playing
      if (storyData.isPlaying && storyData.subtitle) {
        const subtitleRow = document.createElement("div");
        subtitleRow.className = "subtitle-row";
        subtitleRow.innerHTML = `<div class="subtitle-text">${storyData.subtitle}</div>`;
        storiesList.appendChild(subtitleRow);
      }
    });
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Stop all playing stories
    this.stories.forEach((story) => story.stop());
  }
}

export { DepartureBoard };
