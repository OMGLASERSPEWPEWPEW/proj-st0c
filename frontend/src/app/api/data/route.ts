// frontend/src/app/api/data/route.ts
// API endpoint to auto-load all JSON files from data/raw directory

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process'; // <-- ADD THIS LINE

// Function to run the Python script for ML data preparation
function runMlDataPrep() {
  const scriptPath = path.join(process.cwd(), '..', 'ml', 'scripts', 'prepare_data.py');
  
  // Check if the script exists before trying to run it
  if (!fs.existsSync(scriptPath)) {
    console.log('api/data.runMlDataPrep: Python script not found at', scriptPath);
    return;
  }
  
  console.log('api/data.runMlDataPrep: Triggering ML data preparation script.');

  // Use 'python3' or 'python' depending on your system setup
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`api/data.runMlDataPrep: exec error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`api/data.runMlDataPrep: stderr: ${stderr}`);
      return;
    }
    console.log(`api/data.runMlDataPrep: stdout: ${stdout}`);
  });
}

export async function GET(request: NextRequest) {
  console.log('api/data.GET: Loading all JSON files from data/raw');
  
  try {
    // Path to data/raw relative to the frontend directory
    const dataRawPath = path.join(process.cwd(), '..', 'data', 'raw');
    
    console.log('api/data.GET: Looking for files in', dataRawPath);
    
    if (!fs.existsSync(dataRawPath)) {
      console.log('api/data.GET: data/raw directory does not exist');
      return NextResponse.json({ 
        success: false, 
        error: 'data/raw directory not found',
        files: [],
        entries: []
      });
    }

    const files = fs.readdirSync(dataRawPath)
      .filter(file => file.endsWith('.json'))
      .sort();
    
    console.log('api/data.GET: Found JSON files:', files);

    const allEntries = [];
    // ... (rest of the file reading logic remains the same)
    for (const filename of files) {
      try {
        const filePath = path.join(dataRawPath, filename);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        
        if (jsonData.date && jsonData.tickers) {
          allEntries.push(jsonData);
        }
      } catch (e) {
        // ... error handling
      }
    }

    allEntries.sort((a, b) => a.date.localeCompare(b.date));

    // --- TRIGGER ML SCRIPT ---
    // After successfully reading the files, run the prep script.
    if (allEntries.length > 0) {
      runMlDataPrep();
    }
    // -------------------------

    console.log('api/data.GET: Returning', allEntries.length, 'entries from', files.length, 'files');

    return NextResponse.json({
      success: true,
      files: [], // Simplified for this example, fileDetails logic can remain
      entries: allEntries,
      totalFiles: files.length,
      totalEntries: allEntries.length
    });

  } catch (e) {
    console.error('api/data.GET: Failed to load from data/raw:', e);
    return NextResponse.json({ 
      success: false, 
      error: e instanceof Error ? e.message : 'Unknown error',
      files: [],
      entries: []
    });
  }
}