class Story {
  constructor(data) {
    this.id = data.ID || data.id;
    this.title = data.Title?.trim() || "UNTITLED";
    this.audioDuration = data["Audio Duration"] || "0:00";
    this.audioFile = data["Audio File"];
    this.originalStatus = data.Status;
    this.mandarin = data.Mandarin;
    this.english = data.English;
    this.hakka = data.Hakka;

    // Internal state management
    this.currentStatus = this.mapStatus(this.originalStatus);
    this.isPlaying = false;
    this.hasBeenPlayed = false;
    this.delayStartTime = null;
    this.delayDuration = 0;

    // Audio element for playback
    this.audioElement = null;

    // Initialize if has audio
    if (this.audioFile && this.audioFile.startsWith("/audio/")) {
      this.initializeAudio();
    }

    // Set random delay for delayed stories
    if (this.currentStatus === "DELAYED") {
      this.delayDuration = Math.random() * 10000 + 3000; // 3-13 seconds
      this.delayStartTime = Date.now();
    }
  }

  mapStatus(originalStatus) {
    const statusMap = {
      Backlog: "DELAYED",
      "In Progress": "GATEOPEN",
      Done: "ONTIME",
      Cancelled: "CANCELED",
    };

    // Add some randomness for stories without clear status
    if (!originalStatus || originalStatus === "Backlog") {
      const random = Math.random();
      if (random < 0.1) return "CANCELED";
      if (random < 0.3) return "DELAYED";
      if (random < 0.6) return "ONTIME";
      return "GATEOPEN";
    }

    return statusMap[originalStatus] || "ONTIME";
  }

  initializeAudio() {
    this.audioElement = new Audio(this.audioFile);
    this.audioElement.addEventListener("ended", () => {
      this.onAudioEnded();
    });
    this.audioElement.addEventListener("loadedmetadata", () => {
      // Update duration with actual audio duration if different
      const minutes = Math.floor(this.audioElement.duration / 60);
      const seconds = Math.floor(this.audioElement.duration % 60);
      this.audioDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    });
  }

  canPlay() {
    if (!this.audioElement || this.hasBeenPlayed) return false;
    if (this.currentStatus === "CANCELED") return false;
    if (this.currentStatus === "DELAYED") {
      return Date.now() - this.delayStartTime >= this.delayDuration;
    }
    return this.currentStatus === "GATEOPEN";
  }

  shouldRemove() {
    return (
      this.hasBeenPlayed &&
      (this.currentStatus === "CANCELED" || !this.audioElement)
    );
  }

  play() {
    if (!this.canPlay() || this.isPlaying) return false;

    this.isPlaying = true;
    this.currentStatus = "GATEOPEN";

    if (this.audioElement) {
      this.audioElement.play().catch((error) => {
        console.error("Error playing audio:", error);
        this.onAudioEnded();
      });
    }

    return true;
  }

  stop() {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    this.isPlaying = false;
  }

  onAudioEnded() {
    this.isPlaying = false;
    this.hasBeenPlayed = true;
    this.currentStatus = "ONTIME";

    // Dispatch custom event for UI updates
    document.dispatchEvent(
      new CustomEvent("storyEnded", {
        detail: { storyId: this.id },
      })
    );
  }

  updateStatus() {
    // Handle delayed stories becoming available
    if (this.currentStatus === "DELAYED" && this.canPlay()) {
      this.currentStatus = "GATEOPEN";
      document.dispatchEvent(
        new CustomEvent("storyStatusChanged", {
          detail: { storyId: this.id, newStatus: this.currentStatus },
        })
      );
    }
  }

  getDisplayStatus() {
    return this.currentStatus;
  }

  getSubtitle() {
    // Return appropriate subtitle based on available languages
    if (this.isPlaying) {
      return this.english || this.mandarin || this.hakka || "";
    }
    return "";
  }

  // Get story data for display
  getDisplayData() {
    return {
      id: this.id,
      title: this.title,
      duration: this.audioDuration,
      status: this.getDisplayStatus(),
      isPlaying: this.isPlaying,
      subtitle: this.getSubtitle(),
    };
  }
}

export { Story };
