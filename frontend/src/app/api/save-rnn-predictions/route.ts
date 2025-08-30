// frontend/src/app/api/save-rnn-prediction/route.ts
// API endpoint to save RNN daily predictions

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { RNNDailyPrediction } from '@/utils/rnnTracker';

export async function POST(request: NextRequest) {
  console.log('save-rnn-prediction.POST: Received request to save RNN prediction');
  
  try {
    const prediction: RNNDailyPrediction = await request.json();
    
    // Validate the prediction data
    if (!prediction.date || !prediction.predictions) {
      return NextResponse.json(
        { error: 'Missing required fields: date and predictions' },
        { status: 400 }
      );
    }
    
    // Save to project root/data/ChatGPTRNN/{date}.json
    const rnnDataDir = join(process.cwd(), '..', 'data', 'ChatGPTRNN');
    
    // Ensure directory exists
    try {
      await mkdir(rnnDataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }
    
    const filePath = join(rnnDataDir, `${prediction.date}.json`);
    await writeFile(filePath, JSON.stringify(prediction, null, 2));
    
    console.log('save-rnn-prediction.POST: Successfully saved prediction to', filePath);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('save-rnn-prediction.POST: Error saving prediction:', error);
    return NextResponse.json(
      { error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}

// File: frontend/src/app/api/save-rnn-prediction/route.ts - Character count: 1439