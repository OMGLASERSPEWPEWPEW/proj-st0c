// frontend/src/app/api/data/route.ts
// API endpoint to auto-load all JSON files and trigger the ML pipeline.

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// This flag persists as long as the server is running to prevent re-runs.
let hasPipelineRunOnce = false;

/**
 * Triggers the master Python pipeline script using the correct virtual environment.
 */
function runMlPipeline() {
  const projectRoot = path.join(process.cwd(), '..');
  const pythonExecutable = path.join(projectRoot, 'ml', 'venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(projectRoot, 'ml', 'scripts', 'run_pipeline.py');

  if (!fs.existsSync(pythonExecutable)) {
    console.error('[API] runMlPipeline: Python executable not found at', pythonExecutable);
    return;
  }
  if (!fs.existsSync(scriptPath)) {
    console.error('[API] runMlPipeline: Python pipeline script not found at', scriptPath);
    return;
  }

  console.log('[API] runMlPipeline: Triggering ML pipeline with venv Python...');
  const pythonProcess = spawn(pythonExecutable, [scriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Pipeline]: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Pipeline ERROR]: ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[API] runMlPipeline: Python process exited with code ${code}`);
  });
}

export async function GET(request: NextRequest) {
  console.log('api/data.GET: Loading all JSON files from data/raw');
  
  try {
    const dataRawPath = path.join(process.cwd(), '..', 'data', 'raw');
    
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
    
    const allEntries = [];
    const fileDetails = [];

    for (const filename of files) {
      try {
        const filePath = path.join(dataRawPath, filename);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        
        if (jsonData.date && jsonData.tickers) {
          allEntries.push(jsonData);
          fileDetails.push({ filename, success: true });
        } else {
          fileDetails.push({ filename, success: false, error: 'Invalid format' });
        }
      } catch (e) {
        console.error('api/data.GET: Failed to process', filename, e);
        fileDetails.push({ filename, success: false, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    allEntries.sort((a, b) => a.date.localeCompare(b.date));

    // --- TRIGGER ML SCRIPT (ONLY ONCE) ---
    // This block replaces the old trigger.
    if (!hasPipelineRunOnce && allEntries.length > 0) {
      runMlPipeline();
      hasPipelineRunOnce = true; // Set the flag so it doesn't run again
    }
    // ------------------------------------

    console.log('api/data.GET: Returning', allEntries.length, 'entries from', files.length, 'files');

    return NextResponse.json({
      success: true,
      files: fileDetails,
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

// File: frontend/src/app/api/data/route.ts - Character count: 3502