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
    const response = await fetch('/api/rnn-predictions');
    if (!response.ok) {
      throw new Error(`Failed to load RNN predictions: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('rnnTracker.loadRNNHistoricalPredictions: Loaded', data.length, 'historical predictions');
    return data;
  } catch (error) {
    console.error('rnnTracker.loadRNNHistoricalPredictions: Error loading predictions:', error);
    return [];
  }
}

// export async function loadRNNHistoricalPredictions(): Promise<RNNHistoricalResults[]> {
//   console.log('rnnTracker.loadRNNHistoricalPredictions: Loading historical RNN predictions');
  
//   try {
//     // Load both RNN predictions and raw data to calculate performance
//     const [rnnResponse, rawDataResponse] = await Promise.all([
//       fetch('/api/rnn-predictions'),
//       fetch('/api/data')
//     ]);
    
//     if (!rnnResponse.ok) {
//       throw new Error(`Failed to load RNN predictions: ${rnnResponse.statusText}`);
//     }
    
//     const rnnPredictions = await rnnResponse.json();
//     const rawDataEntries = rawDataResponse.ok ? await rawDataResponse.json() : [];
    
//     // Create a map of dates to actual results
//     const actualResultsMap: Record<string, any> = {};
//     rawDataEntries.forEach((entry: any) => {
//       actualResultsMap[entry.date] = entry;
//     });
    
//     // Calculate performance for each RNN prediction
//     const resultsWithPerformance: RNNHistoricalResults[] = rnnPredictions.map((rnnData: any) => {
//       const predictionDate = rnnData.date;
//       const nextDayDate = getNextBusinessDay(predictionDate);
//       const actualData = actualResultsMap[nextDayDate];
      
//       const processedPredictions: Record<string, any> = {};
      
//       Object.entries(rnnData.predictions).forEach(([ticker, predData]: [string, any]) => {
//         const predicted = predData.predicted_next_day_pct;
//         const actual = actualData?.tickers[ticker]?.pct_change;
        
//         processedPredictions[ticker] = {
//           predicted_next_day_pct: predicted,
//           actual_pct_change: actual,
//           // Calculate metrics only if we have actual data
//           ...(actual !== undefined ? {
//             abs_error_pct: Math.abs(predicted - actual),
//             correct: isDirectionCorrect(predicted, actual),
//             daily_pnl: calculateDailyPnL(predicted, actual),
//             quality_score: calculateQualityScore(predicted, actual)
//           } : {})
//         };
//       });
      
//       return {
//         date: predictionDate,
//         predictions: processedPredictions
//       };
//     });
    
//     console.log('rnnTracker.loadRNNHistoricalPredictions: Loaded and processed', resultsWithPerformance.length, 'historical predictions');
//     return resultsWithPerformance;
//   } catch (error) {
//     console.error('rnnTracker.loadRNNHistoricalPredictions: Error loading predictions:', error);
//     return [];
//   }
// }

// File: frontend/src/utils/rnnTracker.ts - Character count: 1847