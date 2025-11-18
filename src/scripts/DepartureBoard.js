import { Story } from "./Story.js";

// Initialize GSAP FLIP if available
if (typeof gsap !== 'undefined' && gsap.registerPlugin) {
  gsap.registerPlugin(Flip);
}

class DepartureBoard {
  constructor() {
    this.allStories = []; // All original stories
    this.activeQueue = []; // Currently displayed stories (max 6)
    this.bin = []; // Completed/canceled stories
    this.currentPlayingStory = null;
    this.updateInterval = null;
    this.maxQueueSize = 6;
    this.isShowingSubtitles = false;
    this.subtitleContainer = null;
    this.columnWidths = {
      time: 30,
      destination: 50,
      id: 30,
      status: 20,
    };

    this.setupEventListeners();
    this.createSubtitleContainer();
  }

  async initialize(storiesData) {
    // Create Story objects and store as master list
    this.allStories = storiesData.map((data) => new Story(data));
    this.bin = [];

    // Initialize the queue
    this.fillQueue();

    // Initial render
    this.renderBoard();

    // Start random story selection timer
    this.startRandomSelection();
  }

  startRandomSelection() {
    // Select a random story immediately
    this.selectRandomStory();
    
    // Schedule next selection with random interval
    this.scheduleNextSelection();
  }

  scheduleNextSelection() {
    // Random interval between 5-20 seconds (5000-20000ms)
    const randomInterval = Math.floor(Math.random() * 15000) + 5000;
    console.log(`Next story selection in ${randomInterval/1000} seconds`);
    
    this.selectionTimeout = setTimeout(() => {
      this.selectRandomStory();
      this.scheduleNextSelection(); // Schedule the next one
    }, randomInterval);
  }

  setupEventListeners() {
    // Listen for story events
    document.addEventListener("storyEnded", (event) => {
      this.onStoryEnded(event.detail.storyId);
    });

    document.addEventListener("storyStatusChanged", (event) => {
      this.updateStoryDisplay(event.detail.storyId);
    });

    document.addEventListener("storyFailed", (event) => {
      this.onStoryFailed(event.detail.storyId, event.detail.error);
    });
  }

  // startUpdateLoop() {
  //   this.updateInterval = setInterval(() => {
  //     this.updateStories();
  //   }, 1000); // Update every second
  // }

  updateStories() {
    let needsRerender = false;

    // Update all stories in active queue
    this.activeQueue.forEach((story) => {
      const oldStatus = story.currentStatus;
      story.updateStatus();
      if (oldStatus !== story.currentStatus) {
        needsRerender = true;
      }
    });

    // Console log current state
    console.log("=== DASHBOARD UPDATE ===");
    console.log("Stories on dashboard:", this.activeQueue.map(s => ({
      id: s.id,
      title: s.title,
      status: s.currentStatus,
      hasAudio: !!(s.audioFile && s.audioFile !== "" && s.audioDuration !== "0:00"),
      isPlaying: s.isPlaying
    })));
    
    const availableStories = this.allStories.filter(
      (story) => !this.bin.includes(story) && !this.activeQueue.includes(story)
    );
    console.log("Stories in backlog:", availableStories.map(s => ({
      id: s.id,
      title: s.title,
      hasAudio: !!(s.audioFile && s.audioFile !== "" && s.audioDuration !== "0:00")
    })));
    
    console.log("Stories in bin:", this.bin.map(s => ({
      id: s.id,
      title: s.title,
      status: s.currentStatus
    })));
    console.log("Currently playing:", this.currentPlayingStory ? this.currentPlayingStory.id : "none");
    console.log("========================");

    // Proactively mark stories without valid audio as CANCELED
    this.activeQueue.forEach((story) => {
      if (story.currentStatus !== "CANCELED") {
        const hasValidAudio = story.audioFile && 
                             story.audioFile !== "" &&
                             story.audioDuration !== "0:00" &&
                             story.audioDuration !== "0:0" &&
                             story.audioDuration !== "";
        
        if (!hasValidAudio) {
          story.currentStatus = "CANCELED";
          needsRerender = true;
          // Trigger flip animation for this cancellation
          setTimeout(() => {
            this.animateStatusChange(story.id, "CANCELED");
          }, 100);
        }
      }
    });

    // Enforce only one GATEOPEN story at a time
    this.enforceGateOpenRule();

    // Try to play next story if none is currently playing
    if (!this.currentPlayingStory) {
      this.playNextStory();
    }

    // Move completed stories to bin and refill queue
    this.processCompletedStories();

    // Check if all stories are in bin and restart if needed
    this.checkForRestart();

    if (needsRerender) {
      this.renderBoard();
    }
  }

  flickerRow(storyId) {
    const row = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!row) return;

    console.log(`Flickering row for story ${storyId}`);
    
    // Add flicker class for styling
    row.classList.add('flickering');
    
    // Use GSAP if available, otherwise CSS
    if (typeof gsap !== 'undefined') {
      gsap.to(row, {
        opacity: 0.2,
        duration: 0.15,
        yoyo: true,
        repeat: 5, // 3 full flickers (6 half-cycles)
        ease: "power2.inOut",
        onComplete: () => {
          row.classList.remove('flickering');
          gsap.set(row, { opacity: 1 }); // Ensure it ends at full opacity
        }
      });
    } else {
      // CSS fallback with more dramatic effect
      let flickerCount = 0;
      const flickerInterval = setInterval(() => {
        row.style.opacity = flickerCount % 2 === 0 ? '0.2' : '1';
        row.style.backgroundColor = flickerCount % 2 === 0 ? 'rgba(255, 255, 0, 0.2)' : '';
        flickerCount++;
        if (flickerCount >= 6) {
          clearInterval(flickerInterval);
          row.style.opacity = '1';
          row.style.backgroundColor = '';
          row.classList.remove('flickering');
        }
      }, 150);
    }
  }

  selectRandomStory() {
    console.log("=== SELECTING RANDOM STORY ===");
    console.log("Stories on dashboard:", this.activeQueue.map(s => ({
      id: s.id,
      title: s.title,
      status: s.currentStatus,
      hasAudio: !!(s.audioFile && s.audioFile !== "" && s.audioDuration !== "0:00"),
      isPlaying: s.isPlaying,
      canPlay: s.canPlay()
    })));
    
    const availableStories = this.allStories.filter(
      (story) => !this.bin.includes(story) && !this.activeQueue.includes(story)
    );
    console.log("Stories in backlog:", availableStories.map(s => ({
      id: s.id,
      title: s.title,
      hasAudio: !!(s.audioFile && s.audioFile !== "" && s.audioDuration !== "0:00")
    })));
    
    console.log("Stories in bin:", this.bin.map(s => ({
      id: s.id,
      title: s.title,
      status: s.currentStatus
    })));
    console.log("Currently playing:", this.currentPlayingStory ? this.currentPlayingStory.id : "none");
    console.log("==============================");

    // If someone is currently playing, don't interrupt
    if (this.currentPlayingStory) {
      console.log("Story already playing, waiting...");
      return;
    }

    // Get all stories on dashboard that could potentially be selected
    const dashboardStories = this.activeQueue.filter(story => 
      story.currentStatus !== "CANCELED" && !story.hasBeenPlayed
    );

    if (dashboardStories.length === 0) {
      console.log("No available stories on dashboard");
      this.processCompletedStories();
      return;
    }

    // Randomly select a story from the dashboard
    const randomIndex = Math.floor(Math.random() * dashboardStories.length);
    const selectedStory = dashboardStories[randomIndex];

    console.log(`Randomly selected story ${selectedStory.id}: ${selectedStory.title}`);

    // Add flicker effect to show the row is selected
    this.flickerRow(selectedStory.id);

    // Check if story has valid audio
    const hasValidAudio = selectedStory.audioFile && 
                         selectedStory.audioFile !== "" &&
                         selectedStory.audioDuration !== "0:00" &&
                         selectedStory.audioDuration !== "0:0" &&
                         selectedStory.audioDuration !== "";

    if (!hasValidAudio) {
      // Set status to CANCELED and trigger animation
      selectedStory.currentStatus = "CANCELED";

      // Just animate the status change, no full re-render needed
      setTimeout(() => {
        this.animateStatusChange(selectedStory.id, "CANCELED");
      }, 100);

      // Wait 3-5 seconds before removing CANCELED story
      const stayDuration = Math.floor(Math.random() * 2000) + 3000; // 3000-5000ms
      console.log(`CANCELED story ${selectedStory.id} will be removed in ${stayDuration/1000} seconds`);
      
      setTimeout(() => {
        this.moveToBinAndRefill(selectedStory);
      }, stayDuration);
      return;
    }

    // Story has valid audio, proceed with playing
    const playResult = selectedStory.play();
    if (playResult) {
      // Successfully started playing
      this.currentPlayingStory = selectedStory;
      
      // Wait a moment for any pending renders, then trigger flip animation
      setTimeout(() => {
        this.animateStatusChange(selectedStory.id, "GATEOPEN");
        
        // Only update the internal status after animation starts
        setTimeout(() => {
          this.currentPlayingStory.currentStatus = "GATEOPEN";
        }, 1000);
      }, 100);

      // Wait 5 seconds after status change, then show fullscreen subtitles
      setTimeout(() => {
        this.showFullscreenSubtitles(selectedStory);
      }, 5000);
    } else {
      // Play failed, treat as canceled
      console.log(`Story ${selectedStory.id} failed to play, marking as canceled`);
      selectedStory.currentStatus = "CANCELED";
      
      // Animate to CANCELED and remove from dashboard
      setTimeout(() => {
        this.animateStatusChange(selectedStory.id, "CANCELED");
        
        // Move to bin after animation
        setTimeout(() => {
          this.moveToBinAndRefill(selectedStory);
        }, 1000);
      }, 100);
    }
  }

  onStoryFailed(storyId, error) {
    console.log(`Story ${storyId} audio failed: ${error}`);
    // Don't move to bin immediately - let subtitle play out
    // The story will end naturally after subtitle duration
  }

  onStoryEnded(storyId) {
    const story = this.activeQueue.find((s) => s.id == storyId);
    if (story) {
      this.endStory(story);
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

  renderBoard() {
    const storiesList = document.querySelector(".stories-list");
    if (!storiesList) return;

    const existingRows = storiesList.querySelectorAll(".story-row");
    
    // If no rows exist, do initial render
    if (existingRows.length === 0) {
      this.activeQueue.forEach((story, index) => {
        const storyData = story.getDisplayData();
        const row = this.createStoryRow(storyData);
        
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
      // Just update existing rows - don't do full re-render
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

    // If no stories available and bin is full, reset the bin to start over
    if (availableStories.length === 0 && this.activeQueue.length === 0) {
      console.log("No available stories, resetting bin to restart cycle");
      this.bin = [];
      // Refill with fresh stories
      const freshStories = this.allStories.slice(0, this.maxQueueSize);
      this.activeQueue.push(...freshStories);
      return;
    }

    const needed = this.maxQueueSize - this.activeQueue.length;
    const toAdd = availableStories.slice(0, needed);

    this.activeQueue.push(...toAdd);
  }

  processCompletedStories() {
    const completedStories = this.activeQueue.filter(
      (story) =>
        story.shouldRemove() ||
        story.currentStatus === "CANCELED" ||
        story.hasBeenPlayed
    );

    if (completedStories.length > 0) {
      // Record FLIP state before changes
      let state = null;
      if (typeof Flip !== 'undefined') {
        state = Flip.getState(".story-row");
      }

      // Move completed stories to bin
      completedStories.forEach((story) => {
        const index = this.activeQueue.indexOf(story);
        if (index > -1) {
          this.activeQueue.splice(index, 1);
          this.bin.push(story);
        }
      });

      // Fill queue with new stories to maintain 6 stories
      this.fillQueue();

      // Ensure only currently playing story has GATEOPEN status
      this.enforceGateOpenRule();

      // Update board with targeted changes
      this.updateBoardWithNewStory(state);
    }
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
    const currentStoryIds = Array.from(existingRows).map(row => 
      row.getAttribute("data-story-id")
    );
    const newStoryIds = this.activeQueue.map(story => story.id.toString());

    // Find which stories are new
    const newStories = this.activeQueue.filter(story => 
      !currentStoryIds.includes(story.id.toString())
    );

    // Update existing rows that match current stories
    existingRows.forEach((row, index) => {
      const storyId = row.getAttribute("data-story-id");
      const matchingStory = this.activeQueue.find(s => s.id.toString() === storyId);
      
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
          const timeCol = row.querySelector('.time-column');
          const destCol = row.querySelector('.destination-column'); 
          const idCol = row.querySelector('.id-column');
          const statusCol = row.querySelector('.status-column');
          
          if (timeCol) {
            timeCol.innerHTML = '';
            timeCol.appendChild(this.createCharacterBoxes(newStoryData.duration, "time"));
          }
          if (destCol) {
            destCol.innerHTML = '';
            destCol.appendChild(this.createCharacterBoxes(newStoryData.title, "destination"));
          }
          if (idCol) {
            idCol.innerHTML = '';
            idCol.appendChild(this.createCharacterBoxes(newStoryData.id.toString(), "id"));
          }
          if (statusCol) {
            statusCol.innerHTML = '';
            statusCol.appendChild(this.createCharacterBoxes(newStoryData.status, "status"));
          }
        }
      }
    });

    // Apply FLIP animation only to changed elements
    if (flipState && typeof Flip !== 'undefined') {
      Flip.from(flipState, {
        duration: 0.4,
        ease: "power2.inOut",
        targets: ".story-row"
      });
    }
  }

  moveToBinAndRefill(story) {
    const storyRow = document.querySelector(`[data-story-id="${story.id}"]`);
    
    console.log(`Fading out story ${story.id}`);
    
    // Fade out the current story row first (slower)
    if (storyRow && typeof gsap !== 'undefined') {
      gsap.to(storyRow, {
        opacity: 0,
        y: -30,
        duration: 1.0, // Longer fade out
        ease: "power2.in",
        onComplete: () => {
          // Wait additional 3-5 seconds before showing new story
          const replacementDelay = Math.floor(Math.random() * 2000) + 3000; // 3000-5000ms
          console.log(`New story will fade in after ${replacementDelay/1000} seconds`);
          
          setTimeout(() => {
            this.replaceRowContent(story, storyRow);
          }, replacementDelay);
        }
      });
    } else if (storyRow) {
      // CSS fallback with longer duration
      storyRow.style.transition = "opacity 1.0s ease, transform 1.0s ease";
      storyRow.style.opacity = "0";
      storyRow.style.transform = "translateY(-30px)";
      
      setTimeout(() => {
        const replacementDelay = Math.floor(Math.random() * 2000) + 3000;
        setTimeout(() => {
          this.replaceRowContent(story, storyRow);
        }, replacementDelay);
      }, 1000);
    } else {
      // No row found, just update data with delay
      setTimeout(() => {
        this.updateStoryData(story);
      }, 4000);
    }
  }

  replaceRowContent(oldStory, row) {
    // Remove from active queue and add to bin
    const index = this.activeQueue.indexOf(oldStory);
    if (index > -1) {
      this.activeQueue.splice(index, 1);
      this.bin.push(oldStory);
    }
    
    // Fill queue with new story
    this.fillQueue();
    
    // Get the new story for this position
    const newStory = this.activeQueue[index] || this.activeQueue[0];
    if (newStory) {
      const newStoryData = newStory.getDisplayData();
      
      // Update the row with new content
      row.setAttribute("data-story-id", newStory.id);
      
      // Update each column
      const timeCol = row.querySelector('.time-column');
      const destCol = row.querySelector('.destination-column'); 
      const idCol = row.querySelector('.id-column');
      const statusCol = row.querySelector('.status-column');
      
      if (timeCol) {
        timeCol.innerHTML = '';
        timeCol.appendChild(this.createCharacterBoxes(newStoryData.duration, "time"));
      }
      if (destCol) {
        destCol.innerHTML = '';
        destCol.appendChild(this.createCharacterBoxes(newStoryData.title, "destination"));
      }
      if (idCol) {
        idCol.innerHTML = '';
        idCol.appendChild(this.createCharacterBoxes(newStoryData.id.toString(), "id"));
      }
      if (statusCol) {
        statusCol.innerHTML = '';
        statusCol.appendChild(this.createCharacterBoxes(newStoryData.status, "status"));
      }
      
      // Fade the row back in with new content (slower)
      if (typeof gsap !== 'undefined') {
        gsap.to(row, {
          opacity: 1,
          y: 0,
          duration: 1.0, // Longer fade in
          ease: "power2.out"
        });
      } else {
        // CSS fallback with longer duration
        setTimeout(() => {
          row.style.transition = "opacity 1.0s ease, transform 1.0s ease";
          row.style.opacity = "1";
          row.style.transform = "translateY(0)";
        }, 100);
      }
    }
  }

  updateStoryData(oldStory) {
    // Fallback method when no row is found
    const index = this.activeQueue.indexOf(oldStory);
    if (index > -1) {
      this.activeQueue.splice(index, 1);
      this.bin.push(oldStory);
    }
    this.fillQueue();
    this.renderBoard();
  }  animateStatusChange(storyId, newStatus) {
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
      if (typeof gsap !== 'undefined') {
        gsap.to(row, {
          opacity: 0,
          y: -20,
          duration: 0.5,
          ease: "power2.in",
          onComplete: () => {
            // Mark for removal after fade completes
            row.style.visibility = 'hidden';
          }
        });
      } else {
        // CSS fallback
        row.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        row.style.opacity = "0";
        row.style.transform = "translateY(-20px)";
        
        setTimeout(() => {
          row.style.visibility = 'hidden';
        }, 500);
      }
    }
  }

  createStoryRow(storyData) {
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
    idCol.appendChild(this.createCharacterBoxes(storyData.id.toString(), "id"));
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
    // Reset all stories
    this.allStories.forEach((story) => {
      story.hasBeenPlayed = false;
      story.isPlaying = false;
      story.currentStatus = story.mapStatus(story.originalStatus);
      if (story.audioElement) {
        story.audioElement.currentTime = 0;
      }
    });

    // Clear bin and queue
    this.bin = [];
    this.activeQueue = [];
    this.currentPlayingStory = null;

    // Refill queue and restart
    this.fillQueue();
    this.renderBoard();
  }

  destroy() {
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }

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

  endStory(story) {
    // Mark story as completed
    story.hasBeenPlayed = true;
    story.isPlaying = false;
    
    // Clear current playing story
    if (this.currentPlayingStory === story) {
      this.currentPlayingStory = null;
    }
    
    // Stop audio if playing
    if (story.audioElement) {
      story.audioElement.pause();
      story.audioElement.currentTime = 0;
    }
    
    // Hide subtitles and show dashboard
    this.hideFullscreenSubtitles();
    
    // Fade out the completed story
    this.fadeOutStory(story.id);
    
    // The random timer will handle selecting the next story
  }

  showFullscreenSubtitles(story) {
    if (this.isShowingSubtitles) return;

    const config = story.getSubtitleConfiguration();
    if (config.subtitles.length === 0) {
      // No subtitles, end story immediately
      this.endStory(story);
      return;
    }

    // Fade out dashboard first
    const dashboard = document.querySelector(".departure-board");
    if (dashboard) {
      dashboard.style.transition = "opacity 0.5s ease";
      dashboard.style.opacity = "0";
    }

    // Wait 2 seconds then show subtitles
    setTimeout(() => {
      this.isShowingSubtitles = true;
      this.renderSubtitles(config);

      // Try to start audio (but don't depend on it succeeding)
      if (story && story.startAudio) {
        story.startAudio();
      }

      // Fade in subtitles
      this.subtitleContainer.style.visibility = "visible";
      this.subtitleContainer.style.opacity = "1";

      // End story after subtitle duration (default 10 seconds)
      const duration = config.duration || 10;
      setTimeout(() => {
        this.endStory(story);
      }, duration * 1000);
    }, 2000);
  }

  hideFullscreenSubtitles() {
    if (!this.isShowingSubtitles) return;

    // Fade out subtitles
    this.subtitleContainer.style.opacity = "0";

    setTimeout(() => {
      this.subtitleContainer.style.visibility = "hidden";
      this.subtitleContainer.innerHTML = "";
      this.isShowingSubtitles = false;

      // Fade in dashboard with animation
      const dashboard = document.querySelector(".departure-board");
      if (dashboard) {
        dashboard.style.transition = "opacity 0.5s ease";
        dashboard.style.opacity = "1";

        // Re-trigger fade-in animations for story rows
        setTimeout(() => {
          this.renderBoard();
        }, 100);
      }
    }, 500);
  }

  renderSubtitles(config) {
    this.subtitleContainer.innerHTML = "";

    const duration = config.duration || 10; // fallback duration
    const subtitleCount = config.subtitles.length;

    config.subtitles.forEach((subtitle, index) => {
      const subtitleRow = document.createElement("div");
      subtitleRow.className = "subtitle-marquee " + subtitle.language;
      subtitleRow.style.height = subtitleCount === 1 ? "50vh" : "30vh";

      const marqueeText = document.createElement("div");
      marqueeText.textContent = subtitle.text;
      marqueeText.style.animation = "marquee " + duration + "s linear infinite";

      subtitleRow.appendChild(marqueeText);
      this.subtitleContainer.appendChild(subtitleRow);
    });
  }
}

export { DepartureBoard };
