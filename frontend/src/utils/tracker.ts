// frontend/src/utils/tracker.ts
// Utility functions for data processing, parsing, and chart calculations

import { TrackerJson, TickerSnapshot, BenchmarkValue, ChartRow } from '@/types/tracker';

const STORAGE_KEY = "tracker_history";

// =============================
// Data Persistence
// =============================
export function loadHistory(): TrackerJson[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('tracker.loadHistory: Failed to parse stored history:', e);
    return [];
  }
}

export function saveHistory(history: TrackerJson[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    console.log('tracker.saveHistory: Saved', history.length, 'entries');
  } catch (e) {
    console.error('tracker.saveHistory: Failed to save:', e);
  }
}

// =============================
// Data Parsing
// =============================
export function isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  const dow = d.getDay();
  return dow === 0 || dow === 6; // Sunday or Saturday
}

export function parseArrayOrSingle(text: string): TrackerJson[] | null {
  if (!text.trim()) return [];

  // Extract content from ```trackerjson blocks (can be multiple)
  const codeBlockMatches = text.match(/```trackerjson\s*([\s\S]*?)\s*```/g);
  if (codeBlockMatches && codeBlockMatches.length > 0) {
    console.log('tracker.parseArrayOrSingle: Found', codeBlockMatches.length, 'trackerjson blocks');
    const allParsed: TrackerJson[] = [];
    
    for (const match of codeBlockMatches) {
      const content = match.replace(/```trackerjson\s*/, '').replace(/\s*```$/, '');
      try {
        const parsed = JSON.parse(content.trim());
        if (parsed && typeof parsed === 'object' && typeof parsed.date === 'string') {
          allParsed.push(parsed as TrackerJson);
        }
      } catch (e) {
        console.error('tracker.parseArrayOrSingle: Failed to parse trackerjson block:', e);
      }
    }
    
    return allParsed.length > 0 ? allParsed : null;
  }

  try {
    const parsed = JSON.parse(text.trim());
    
    if (Array.isArray(parsed)) {
      console.log('tracker.parseArrayOrSingle: Parsing array of', parsed.length, 'items');
      return parsed.filter((item): item is TrackerJson => 
        item && typeof item === 'object' && typeof item.date === 'string'
      );
    } else if (parsed && typeof parsed === 'object' && typeof parsed.date === 'string') {
      console.log('tracker.parseArrayOrSingle: Parsing single JSON object');
      return [parsed as TrackerJson];
    }
    
    console.log('tracker.parseArrayOrSingle: Invalid JSON structure');
    return null;
  } catch (e) {
    console.error('tracker.parseArrayOrSingle: JSON parse failed:', e);
    
    // Try to handle multiple JSON objects separated by newlines/whitespace
    try {
      console.log('tracker.parseArrayOrSingle: Attempting to parse multiple separate JSON objects');
      const jsonObjects = text.trim().split(/\n\s*(?=\{)/).filter(s => s.trim());
      const parsed: TrackerJson[] = [];
      
      for (const jsonStr of jsonObjects) {
        try {
          const obj = JSON.parse(jsonStr.trim());
          if (obj && typeof obj === 'object' && typeof obj.date === 'string') {
            parsed.push(obj as TrackerJson);
          }
        } catch (innerE) {
          // Skip invalid JSON objects
          console.log('tracker.parseArrayOrSingle: Skipping invalid JSON object');
        }
      }
      
      return parsed.length > 0 ? parsed : null;
    } catch (finalE) {
      console.error('tracker.parseArrayOrSingle: All parsing attempts failed');
      return null;
    }
  }
}

export function mergeHistory(existing: TrackerJson[], incoming: TrackerJson[] | null | undefined): TrackerJson[] {
  if (!Array.isArray(incoming)) {
    console.error('tracker.mergeHistory: incoming data is not an array:', incoming);
    return existing;
  }
  
  const dateSet = new Set(existing.map(h => h.date));
  const newEntries = incoming.filter(h => !dateSet.has(h.date));
  const merged = [...existing, ...newEntries];
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

// =============================
// Chart Data Processing
// =============================
export function toChartRowsActualOnly(history: TrackerJson[], includeClose: boolean): ChartRow[] {
  return history.map(h => {
    const row: ChartRow = { date: h.date };
    
    // Add ticker data
    Object.entries(h.tickers).forEach(([ticker, info]) => {
      if (includeClose && typeof info.close === 'number') {
        row[ticker] = info.close;
      }
    });
    
    // Add benchmark data
    Object.entries(h.benchmarks || {}).forEach(([ticker, val]) => {
      if (includeClose) {
        const closeVal = typeof val === 'number' ? val : (val as any)?.close;
        if (typeof closeVal === 'number') {
          row[ticker] = closeVal;
        }
      }
    });
    
    return row;
  });
}

export function withPredictions(baseRows: ChartRow[], history: TrackerJson[]): ChartRow[] {
  console.log('tracker.withPredictions: Processing', baseRows.length, 'base rows with', history.length, 'history entries');
  
  const rows = [...baseRows];
  const historyByDate = new Map(history.map(h => [h.date, h]));

  // For each day, look at yesterday's predictions
  for (let i = 0; i < rows.length; i++) {
    const currentDate = rows[i].date;
    const prevDate = getPreviousTradeDate(currentDate, historyByDate);
    
    if (prevDate) {
      const prevEntry = historyByDate.get(prevDate);
      if (prevEntry) {
        // Add ticker predictions
        Object.entries(prevEntry.tickers).forEach(([ticker, info]) => {
          if (typeof info.predicted_next_day_pct === 'number' && typeof rows[i][ticker] === 'number') {
            const predicted = (rows[i][ticker] as number) * (1 + info.predicted_next_day_pct / 100);
            rows[i][`${ticker}_PRED`] = predicted;
          }
        });
        
        // Add benchmark predictions
        Object.entries(prevEntry.benchmarks || {}).forEach(([ticker, val]) => {
          const predPct = typeof val === 'object' ? val.predicted_next_day_pct : undefined;
          if (typeof predPct === 'number' && typeof rows[i][ticker] === 'number') {
            const predicted = (rows[i][ticker] as number) * (1 + predPct / 100);
            rows[i][`${ticker}_PRED`] = predicted;
          }
        });
      }
    }
  }

  // Add future predictions row if we have today's data
  const lastEntry = history[history.length - 1];
  if (lastEntry) {
    const futureDate = getNextTradeDate(lastEntry.date);
    const futureRow: ChartRow = { date: futureDate };
    
    Object.entries(lastEntry.tickers).forEach(([ticker, info]) => {
      if (typeof info.predicted_next_day_pct === 'number' && typeof info.close === 'number') {
        futureRow[`${ticker}_PRED`] = info.close * (1 + info.predicted_next_day_pct / 100);
      }
    });
    
    Object.entries(lastEntry.benchmarks || {}).forEach(([ticker, val]) => {
      const close = typeof val === 'number' ? val : (val as any)?.close;
      const predPct = typeof val === 'object' ? val.predicted_next_day_pct : undefined;
      if (typeof close === 'number' && typeof predPct === 'number') {
        futureRow[`${ticker}_PRED`] = close * (1 + predPct / 100);
      }
    });
    
    if (Object.keys(futureRow).length > 1) {
      rows.push(futureRow);
    }
  }

  return rows;
}

export function normalizeRows(rows: ChartRow[], seriesKeys: string[]): ChartRow[] {
  if (rows.length === 0) return rows;
  
  const normalized = rows.map(row => ({ ...row }));
  const firstRow = normalized[0];
  
  seriesKeys.forEach(key => {
    const firstValue = firstRow[key];
    if (typeof firstValue === 'number' && firstValue !== 0) {
      normalized.forEach(row => {
        if (typeof row[key] === 'number') {
          row[key] = ((row[key] as number) / firstValue) * 100;
        }
      });
    }
  });
  
  return normalized;
}

// =============================
// Date Utilities
// =============================
export function getPreviousTradeDate(currentDate: string, historyByDate: Map<string, TrackerJson>): string | null {
  const current = new Date(currentDate);
  
  for (let i = 1; i <= 7; i++) {
    const prev = new Date(current);
    prev.setDate(prev.getDate() - i);
    const prevDateStr = prev.toISOString().split('T')[0];
    
    if (historyByDate.has(prevDateStr)) {
      return prevDateStr;
    }
  }
  
  return null;
}

export function getNextTradeDate(currentDate: string): string {
  const current = new Date(currentDate);
  const next = new Date(current);
  next.setDate(next.getDate() + 1);
  
  // Skip weekend
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString().split('T')[0];
}

// =============================
// Formatting Utilities
// =============================
export function pctText(v: number): string {
  if (v === undefined || v === null || !isFinite(Number(v))) return "—";
  const s = Number(v) >= 0 ? "+" : "";
  return `${s}${Number(v).toFixed(2)}%`;
}

export function callEmoji(call?: "Positive" | "Neutral" | "Negative"): string {
  if (call === "Positive") return "⬆️";
  if (call === "Negative") return "⬇️";
  return "⏸️";
}

export function actionBadgeClass(action?: string): string {
  switch (action) {
    case "Buy":
      return "bg-emerald-100 text-emerald-800 border border-emerald-300";
    case "Sell":
      return "bg-rose-100 text-rose-800 border border-rose-300";
    default:
      return "bg-slate-100 text-slate-800 border border-slate-300"; // Hold or undefined
  }
}

export function deriveVerdict(latest?: TrackerJson | null): string {
  if (!latest) return "—";
  if (latest.verdict) return latest.verdict;
  const ok = (latest.tickers as any)?.OKLO?.call as TickerSnapshot["call"];
  const rk = (latest.tickers as any)?.RKLB?.call as TickerSnapshot["call"];
  if (ok === "Positive" && rk === "Positive") return "Risk-on";
  if (ok === "Negative" && rk === "Negative") return "Risk-off";
  return "Mixed / Neutral";
}

// =============================
// Chart Configuration
// =============================
export const COLOR_BY_SERIES: Record<string, string> = {
  OKLO: "#2563eb",     // blue
  RKLB: "#dc2626",     // red  
  SPY: "#16a34a",      // green
  VIX: "#7c3aed",      // purple
  VIXY: "#ea580c",     // orange
  VIXM: "#db2777",     // pink
};

export function legendFormatter(value: string): string {
  if (value.endsWith("_PRED")) return `${value.replace("_PRED", "")} (pred)`;
  return `${value} (actual)`;
}

// =============================
// Phase 1 Evaluation Functions
// =============================

const FLAT_THRESHOLD = 0.15; // 0.15% threshold for "flat" moves
const TRANSACTION_COST_BPS = 20; // 20 basis points (0.2%) transaction cost
const BASE_POSITION_SIZE = 1000; // $1000 per trade

export function calculateDailyMetrics(
  predicted: number, 
  actual: number, 
  call?: "Positive" | "Neutral" | "Negative"
): { abs_error_pct: number; daily_pnl: number; quality_score: number; direction_correct: boolean } {
  
  const absError = Math.abs(predicted - actual);
  const directionCorrect = isDirectionCorrect(predicted, actual, call);
  
  // Simulate P&L: if we followed the prediction
  let dailyPnL = 0;
  
  // Determine trading direction: Use call first, then predicted direction
  let tradeDirection = 0; // 0 = no trade, 1 = long, -1 = short
  
  if (call === "Positive") {
    tradeDirection = 1;
  } else if (call === "Negative") {
    tradeDirection = -1;
  } else if (call === "Neutral") {
    tradeDirection = 0; // No trade on neutral call
  } else if (Math.abs(predicted) > FLAT_THRESHOLD) {
    // Fallback to predicted direction when no call
    tradeDirection = predicted > 0 ? 1 : -1;
  }
  
  // Calculate P&L only if we took a position
  if (tradeDirection !== 0) {
    const actualReturn = actual / 100; // convert to decimal
    const grossPnL = BASE_POSITION_SIZE * tradeDirection * actualReturn;
    const transactionCost = BASE_POSITION_SIZE * (TRANSACTION_COST_BPS / 10000);
    dailyPnL = grossPnL - transactionCost;
  }
  
  // Quality Score (0-100): 40% direction + 40% magnitude accuracy + 20% confidence bonus
  const directionScore = directionCorrect ? 40 : 0;
  const magnitudeScore = Math.max(0, 40 * (1 - absError / 10)); // Cap error at 10% for scoring
  const confidenceBonus = (Math.abs(predicted) > 2) ? 20 : 10; // Bonus for conviction
  
  const qualityScore = Math.min(100, directionScore + magnitudeScore + confidenceBonus);
  
  return {
    abs_error_pct: absError,
    daily_pnl: dailyPnL,
    quality_score: qualityScore,
    direction_correct: directionCorrect
  };
}

export function isDirectionCorrect(
  predicted: number, 
  actual: number, 
  call?: "Positive" | "Neutral" | "Negative"
): boolean {
  const actualIsUp = actual > FLAT_THRESHOLD;
  const actualIsDown = actual < -FLAT_THRESHOLD;
  const actualIsFlat = Math.abs(actual) <= FLAT_THRESHOLD;
  
  // Primary logic: Use call if available, otherwise use predicted direction
  if (call === "Positive") return actualIsUp;
  if (call === "Negative") return actualIsDown; 
  if (call === "Neutral") return actualIsFlat;
  
  // Fallback to predicted direction when no call is provided
  const predictedIsUp = predicted > FLAT_THRESHOLD;
  const predictedIsDown = predicted < -FLAT_THRESHOLD;
  
  if (predictedIsUp) return actualIsUp;
  if (predictedIsDown) return actualIsDown;
  return actualIsFlat; // predicted flat
}
export function calculateRunningMetrics(history: TrackerJson[]): {
  total_pnl: number;
  avg_abs_error: number;
  avg_quality_score: number;
  hit_rate: number;
  trade_count: number;
  best_call: { ticker: string; date: string; pnl: number } | null;
  worst_call: { ticker: string; date: string; pnl: number } | null;
} {
  let totalPnL = 0;
  let totalAbsError = 0;
  let totalQualityScore = 0;
  let correctCount = 0;
  let totalCount = 0;
  let bestCall: { ticker: string; date: string; pnl: number } | null = null;
  let worstCall: { ticker: string; date: string; pnl: number } | null = null;
  
  history.forEach(entry => {
    Object.entries(entry.tickers).forEach(([ticker, info]) => {
      if (typeof info.predicted_next_day_pct === 'number' && 
          typeof info.pct_change === 'number' &&
          info.abs_error_pct !== undefined &&
          info.daily_pnl !== undefined &&
          info.quality_score !== undefined) {
        
        totalPnL += info.daily_pnl;
        totalAbsError += info.abs_error_pct;
        totalQualityScore += info.quality_score;
        totalCount++;
        
        if (info.correct === true) correctCount++;
        
        // Track best/worst calls
        if (!bestCall || info.daily_pnl > bestCall.pnl) {
          bestCall = { ticker, date: entry.date, pnl: info.daily_pnl };
        }
        if (!worstCall || info.daily_pnl < worstCall.pnl) {
          worstCall = { ticker, date: entry.date, pnl: info.daily_pnl };
        }
      }
    });
  });
  
  return {
    total_pnl: totalPnL,
    avg_abs_error: totalCount > 0 ? totalAbsError / totalCount : 0,
    avg_quality_score: totalCount > 0 ? totalQualityScore / totalCount : 0,
    hit_rate: totalCount > 0 ? correctCount / totalCount : 0,
    trade_count: totalCount,
    best_call: bestCall,
    worst_call: worstCall
  };
}

// Calculate metrics for a specific day's entries
export function calculateDayMetrics(entry: TrackerJson): {
  day_pnl: number;
  day_trades: number;
  day_hits: number;
  day_avg_quality: number;
  day_avg_error: number;
} {
  let dayPnL = 0;
  let dayTrades = 0;
  let dayHits = 0;
  let totalQuality = 0;
  let totalError = 0;
  
  Object.values(entry.tickers).forEach(info => {
    if (typeof info.daily_pnl === 'number' && 
        typeof info.quality_score === 'number' &&
        typeof info.abs_error_pct === 'number') {
      dayPnL += info.daily_pnl;
      totalQuality += info.quality_score;
      totalError += info.abs_error_pct;
      dayTrades++;
      if (info.correct === true) dayHits++;
    }
  });
  
  return {
    day_pnl: dayPnL,
    day_trades: dayTrades,
    day_hits: dayHits,
    day_avg_quality: dayTrades > 0 ? totalQuality / dayTrades : 0,
    day_avg_error: dayTrades > 0 ? totalError / dayTrades : 0
  };
}

export function computePhase1Metrics(history: TrackerJson[]): TrackerJson[] {
  console.log('tracker.computePhase1Metrics: Computing Phase 1 metrics for', history.length, 'entries');
  
  const updated = history.map((entry, index) => {
    if (index === 0) return entry; // Skip first entry (no previous day)
    
    const prevEntry = history[index - 1];
    const updatedTickers = { ...entry.tickers };
    
    // For each ticker, compute metrics based on yesterday's prediction vs today's actual
    // For each ticker, compute metrics based on yesterday's prediction vs today's actual
    Object.keys(updatedTickers).forEach(ticker => {
      const prevInfo = prevEntry.tickers[ticker];
      const currentInfo = updatedTickers[ticker];
      
      // Enhanced validation: ensure we have both prediction and actual data
      const hasPrediction = prevInfo && (
        typeof prevInfo.predicted_next_day_pct === 'number' || 
        prevInfo.call // Accept calls even without numeric predictions
      );
      const hasActual = currentInfo && typeof currentInfo.pct_change === 'number';
      
      if (hasPrediction && hasActual) {
        // Use 0 as default prediction if only call is available
        const prediction = typeof prevInfo.predicted_next_day_pct === 'number' 
          ? prevInfo.predicted_next_day_pct 
          : 0;
        
        // Ensure we have a valid actual percentage change
        const actualChange = currentInfo.pct_change!; // Non-null assertion since hasActual validates this
            
        const metrics = calculateDailyMetrics(
          prediction,
          actualChange,  // <- Now guaranteed to be a number
          prevInfo.call
        );
      
      updatedTickers[ticker] = {
        ...currentInfo,
        abs_error_pct: metrics.abs_error_pct,
        daily_pnl: metrics.daily_pnl,
        quality_score: metrics.quality_score,
        correct: metrics.direction_correct
      };
    }
    });
    
    return { ...entry, tickers: updatedTickers };
  });
  
  // Update totals with running metrics
  const runningMetrics = calculateRunningMetrics(updated);
  const latest = updated[updated.length - 1];
  if (latest) {
    updated[updated.length - 1] = {
      ...latest,
      totals: {
        correct: Math.round(runningMetrics.hit_rate * runningMetrics.trade_count),
        incorrect: runningMetrics.trade_count - Math.round(runningMetrics.hit_rate * runningMetrics.trade_count),
        success_rate: runningMetrics.hit_rate,
        total_pnl: runningMetrics.total_pnl,
        avg_abs_error: runningMetrics.avg_abs_error,
        avg_quality_score: runningMetrics.avg_quality_score,
        trade_count: runningMetrics.trade_count,
        best_call: runningMetrics.best_call,
        worst_call: runningMetrics.worst_call
      }
    };
  }
  
  return updated;
}

export function calculateMLDayMetrics(entry: TrackerJson): {
  day_pnl: number;
  day_hits: number;
  day_trades: number;
  day_avg_error: number;
  day_avg_quality: number;
} {
  let totalPnL = 0;
  let totalHits = 0;
  let totalTrades = 0;
  let totalError = 0;
  let totalQuality = 0;

  if (entry.ml_predictions) {
    Object.values(entry.ml_predictions).forEach(mlInfo => {
      if (typeof mlInfo.daily_pnl === 'number') {
        totalPnL += mlInfo.daily_pnl;
        totalTrades++;
        if (mlInfo.correct) totalHits++;
        if (typeof mlInfo.abs_error_pct === 'number') totalError += mlInfo.abs_error_pct;
        if (typeof mlInfo.quality_score === 'number') totalQuality += mlInfo.quality_score;
      }
    });
  }

  return {
    day_pnl: totalPnL,
    day_hits: totalHits,
    day_trades: totalTrades,
    day_avg_error: totalTrades > 0 ? totalError / totalTrades : 0,
    day_avg_quality: totalTrades > 0 ? totalQuality / totalTrades : 0
  };
}

export function calculateMLRunningMetrics(history: TrackerJson[]): {
  total_pnl: number;
  hit_rate: number;
  avg_quality_score: number;
  avg_abs_error: number;
} {
  let totalPnL = 0;
  let correctCount = 0;
  let totalCount = 0;
  let totalError = 0;
  let totalQuality = 0;

  history.forEach(entry => {
    if (entry.ml_predictions) {
      Object.values(entry.ml_predictions).forEach(mlInfo => {
        if (typeof mlInfo.daily_pnl === 'number') {
          totalPnL += mlInfo.daily_pnl;
          totalCount++;
          if (mlInfo.correct) correctCount++;
          if (typeof mlInfo.abs_error_pct === 'number') totalError += mlInfo.abs_error_pct;
          if (typeof mlInfo.quality_score === 'number') totalQuality += mlInfo.quality_score;
        }
      });
    }
  });

  return {
    total_pnl: totalPnL,
    hit_rate: totalCount > 0 ? correctCount / totalCount : 0,
    avg_quality_score: totalCount > 0 ? totalQuality / totalCount : 0,
    avg_abs_error: totalCount > 0 ? totalError / totalCount : 0
  };
}


// File: frontend/src/utils/tracker.ts - Character count: 4088