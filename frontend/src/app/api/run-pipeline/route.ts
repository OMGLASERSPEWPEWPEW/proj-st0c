// frontend/src/app/api/run-pipeline/route.ts
// Dedicated API endpoint to manually trigger the ML pipeline.

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// This is the same trusted function from our other API route
function runMlPipeline() {
  const projectRoot = path.join(process.cwd(), '..');
  const pythonExecutable = path.join(projectRoot, 'ml', 'venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(projectRoot, 'ml', 'scripts', 'run_pipeline.py');
  
  if (!fs.existsSync(pythonExecutable) || !fs.existsSync(scriptPath)) {
    console.error('[API-Manual] Python executable or script not found.');
    return;
  }
  
  console.log('[API-Manual] Triggering ML pipeline with venv Python...');
  const pythonProcess = spawn(pythonExecutable, [scriptPath]);
  
  pythonProcess.stdout.on('data', (data) => console.log(`[Python Pipeline]: ${data.toString().trim()}`));
  pythonProcess.stderr.on('data', (data) => console.error(`[Python Pipeline ERROR]: ${data.toString().trim()}`));
  pythonProcess.on('close', (code) => console.log(`[API-Manual] Python process exited with code ${code}`));
}

export async function POST() {
  console.log('[API-Manual] Received request to run ML pipeline.');
  try {
    runMlPipeline();
    return NextResponse.json({ message: 'ML Pipeline triggered successfully.' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger ML Pipeline.' }, { status: 500 });
  }
}