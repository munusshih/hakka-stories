import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPREADSHEET_ID = '1RiBTlBxc9aANoe3ss_W78T3QWZxwqPMsUc6O_T8v7Hg';
const TAB_NAME = 'Sheet1'; // Change this if your tab has a different name
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function fetchSheetData() {
  try {
    const url = `https://opensheet.elk.sh/${SPREADSHEET_ID}/${TAB_NAME}`;
    console.log(`Fetching data from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Fetched ${data.length} rows from Google Sheets`);
    
    return data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

function convertGoogleDriveURL(url) {
  // Convert Google Drive sharing URL to direct download URL
  if (url.includes('drive.google.com')) {
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
  }
  return url;
}

async function getAudioDuration(filePath) {
  try {
    // Read first few bytes to check if it's a valid MP3
    const buffer = fs.readFileSync(filePath);
    
    // Simple MP3 duration estimation based on file size and typical bitrate
    // This is approximate but works without external dependencies
    const fileSizeBytes = buffer.length;
    const averageBitrate = 128; // Assume 128 kbps average
    const durationSeconds = (fileSizeBytes * 8) / (averageBitrate * 1000);
    
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.floor(durationSeconds % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error(`Error getting duration for ${filePath}:`, error);
    return '--:--';
  }
}

async function downloadMP3(url, filename) {
  try {
    console.log(`Downloading MP3: ${filename}`);
    const downloadUrl = convertGoogleDriveURL(url);
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const filePath = path.join(AUDIO_DIR, filename);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));
    console.log(`Downloaded: ${filename}`);
    
    // Get duration after download
    const duration = await getAudioDuration(filePath);
    
    return { localPath: `/audio/${filename}`, duration };
  } catch (error) {
    console.error(`Error downloading ${filename}:`, error);
    return { localPath: url, duration: '0:00' }; // Return original URL if download fails
  }
}

function convertToJSON(data) {
  return data.map((row, index) => ({
    id: index + 1,
    ...row
  }));
}

async function processAudioFiles(data) {
  const processedData = [];
  
  for (const row of data) {
    const processedRow = { ...row };
    
    // Look for audio URLs in any column
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && (
        value.includes('.mp3') || 
        value.includes('.wav') || 
        value.includes('.m4a') || 
        value.includes('drive.google.com')
      )) {
        // Generate filename
        let filename;
        if (value.includes('drive.google.com')) {
          // For Google Drive files, create a meaningful filename
          const storyId = row.ID || row.id || 'unknown';
          filename = `story_${storyId}_audio.mp3`;
        } else {
          // Extract filename from URL
          filename = value.split('/').pop();
          if (!filename.match(/\.(mp3|wav|m4a)$/i)) {
            filename = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
          }
        }
        
        // Download the audio file and get duration
        const audioInfo = await downloadMP3(value, filename);
        processedRow[key] = audioInfo.localPath;
        processedRow['Audio Duration'] = audioInfo.duration;
      }
    }
    
    // If no audio file was processed, set duration to 0:00
    if (!processedRow['Audio Duration']) {
      processedRow['Audio Duration'] = '0:00';
    }
    
    processedData.push(processedRow);
  }
  
  return processedData;
}

async function main() {
  try {
    console.log('Starting data fetch and processing...');
    
    // Fetch data from Google Sheets
    const rawData = await fetchSheetData();
    
    if (!rawData || rawData.length === 0) {
      console.log('No data found in the sheet');
      return;
    }
    
    // Process any MP3 files
    const processedData = await processAudioFiles(rawData);
    
    // Convert to clean JSON format
    const jsonData = convertToJSON(processedData);
    
    // Write JSON file
    const jsonPath = path.join(OUTPUT_DIR, 'stories.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`JSON file written to: ${jsonPath}`);
    
    console.log('Data processing completed successfully!');
    
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();