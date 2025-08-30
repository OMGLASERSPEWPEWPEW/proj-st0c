// frontend/src/utils/rnnTracker.ts
// Service for managing RNN prediction history and metadata

export type RNNDailyPrediction = {
  date: string; // YYYY-MM-DD
  created_at: string; // ISO timestamp
  predictions: {
    [ticker: string]: {
      predicted_next_day_pct: number;
      confidence?: number;
    };
  };
  metadata: {
    training_data_sources: string[]; // List of JSON files used for training
    model_version: string;
    training_period: {
      start_date: string;
      end_date: string;
    };
    feature_count: number;
    timesteps: number;
    training_samples: number;
  };
  schema_version: string;
};

export type RNNHistoricalResults = {
  date: string;
  predictions: {
    [ticker: string]: {
      predicted_next_day_pct: number;
      actual_pct_change?: number;
      correct?: boolean;
      abs_error_pct?: number;
      daily_pnl?: number;
      quality_score?: number;
    };
  };
};

export async function saveRNNDailyPrediction(prediction: RNNDailyPrediction): Promise<void> {
  console.log('rnnTracker.saveRNNDailyPrediction: Saving prediction for', prediction.date);
  
  try {
    const response = await fetch('/api/save-rnn-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prediction)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save RNN prediction: ${response.statusText}`);
    }
    
    console.log('rnnTracker.saveRNNDailyPrediction: Successfully saved prediction');
  } catch (error) {
    console.error('rnnTracker.saveRNNDailyPrediction: Error saving prediction:', error);
    throw error;
  }
}

export async function loadRNNHistoricalPredictions(): Promise<RNNHistoricalResults[]> {
  console.log('rnnTracker.loadRNNHistoricalPredictions: Loading historical RNN predictions');
  
  try {
    // Load both RNN predictions and raw data to calculate performance
    const [rnnResponse, rawDataResponse] = await Promise.all([
      fetch('/api/rnn-predictions'),
      fetch('/api/data')
    ]);
    
    if (!rnnResponse.ok) {
      throw new Error(`Failed to load RNN predictions: ${rnnResponse.statusText}`);
    }
    
    const rnnPredictions = await rnnResponse.json();
    
    // Handle raw data response safely
    let rawDataEntries: any[] = [];
    if (rawDataResponse.ok) {
      try {
        const rawData = await rawDataResponse.json();
        // Ensure we have an array
        rawDataEntries = Array.isArray(rawData) ? rawData : [];
        console.log('rnnTracker.loadRNNHistoricalPredictions: Loaded', rawDataEntries.length, 'raw data entries');
      } catch (error) {
        console.warn('rnnTracker.loadRNNHistoricalPredictions: Failed to parse raw data response:', error);
        rawDataEntries = [];
      }
    } else {
      console.warn('rnnTracker.loadRNNHistoricalPredictions: Raw data API call failed:', rawDataResponse.statusText);
    }
    
    // Create a map of dates to actual results
    const actualResultsMap: Record<string, any> = {};
    rawDataEntries.forEach((entry: any) => {
      if (entry && entry.date) {
        actualResultsMap[entry.date] = entry;
      }
    });
    
    console.log('rnnTracker.loadRNNHistoricalPredictions: Created results map with', Object.keys(actualResultsMap).length, 'entries');
    
    // Calculate performance for each RNN prediction
    const resultsWithPerformance: RNNHistoricalResults[] = rnnPredictions.map((rnnData: any) => {
      const predictionDate = rnnData.date;
      const nextDayDate = getNextBusinessDay(predictionDate);
      const actualData = actualResultsMap[nextDayDate];
      
      const processedPredictions: Record<string, any> = {};
      
      Object.entries(rnnData.predictions).forEach(([ticker, predData]: [string, any]) => {
        const predicted = predData.predicted_next_day_pct;
        const actual = actualData?.tickers?.[ticker]?.pct_change;
        
        processedPredictions[ticker] = {
          predicted_next_day_pct: predicted,
          actual_pct_change: actual,
          // Calculate metrics only if we have actual data
          ...(actual !== undefined ? {
            abs_error_pct: Math.abs(predicted - actual),
            correct: isDirectionCorrect(predicted, actual),
            daily_pnl: calculateDailyPnL(predicted, actual),
            quality_score: calculateQualityScore(predicted, actual)
          } : {})
        };
      });
      
      return {
        date: predictionDate,
        predictions: processedPredictions
      };
    });
    
    console.log('rnnTracker.loadRNNHistoricalPredictions: Processed', resultsWithPerformance.length, 'historical predictions');
    return resultsWithPerformance;
  } catch (error) {
    console.error('rnnTracker.loadRNNHistoricalPredictions: Error loading predictions:', error);
    return [];
  }
}

// Helper functions
function getNextBusinessDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  
  // Skip weekends (basic implementation)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

function isDirectionCorrect(predicted: number, actual: number): boolean {
  const FLAT_THRESHOLD = 0.5;
  const predictedDirection = predicted > FLAT_THRESHOLD ? 'up' : predicted < -FLAT_THRESHOLD ? 'down' : 'flat';
  const actualDirection = actual > FLAT_THRESHOLD ? 'up' : actual < -FLAT_THRESHOLD ? 'down' : 'flat';
  return predictedDirection === actualDirection;
}

function calculateDailyPnL(predicted: number, actual: number): number {
  // Simple P&L calculation: assume $100 position, correct direction = +$10, wrong = -$5
  const correct = isDirectionCorrect(predicted, actual);
  return correct ? 10 : -5;
}

function calculateQualityScore(predicted: number, actual: number): number {
  const absError = Math.abs(predicted - actual);
  const directionScore = isDirectionCorrect(predicted, actual) ? 40 : 0;
  const magnitudeScore = Math.max(0, 40 * (1 - absError / 10));
  const confidenceBonus = Math.abs(predicted) > 2 ? 20 : 10;
  
  return Math.min(100, directionScore + magnitudeScore + confidenceBonus);
}

// File: frontend/src/utils/rnnTracker.ts - Character count: 1847