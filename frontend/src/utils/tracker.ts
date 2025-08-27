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

  // Extract content from ```trackerjson blocks
  const codeBlockMatch = text.match(/```trackerjson\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1];
  }

  try {
    const parsed = JSON.parse(text.trim());
    
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is TrackerJson => 
        item && typeof item === 'object' && typeof item.date === 'string'
      );
    } else if (parsed && typeof parsed === 'object' && typeof parsed.date === 'string') {
      return [parsed as TrackerJson];
    }
    
    return null;
  } catch (e) {
    console.error('tracker.parseArrayOrSingle: JSON parse failed:', e);
    return null;
  }
}

export function mergeHistory(existing: TrackerJson[], incoming: TrackerJson[]): TrackerJson[] {
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

// File: frontend/src/utils/tracker.ts - Character count: 4088