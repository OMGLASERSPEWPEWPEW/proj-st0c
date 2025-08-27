// frontend/src/app/api/data/route.ts
// API endpoint to auto-load all JSON files from data/raw directory

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  console.log('api/data.GET: Loading all JSON files from data/raw');
  
  try {
    // Path to data/raw relative to the frontend directory
    const dataRawPath = path.join(process.cwd(), '..', 'data', 'raw');
    
    console.log('api/data.GET: Looking for files in', dataRawPath);
    
    // Check if directory exists
    if (!fs.existsSync(dataRawPath)) {
      console.log('api/data.GET: data/raw directory does not exist');
      return NextResponse.json({ 
        success: false, 
        error: 'data/raw directory not found',
        files: [],
        entries: []
      });
    }

    // Read all JSON files
    const files = fs.readdirSync(dataRawPath)
      .filter(file => file.endsWith('.json'))
      .sort();
    
    console.log('api/data.GET: Found JSON files:', files);

    const allEntries = [];
    const fileDetails = [];

    for (const filename of files) {
      try {
        const filePath = path.join(dataRawPath, filename);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        
        // Validate it's a tracker entry
        if (jsonData.date && jsonData.tickers) {
          allEntries.push(jsonData);
          fileDetails.push({
            filename,
            date: jsonData.date,
            schema_version: jsonData.schema_version || 'v1',
            tickers: Object.keys(jsonData.tickers).length,
            success: true
          });
          console.log('api/data.GET: Successfully loaded', filename, 'date:', jsonData.date);
        } else {
          fileDetails.push({
            filename,
            error: 'Invalid tracker format',
            success: false
          });
        }
      } catch (e) {
        console.error('api/data.GET: Failed to process', filename, e);
        fileDetails.push({
          filename,
          error: e instanceof Error ? e.message : 'Unknown error',
          success: false
        });
      }
    }

    // Sort entries by date
    allEntries.sort((a, b) => a.date.localeCompare(b.date));

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

// File: frontend/src/app/api/data/route.ts - Character count: 2347