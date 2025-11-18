class Story {
  constructor(data) {
    this.id = data.ID || data.id;
    this.title = data.Title?.trim() || "UNTITLED";
    this.audioDuration = data["Audio Duration"] || "0:00";
    this.audioFile = data["Audio File"];
    this.audioLanguage = data["Audio Language"] || "hakka"; // Default to hakka
    this.originalStatus = data.Status;
    this.mandarin = data.Mandarin;
    this.english = data.English;
    this.hakka = data.Hakka;

    // Internal state management
    this.currentStatus = this.mapStatus(this.originalStatus);
    this.isPlaying = false;
    this.hasBeenPlayed = false;
    this.audioFailed = false;
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
    // All stories start as ONTIME regardless of original status
    return "ONTIME";
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
    // Check if story has valid audio first
    const hasValidAudio =
      this.audioFile &&
      this.audioFile !== "" &&
      this.audioDuration !== "0:00" &&
      this.audioDuration !== "0:0" &&
      this.audioDuration !== "";

    if (!hasValidAudio || this.hasBeenPlayed) return false;
    if (this.currentStatus === "CANCELED") return false;
    if (this.currentStatus === "DELAYED") {
      return Date.now() - this.delayStartTime >= this.delayDuration;
    }
    return this.currentStatus === "ONTIME";
  }

  shouldRemove() {
    return (
      this.hasBeenPlayed &&
      (this.currentStatus === "CANCELED" || !this.audioElement || this.audioFailed)
    );
  }

  play() {
    if (!this.canPlay() || this.isPlaying) return false;

    this.isPlaying = true;
    this.currentStatus = "GATEOPEN";

    // Don't start audio immediately - wait for startAudio() call
    return true;
  }

  startAudio() {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.play().catch((error) => {
        console.error("Error playing audio:", error);
        // Mark as failed and dispatch failure event
        this.audioFailed = true;
        this.currentStatus = "CANCELED";
        const failureEvent = new CustomEvent("storyFailed", {
          detail: { storyId: this.id, error: error.message }
        });
        document.dispatchEvent(failureEvent);
        this.onAudioEnded();
      });
    }
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

  getSubtitleConfiguration() {
    const config = {
      subtitles: [],
      duration: this.audioElement ? this.audioElement.duration : 0,
    };

    const audioLang = this.audioLanguage.toLowerCase();

    if (audioLang === "mandarin" || audioLang === "chinese") {
      // Mandarin audio: show English subtitles
      if (this.english) {
        config.subtitles.push({
          text: this.english,
          language: "english",
        });
      }
    } else if (audioLang === "hakka") {
      // Hakka audio: show English and Mandarin subtitles
      if (this.english) {
        config.subtitles.push({
          text: this.english,
          language: "english",
        });
      }
      if (this.mandarin) {
        config.subtitles.push({
          text: this.mandarin,
          language: "mandarin",
        });
      }
    } else if (audioLang === "english") {
      // English audio: show Mandarin subtitles
      if (this.mandarin) {
        config.subtitles.push({
          text: this.mandarin,
          language: "mandarin",
        });
      }
    }

    return config;
  }

  // Get story data for display
  getDisplayData() {
    return {
      id: this.id,
      title: this.title,
      duration: this.audioDuration,
      status: this.getDisplayStatus(),
      isPlaying: this.isPlaying,
      subtitleConfig: this.getSubtitleConfiguration(),
    };
  }
}

export { Story };
