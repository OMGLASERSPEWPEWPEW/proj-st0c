// frontend/src/app/api/rnn-predictions/route.ts
// API endpoint to load historical RNN predictions

import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { RNNDailyPrediction, RNNHistoricalResults } from '@/utils/rnnTracker';

export async function GET() {
  console.log('rnn-predictions.GET: Loading historical RNN predictions');
  
  try {
    // Look in project root/data/ChatGPTRNN, not frontend/data/ChatGPTRNN
    const rnnDataDir = join(process.cwd(), '..', 'data', 'ChatGPTRNN');
    
    let files: string[] = [];
    try {
      files = await readdir(rnnDataDir);
    } catch (error) {
      console.log('rnn-predictions.GET: ChatGPTRNN directory not found at', rnnDataDir, 'returning empty array');
      return NextResponse.json([]);
    }
    
    const jsonFiles = files
      .filter(file => file.endsWith('.json'))
      .sort(); // Chronological order
    
    console.log('rnn-predictions.GET: Found', jsonFiles.length, 'RNN prediction files');
    
    const predictions: RNNHistoricalResults[] = [];
    
    for (const file of jsonFiles) {
      try {
        const filePath = join(rnnDataDir, file);
        const content = await readFile(filePath, 'utf-8');
        const data: RNNDailyPrediction = JSON.parse(content);
        
        // Convert to historical results format
        const historical: RNNHistoricalResults = {
          date: data.date,
          predictions: {}
        };
        
        Object.entries(data.predictions).forEach(([ticker, pred]) => {
          historical.predictions[ticker] = {
            predicted_next_day_pct: pred.predicted_next_day_pct,
            // actual results will be calculated later when we have next day's data
          };
        });
        
        predictions.push(historical);
      } catch (error) {
        console.error(`rnn-predictions.GET: Error reading ${file}:`, error);
        // Skip malformed files but continue processing others
      }
    }
    
    console.log('rnn-predictions.GET: Loaded', predictions.length, 'historical predictions');
    return NextResponse.json(predictions);
  } catch (error) {
    console.error('rnn-predictions.GET: Error loading predictions:', error);
    return NextResponse.json(
      { error: 'Failed to load predictions' },
      { status: 500 }
    );
  }
}

// File: frontend/src/app/api/rnn-predictions/route.ts - Character count: 1945