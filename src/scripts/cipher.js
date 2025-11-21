/**
 * Cipher module for generating deterministic 5-digit codes from story IDs
 * Uses a combination of mathematical transformations for airport-style codes
 */

class StoryIDCipher {
  constructor() {
    // Prime numbers for transformation
    this.primes = [7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
    // Salt for additional randomization
    this.salt = 42;
  }

  /**
   * Generate a 5-digit cipher code from a story ID
   * @param {number|string} storyId - The original story ID
   * @returns {string} - A 5-digit cipher code (e.g., "42851")
   */
  encode(storyId) {
    const id = parseInt(storyId) || 1;

    // Step 1: Apply multiple transformations
    let hash = this.hashTransform(id);

    // Step 2: Ensure we get a 5-digit number
    let cipherCode = this.to5Digits(hash);

    // Step 3: Apply final character mapping for visual authenticity
    return this.formatCode(cipherCode);
  }

  /**
   * Hash transformation using prime multiplication and bit shifting
   */
  hashTransform(id) {
    let hash = id * this.salt;

    // Apply prime transformations
    hash = ((hash * this.primes[id % this.primes.length]) ^ (id << 3)) >>> 0;
    hash =
      ((hash + this.primes[(id * 3) % this.primes.length]) ^ (hash >>> 7)) >>>
      0;
    hash = (hash * this.primes[(id * 7) % this.primes.length] + id * 13) >>> 0;

    return hash;
  }

  /**
   * Convert hash to exactly 5 digits
   */
  to5Digits(hash) {
    // Take modulo to get 5-digit range (10000-99999)
    let result = (hash % 90000) + 10000;

    // Ensure it's exactly 5 digits
    return Math.abs(result) % 100000;
  }

  /**
   * Format the code to look more airport-like
   * Replace some digits with letters for authenticity
   */
  formatCode(code) {
    let codeStr = code.toString().padStart(5, "0");
    let formatted = "";

    for (let i = 0; i < codeStr.length; i++) {
      const digit = parseInt(codeStr[i]);

      // Convert digits to letters based on position and value for better mix
      if (i === 0 || i === 2) {
        // First and middle positions: convert most digits to letters
        formatted += this.digitToLetter(digit + i * 3);
      } else if (i === 4 && digit >= 5) {
        // Last position: high digits become letters
        formatted += this.digitToLetter(digit + 10);
      } else if (digit === 0 || digit === 1) {
        // Convert 0s and 1s to letters anywhere for better readability
        formatted += this.digitToLetter(digit + 15);
      } else {
        formatted += digit;
      }
    }

    return formatted.toUpperCase();
  }

  /**
   * Convert digit to letter mapping
   */
  digitToLetter(num) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return letters[num % 26];
  }

  /**
   * Batch encode multiple story IDs
   */
  batchEncode(storyIds) {
    const codes = new Map();
    storyIds.forEach((id) => {
      codes.set(id, this.encode(id));
    });
    return codes;
  }

  /**
   * Verify that codes are unique for a set of IDs
   */
  verifyUniqueness(storyIds) {
    const codes = new Set();
    const duplicates = [];

    storyIds.forEach((id) => {
      const code = this.encode(id);
      if (codes.has(code)) {
        duplicates.push({ id, code });
      }
      codes.add(code);
    });

    return {
      unique: duplicates.length === 0,
      duplicates,
      totalCodes: codes.size,
    };
  }
}

// Export both the class and a default instance
const cipher = new StoryIDCipher();

export { StoryIDCipher, cipher };
