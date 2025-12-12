import { Story } from "./Story.js";
import { cipher } from "./cipher.js";

class DepartureBoard {
  constructor() {
    this.allStories = []; // All original stories
    this.activeQueue = []; // Currently displayed stories (max 5)
    this.bin = []; // Completed/canceled stories
    this.currentPlayingStory = null;
    this.updateInterval = null;
    this.maxQueueSize = 5;
    this.isShowingSubtitles = false;
    this.subtitleContainer = null;
    this.columnWidths = {
      time: 30,
      destination: 50,
      id: 30,
      status: 20,
    };

    // Initialize cipher codes map
    this.cipherCodes = new Map();

    // Track last two languages used for rotation
    this.languageHistory = [];

    this.setupEventListeners();
    this.createSubtitleContainer();
  }

  initializeGSAP() {
    // Safely initialize GSAP FLIP if available
    try {
      if (
        typeof window !== "undefined" &&
        window.gsap &&
        window.gsap.registerPlugin &&
        window.Flip
      ) {
        window.gsap.registerPlugin(window.Flip);
        return true;
      }
    } catch (error) {
      console.warn("GSAP Flip plugin could not be initialized:", error);
    }
    return false;
  }

  async initialize(storiesData) {
    // Try to initialize GSAP safely
    this.initializeGSAP();

    // Create Story objects and store as master list
    this.allStories = storiesData.map((data) => new Story(data));
    this.bin = [];

    // Generate cipher codes for all stories
    this.generateCipherCodes();

    // Initialize the queue
    this.fillQueue();

    // Initial render
    this.renderBoard();

    setTimeout(() => {
      this.selectRandomStory();
    }, 8000);
  }

  generateCipherCodes() {
    // Generate unique cipher codes for all story IDs
    this.allStories.forEach((story) => {
      const cipherCode = cipher.encode(story.id);
      this.cipherCodes.set(story.id, cipherCode);
      // console.log(`Story ${story.id} -> Flight ${cipherCode}`);
    });

    // Verify uniqueness and log results
    const storyIds = this.allStories.map((s) => s.id);
    const verification = cipher.verifyUniqueness(storyIds);

    if (!verification.unique) {
      // console.warn(
      //   "⚠️  Cipher code collisions detected:",
      //   verification.duplicates
      // );
    } else {
      // console.log(
      //   `✅ Generated ${verification.totalCodes} unique flight codes`
      // );
    }
  }

  getCipherCode(storyId) {
    return this.cipherCodes.get(storyId) || cipher.encode(storyId);
  }

  setupEventListeners() {
    // Listen for story events
    document.addEventListener("storyStatusChanged", (event) => {
      this.updateStoryDisplay(event.detail.storyId);
    });

    document.addEventListener("storyFailed", (event) => {
      this.onStoryFailed(event.detail.storyId, event.detail.error);
    });
  }

  flickerRow(storyId) {
    const row = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!row) return;

    // Add flicker class for styling
    row.classList.add("flickering");

    // Use GSAP if available, otherwise CSS
    if (typeof window !== "undefined" && window.gsap) {
      window.gsap.to(row, {
        opacity: 0.2,
        duration: 0.15,
        yoyo: true,
        repeat: 5, // 3 full flickers (6 half-cycles)
        ease: "power2.inOut",
        onComplete: () => {
          row.classList.remove("flickering");
          window.gsap.set(row, { opacity: 1 }); // Ensure it ends at full opacity
        },
      });
    } else {
      // CSS fallback with black and white effect
      let flickerCount = 0;
      const flickerInterval = setInterval(() => {
        row.style.opacity = flickerCount % 2 === 0 ? "0.2" : "1";
        row.style.backgroundColor =
          flickerCount % 2 === 0
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(0, 0, 0, 0.8)";
        row.style.color = flickerCount % 2 === 0 ? "#000" : "#fff";
        flickerCount++;
        if (flickerCount >= 6) {
          clearInterval(flickerInterval);
          row.style.opacity = "1";
          row.style.backgroundColor = "";
          row.style.color = "";
          row.classList.remove("flickering");
        }
      }, 150);
    }
  }

  verifyDashboardSync() {
    const storiesList = document.querySelector(".stories-list");
    if (!storiesList) return false;

    const existingRows = storiesList.querySelectorAll(".story-row");
    const existingIds = Array.from(existingRows).map((row) =>
      row.getAttribute("data-story-id")
    );
    const activeIds = this.activeQueue.map((story) => story.id.toString());

    const isInSync =
      existingRows.length === this.activeQueue.length &&
      JSON.stringify(existingIds) === JSON.stringify(activeIds);

    if (!isInSync) {
      // Force re-render to fix sync
      this.renderBoard();
    }

    return isInSync;
  }

  selectRandomStory() {
    // Verify dashboard is in sync before selecting
    this.verifyDashboardSync();

    // If someone is currently playing, don't interrupt
    if (this.currentPlayingStory) {
      return;
    }

    // Get all stories on dashboard that could potentially be selected
    const dashboardStories = this.activeQueue.filter(
      (story) => story.currentStatus !== "CANCELED" && !story.hasBeenPlayed
    );

    if (dashboardStories.length === 0) {
      this.processCompletedStories();
      return;
    }

    // Get available languages and filter out last two used
    const availableLanguages = ["English", "Mandarin", "Hakka"];
    const selectableLanguages = availableLanguages.filter(
      (lang) => !this.languageHistory.includes(lang)
    );

    // If all languages were used recently, reset history
    const languagePool =
      selectableLanguages.length > 0 ? selectableLanguages : availableLanguages;

    // Randomly select a language from available pool
    const selectedLanguage =
      languagePool[Math.floor(Math.random() * languagePool.length)];

    // Filter stories that have audio in the selected language
    const storiesWithLanguage = dashboardStories.filter((story) => {
      return story.audioLanguage === selectedLanguage;
    });

    // If no stories with selected language, pick any available story
    const candidateStories =
      storiesWithLanguage.length > 0 ? storiesWithLanguage : dashboardStories;

    // Randomly select a story from candidates
    const randomIndex = Math.floor(Math.random() * candidateStories.length);
    const selectedStory = candidateStories[randomIndex];

    // Update language history (keep only last 2)
    this.languageHistory.push(selectedLanguage);
    if (this.languageHistory.length > 2) {
      this.languageHistory.shift();
    }

    console.log(
      `Selected language: ${selectedLanguage}, History: [${this.languageHistory.join(
        ", "
      )}]`
    );

    // console.log(
    //   `🎯 RANDOMLY SELECTED: Story ${selectedStory.id} - "${selectedStory.title}"`
    // );

    // Add flicker effect to show the row is selected
    this.flickerRow(selectedStory.id);

    // Check if story has valid audio
    const hasValidAudio =
      selectedStory.audioFile &&
      selectedStory.audioFile.trim() !== "" &&
      (selectedStory.audioFile.startsWith("/audio/") || selectedStory.audioFile.startsWith("./audio/")) &&
      selectedStory.audioDuration &&
      selectedStory.audioDuration !== "0:00" &&
      selectedStory.audioDuration !== "0:0" &&
      selectedStory.audioDuration.trim() !== "";

    if (!hasValidAudio) {
      // Use centralized cancel function with random delay
      const stayDuration = Math.floor(Math.random() * 2000) + 3000; // 3000-5000ms
      this.cancelStory(selectedStory, stayDuration);
      return;
    }

    // Story has valid audio, proceed with playing
    const playResult = selectedStory.play();
    if (playResult) {
      // Successfully started playing
      this.startStoryPlayback(selectedStory);
    } else {
      // Play failed, use centralized cancel function
      this.cancelStory(selectedStory, 1000);
    }
  }

  onStoryFailed(storyId, error) {
    const story = this.activeQueue.find((s) => s.id == storyId);
    if (story) {
      // Use centralized cancel function
      this.cancelStory(story, 1000);
    }
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

  createMarqueeTitle(title, storyIndex = 0) {
    const container = document.createElement("div");
    container.className = "marquee-container";

    const displayTitle = title || "UNTITLED";

    // Create a single marquee text with repeated content for seamless scrolling
    const marqueeText = document.createElement("div");
    marqueeText.className = "marquee-text";

    const spacer = "\u00A0".repeat(10);
    const repeatedTitle = `${displayTitle}${spacer}`.repeat(10);
    marqueeText.textContent = repeatedTitle;

    const randomDuration = 40 + Math.random() * 200;
    const randomDelay = Math.random() * 1;

    marqueeText.style.setProperty("--marquee-delay", `${randomDelay}s`);
    marqueeText.style.setProperty("--marquee-duration", `${randomDuration}s`);

    container.appendChild(marqueeText);
    return container;
  }

  renderBoard() {
    const storiesList = document.querySelector(".stories-list");
    if (!storiesList) return;

    const existingRows = storiesList.querySelectorAll(".story-row");
    const existingIds = Array.from(existingRows).map((row) =>
      row.getAttribute("data-story-id")
    );
    const activeIds = this.activeQueue.map((story) => story.id.toString());

    // If no rows exist or if the IDs don't match exactly, do a full re-render
    if (
      existingRows.length === 0 ||
      existingRows.length !== this.activeQueue.length ||
      JSON.stringify(existingIds) !== JSON.stringify(activeIds)
    ) {
      // Clear and rebuild
      storiesList.innerHTML = "";

      this.activeQueue.forEach((story, index) => {
        const storyData = story.getDisplayData();
        const row = this.createStoryRow(storyData, index);

        // Add simple fade-in animation for initial load
        row.style.opacity = "0";
        row.style.transform = "translateY(20px)";
        storiesList.appendChild(row);

        setTimeout(() => {
          row.style.transition = "opacity 0.5s ease, transform 0.5s ease";
          row.style.opacity = "1";
          row.style.transform = "translateY(0)";
        }, index * 100);
      });
    } else {
      // Update existing rows with current data
      existingRows.forEach((row, index) => {
        if (this.activeQueue[index]) {
          this.updateStoryRow(row, this.activeQueue[index].getDisplayData());
        }
      });
    }
  }

  fillQueue() {
    // Fill active queue with available stories up to maxQueueSize
    const availableStories = this.allStories.filter(
      (story) => !this.bin.includes(story) && !this.activeQueue.includes(story)
    );

    // console.log(`📊 QUEUE STATUS:`);
    // console.log(
    //   `   Active Queue (${this.activeQueue.length}/${this.maxQueueSize}):`,
    //   this.activeQueue.map((s) => `${s.id}-"${s.title.substring(0, 20)}..."`)
    // );
    // console.log(`   Available Stories (${availableStories.length}):`);
    // console.log(
    //   `   In Bin (${this.bin.length}):`,
    //   this.bin.map((s) => `${s.id}-"${s.title.substring(0, 20)}..."`)
    // );

    const needed = this.maxQueueSize - this.activeQueue.length;
    if (needed > 0) {
      // Shuffle available stories before taking what we need
      const shuffledAvailable = [...availableStories].sort(
        () => Math.random() - 0.5
      );
      const toAdd = shuffledAvailable.slice(0, needed);

      this.activeQueue.push(...toAdd);
      // console.log(
      //   `➕ ADDED TO QUEUE (${toAdd.length}):`,
      //   toAdd.map((s) => `${s.id}-"${s.title.substring(0, 20)}..."`)
      // );
    }
  }

  processCompletedStories() {
    const completedStories = this.activeQueue.filter(
      (story) =>
        story.shouldRemove() ||
        story.currentStatus === "CANCELED" ||
        story.hasBeenPlayed
    );

    if (completedStories.length > 0) {
      // Move completed stories to bin using centralized function
      completedStories.forEach((story) => {
        this.removeToBin(story);
      });

      // Refresh the entire dashboard
      this.refreshDashboard();
    }
  }

  removeToBin(story) {
    const index = this.activeQueue.indexOf(story);
    if (index > -1) {
      this.activeQueue.splice(index, 1);
      this.bin.push(story);
      // console.log(`🗑️ MOVED TO BIN: Story ${story.id} - "${story.title}"`);
    }

    // Staggered refresh operations with natural delays
    setTimeout(() => {
      this.refreshDashboard();
    }, 2000);

    setTimeout(() => {
      this.selectRandomStory();
    }, 8000);

    this.checkForRestart();
  }

  cancelStory(story, delay = 3000) {
    // Set status to CANCELED
    story.currentStatus = "CANCELED";
    story.hasBeenPlayed = true;

    // Animate to CANCELED status
    this.animateStatusChange(story.id, "CANCELED");

    // Move to bin after delay
    setTimeout(() => {
      this.removeToBin(story);
    }, delay);
  }

  revertCancel(story) {
    // Revert cancellation - reset story to playable state
    story.currentStatus = "ONTIME";
    story.hasBeenPlayed = false;
    story.audioFailed = false;

    // Animate back to ONTIME status
    this.animateStatusChange(story.id, "ONTIME");
    // Refresh the dashboard to reflect changes
    this.renderBoard();
  }

  setStoryStatus(story, status) {
    story.currentStatus = status;
    this.animateStatusChange(story.id, status);
  }

  startStoryPlayback(story) {
    this.currentPlayingStory = story;

    // Animate to GATEOPEN after short delay
    setTimeout(() => {
      this.setStoryStatus(story, "GATEOPEN");

      // Update internal status after animation starts
      setTimeout(() => {
        this.currentPlayingStory.currentStatus = "GATEOPEN";
      }, 1000);
    }, 100);

    // Show fullscreen subtitles after status change
    setTimeout(() => {
      this.showFullscreenSubtitles(story);
    }, 5000);
  }

  refreshDashboard() {
    this.fillQueue();
    this.enforceGateOpenRule();
    this.renderBoard();
  }

  enforceGateOpenRule() {
    // Ensure only the currently playing story has GATEOPEN status
    this.activeQueue.forEach((story) => {
      if (
        story !== this.currentPlayingStory &&
        story.currentStatus === "GATEOPEN"
      ) {
        story.currentStatus = "ONTIME";
      }
    });

    // Set playing story to GATEOPEN if it exists
    if (
      this.currentPlayingStory &&
      this.currentPlayingStory.currentStatus !== "GATEOPEN"
    ) {
      this.currentPlayingStory.currentStatus = "GATEOPEN";
    }
  }

  updateBoardWithNewStory(flipState) {
    const storiesList = document.querySelector(".stories-list");
    if (!storiesList) return;

    // Update existing rows with current data
    const existingRows = storiesList.querySelectorAll(".story-row");
    const currentStoryIds = Array.from(existingRows).map((row) =>
      row.getAttribute("data-story-id")
    );
    const newStoryIds = this.activeQueue.map((story) => story.id.toString());

    // Find which stories are new
    const newStories = this.activeQueue.filter(
      (story) => !currentStoryIds.includes(story.id.toString())
    );

    // Update existing rows that match current stories
    existingRows.forEach((row, index) => {
      const storyId = row.getAttribute("data-story-id");
      const matchingStory = this.activeQueue.find(
        (s) => s.id.toString() === storyId
      );

      if (matchingStory) {
        // Update the existing row
        this.updateStoryRow(row, matchingStory.getDisplayData());
      } else {
        // This row needs to be replaced with a new story
        if (newStories.length > 0) {
          const newStory = newStories.shift();
          const newStoryData = newStory.getDisplayData();

          // Update the row data and content
          row.setAttribute("data-story-id", newStory.id);

          // Update each column
          const timeCol = row.querySelector(".time-column");
          const destCol = row.querySelector(".destination-column");
          const idCol = row.querySelector(".id-column");
          const statusCol = row.querySelector(".status-column");

          if (timeCol) {
            timeCol.innerHTML = "";
            timeCol.appendChild(
              this.createCharacterBoxes(newStoryData.duration, "time")
            );
          }
          if (destCol) {
            destCol.innerHTML = "";
            destCol.appendChild(
              this.createCharacterBoxes(newStoryData.title, "destination")
            );
          }
          if (idCol) {
            idCol.innerHTML = "";
            const cipherCode = this.getCipherCode(newStoryData.id);
            idCol.appendChild(this.createCharacterBoxes(cipherCode, "id"));
          }
          if (statusCol) {
            statusCol.innerHTML = "";
            statusCol.appendChild(
              this.createCharacterBoxes(newStoryData.status, "status")
            );
          }
        }
      }
    });

    // Apply FLIP animation only to changed elements
    if (flipState && typeof window !== "undefined" && window.Flip) {
      window.Flip.from(flipState, {
        duration: 0.4,
        ease: "power2.inOut",
        targets: ".story-row",
      });
    }
  }

  updateStoryData(oldStory) {
    // Fallback method when no row is found - just remove to bin
    this.removeToBin(oldStory);
  }

  animateStatusChange(storyId, newStatus) {
    const row = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!row) return;

    const statusCol = row.querySelector(".status-column");
    if (!statusCol) return;

    // Get all character boxes in the status column
    const charElements = statusCol.querySelectorAll(".char");
    if (charElements.length === 0) return;

    // Create new text for comparison
    const newText = newStatus
      .padEnd(this.columnWidths.status, " ")
      .substring(0, this.columnWidths.status);

    // Animate each character with staggered timing
    charElements.forEach((charElement, index) => {
      setTimeout(() => {
        // Add flip animation to individual character
        charElement.style.transformOrigin = "center center";
        charElement.style.transform = "rotateX(0deg)";
        charElement.style.animation =
          "flipY 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)";

        // Update character content halfway through animation
        setTimeout(() => {
          const newChar = newText[index];
          if (newChar !== undefined) {
            charElement.textContent = newChar === " " ? "\u00A0" : newChar;
            charElement.className = newChar === " " ? "char space" : "char";
          }
        }, 250); // Updated timing for 0.5s animation

        // Clean up animation
        setTimeout(() => {
          charElement.style.animation = "";
        }, 500); // Updated timing for 0.5s animation
      }, index * 100); // Increased stagger to 100ms for more visible effect
    });
  }

  fadeOutStory(storyId) {
    const row = document.querySelector(`[data-story-id="${storyId}"]`);
    if (row) {
      if (typeof window !== "undefined" && window.gsap) {
        window.gsap.to(row, {
          opacity: 0,
          y: -20,
          duration: 0.5,
          ease: "power2.in",
          onComplete: () => {
            // Mark for removal after fade completes
            row.style.visibility = "hidden";
          },
        });
      } else {
        // CSS fallback
        row.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        row.style.opacity = "0";
        row.style.transform = "translateY(-20px)";

        setTimeout(() => {
          row.style.visibility = "hidden";
        }, 500);
      }
    }
  }

  createStoryRow(storyData, storyIndex = 0) {
    const row = document.createElement("div");
    row.className = "story-row";
    row.setAttribute("data-story-id", storyData.id);

    if (storyData.isPlaying) {
      row.classList.add("playing");
    }

    // Time column
    const timeCol = document.createElement("div");
    timeCol.className = "time-column";
    timeCol.appendChild(this.createCharacterBoxes(storyData.duration, "time"));
    row.appendChild(timeCol);

    // Destination column with marquee
    const destCol = document.createElement("div");
    destCol.className = "destination-column";
    destCol.appendChild(this.createMarqueeTitle(storyData.title, storyIndex));
    row.appendChild(destCol);

    // ID column
    const idCol = document.createElement("div");
    idCol.className = "id-column";
    const cipherCode = this.getCipherCode(storyData.id);
    idCol.appendChild(this.createCharacterBoxes(cipherCode, "id"));
    row.appendChild(idCol);

    // Status column
    const statusCol = document.createElement("div");
    statusCol.className = "status-column";
    statusCol.appendChild(
      this.createCharacterBoxes(storyData.status, "status")
    );
    row.appendChild(statusCol);

    return row;
  }

  updateStoryRow(row, storyData) {
    // Update playing state
    if (storyData.isPlaying) {
      row.classList.add("playing");
    } else {
      row.classList.remove("playing");
    }

    // Update destination column with new marquee
    const destCol = row.querySelector(".destination-column");
    if (destCol) {
      const storyIndex = this.activeQueue.findIndex(
        (s) => s.id === storyData.id
      );
      destCol.innerHTML = "";
      destCol.appendChild(this.createMarqueeTitle(storyData.title, storyIndex));
    }

    // Don't update status column if it's currently being animated
    const statusCol = row.querySelector(".status-column");
    if (statusCol) {
      const hasAnimation = Array.from(statusCol.querySelectorAll(".char")).some(
        (char) => char.style.animation && char.style.animation.includes("flipY")
      );

      if (!hasAnimation) {
        statusCol.innerHTML = "";
        statusCol.appendChild(
          this.createCharacterBoxes(storyData.status, "status")
        );
      }
    }
  }

  checkForRestart() {
    // If all stories are in the bin, restart the experience
    if (this.bin.length === this.allStories.length) {
      setTimeout(() => {
        this.restartExperience();
      }, 2000);
    }
  }

  restartExperience() {
    // console.log("🔄 RESTARTING EXPERIENCE");

    // Clear bin and queue
    this.bin = [];
    this.activeQueue = [];
    this.currentPlayingStory = null;
    this.languageHistory = [];

    // Reset all stories to their initial state
    this.allStories.forEach((story) => {
      story.hasBeenPlayed = false;
      story.isPlaying = false;
      story.currentStatus = "ONTIME";
      story.audioFailed = false;
      if (story.audioElement) {
        story.audioElement.pause();
        story.audioElement.currentTime = 0;
      }
    });

    // Initialize the queue with fresh stories
    this.fillQueue();

    // Initial render
    this.renderBoard();

    // Start the selection cycle after delay
    setTimeout(() => {
      this.selectRandomStory();
    }, 8000);
  }

  destroy() {
    // Stop all playing stories
    this.activeQueue.forEach((story) => story.stop());

    // Clean up subtitle container
    if (this.subtitleContainer && this.subtitleContainer.parentNode) {
      this.subtitleContainer.parentNode.removeChild(this.subtitleContainer);
    }
  }

  createSubtitleContainer() {
    this.subtitleContainer = document.createElement("div");
    this.subtitleContainer.className = "fullscreen-subtitles";
    this.subtitleContainer.style.cssText =
      "position: fixed;" +
      "top: 0;" +
      "left: 0;" +
      "width: 100vw;" +
      "height: 100vh;" +
      "background: rgba(0, 0, 0, 0.9);" +
      "display: flex;" +
      "flex-direction: column;" +
      "justify-content: center;" +
      "align-items: center;" +
      "z-index: 1000;" +
      "opacity: 0;" +
      "visibility: hidden;" +
      "transition: opacity 0.5s ease, visibility 0.5s ease;";
    document.body.appendChild(this.subtitleContainer);
  }

  // Simple dashboard visibility
  showDashboard() {
    const dashboard = document.querySelector(".departure-board");
    if (dashboard) {
      dashboard.style.opacity = "1";
    }
    // Re-trigger fade-in animations for story rows
    setTimeout(() => {
      this.renderBoard();
    }, 100);
  }

  hideDashboard() {
    const dashboard = document.querySelector(".departure-board");
    if (dashboard) {
      dashboard.style.opacity = "0";
    }
  }

  // Simple subtitle visibility
  showSubtitles() {
    this.subtitleContainer.style.visibility = "visible";
    this.subtitleContainer.style.opacity = "1";
  }

  hideSubtitles() {
    this.subtitleContainer.style.opacity = "0";
    setTimeout(() => {
      this.subtitleContainer.style.visibility = "hidden";
      this.subtitleContainer.innerHTML = "";
      this.isShowingSubtitles = false;
    }, 500);
  }

  endStory(story) {
    // Mark story as completed
    story.hasBeenPlayed = true;
    story.isPlaying = false;

    // Clear current playing story
    if (this.currentPlayingStory === story) {
      this.currentPlayingStory = null;
    }

    // Clean up audio
    if (story.audioElement) {
      story.audioElement.pause();
      story.audioElement.currentTime = 0;
    }

    // Hide subtitles and show dashboard
    this.hideSubtitles();
    this.showDashboard();

    // Fade out the completed story
    this.fadeOutStory(story.id);

    // Story will be moved to bin by processCompletedStories which triggers selection
    this.processCompletedStories();
  }

  completeStoryPlayback(story) {
    // Clear subtitle text immediately but keep black background
    const marqueeElements = this.subtitleContainer.querySelectorAll(
      ".subtitle-marquee div"
    );
    marqueeElements.forEach((element) => {
      element.style.display = "none";
    });

    // Wait 5 seconds then end story and transition back to dashboard
    setTimeout(() => {
      this.endStory(story);
    }, 5000);
  }

  showFullscreenSubtitles(story) {
    if (this.isShowingSubtitles) return;

    const config = story.getSubtitleConfiguration();
    if (config.subtitles.length === 0) {
      // No subtitles, wait 5 seconds then end story
      setTimeout(() => {
        this.endStory(story);
      }, 5000);
      return;
    }

    // Hide dashboard and show subtitles
    this.hideDashboard();

    setTimeout(() => {
      this.isShowingSubtitles = true;
      this.renderSubtitles(config);
      this.showSubtitles();
      this.setupStoryCompletionTracking(story, config);
    }, 2000);
  }

  setupStoryCompletionTracking(story, config) {
    // Track completion states
    let audioCompleted = false;
    let subtitlesCompleted = false;

    // Function to check if we can end the story
    const checkForStoryEnd = () => {
      if (audioCompleted && subtitlesCompleted) {
        this.completeStoryPlayback(story);
      }
    };

    // Start audio
    if (story && story.startAudio) {
      story.startAudio();
    }

    // Set up audio completion tracking
    const subtitleDuration = config.duration || 10;
    const audioDuration = story.audioElement ? story.audioElement.duration : 0;

    if (story.audioElement && audioDuration > 0) {
      // Listen for audio end event
      const handleAudioEnd = () => {
        audioCompleted = true;
        story.audioElement.removeEventListener("ended", handleAudioEnd);
        checkForStoryEnd();
      };
      story.audioElement.addEventListener("ended", handleAudioEnd);

      // Fallback timeout in case audio doesn't fire 'ended' event
      setTimeout(() => {
        if (!audioCompleted) {
          audioCompleted = true;
          checkForStoryEnd();
        }
      }, audioDuration * 1000 + 1000);
    } else {
      // No valid audio, mark as completed immediately
      audioCompleted = true;
    }

    // Set up subtitle completion tracking
    setTimeout(() => {
      subtitlesCompleted = true;
      checkForStoryEnd();
    }, subtitleDuration * 1000);
  }

  startCountdownTimer(remainingTimeElement, totalDuration) {
    // Ensure we're working with whole seconds only
    let timeLeft = Math.floor(totalDuration);

    const updateTimer = () => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = Math.floor(timeLeft % 60);
      remainingTimeElement.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;

      if (timeLeft > 0) {
        timeLeft--;
        setTimeout(updateTimer, 1000);
      }
    };

    // Start the countdown immediately with initial value
    updateTimer();
  }

  renderSubtitles(config) {
    this.subtitleContainer.innerHTML = "";

    const duration = config.duration || 10; // fallback duration
    const subtitleCount = config.subtitles.length;
    const story = this.currentPlayingStory;

    // Add story info header
    const storyInfo = document.createElement("div");
    storyInfo.className = "story-info";

    const storyTitle = document.createElement("div");
    storyTitle.className = "story-title";
    storyTitle.textContent = story ? story.title : "UNTITLED";

    const remainingTime = document.createElement("div");
    remainingTime.className = "remaining-time";
    remainingTime.textContent = `${Math.floor(duration / 60)}:${(duration % 60)
      .toString()
      .padStart(2, "0")}`;

    storyInfo.appendChild(storyTitle);
    storyInfo.appendChild(remainingTime);
    this.subtitleContainer.appendChild(storyInfo);

    // Add subtitle content
    const subtitleContent = document.createElement("div");
    subtitleContent.className = "subtitle-content";

    config.subtitles.forEach((subtitle, index) => {
      const subtitleRow = document.createElement("div");
      subtitleRow.className = "subtitle-marquee " + subtitle.language;

      const marqueeText = document.createElement("div");
      marqueeText.textContent = subtitle.text;
      marqueeText.style.animation = "marquee " + duration + "s linear 1";
      marqueeText.style.display = "inline-block"; // Ensure it's visible for new stories

      subtitleRow.appendChild(marqueeText);
      subtitleContent.appendChild(subtitleRow);
    });

    this.subtitleContainer.appendChild(subtitleContent);

    // Start countdown timer
    this.startCountdownTimer(remainingTime, duration);
  }
}

export { DepartureBoard };
