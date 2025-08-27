// frontend/src/types/tracker.ts
// Defines all TypeScript interfaces for the stock tracker application

export type ActionType = "Buy" | "Hold" | "Sell";

export type TickerSnapshot = {
  close: number;
  pct_change?: number;
  streak?: number;
  call?: "Positive" | "Neutral" | "Negative";
  confidence?: number;
  actual_move?: "Up" | "Down" | "Flat" | null;
  correct?: boolean | null;
  // Optional fields for TL;DR + actions
  predicted_next_day_pct?: number; // signed percent (+/-)
  expected_degree?: "Small" | "Moderate" | "Large";
  action?: ActionType;
  dip_onset_prob?: number; // 0-100
  dip_exhaustion_prob?: number; // 0-100
};

// Benchmarks can be a plain number (close) or an object with close + prediction
export type BenchmarkValue = number | { close: number; predicted_next_day_pct?: number };

export type OHLCVData = {
  open?: number;
  high?: number;
  low?: number;
  close: number;  // close is required
  volume?: number;
};

export type MacroEvent = {
  event: string;
  source: string;
  link: string;
  next_release_hint?: string;
};

export type NewsSource = {
  type: string;
  ticker?: string;
  title: string;
  author: string;
  url: string;
  date_published?: string;
  date_accessed?: string;
  stance?: "positive" | "negative" | "neutral";
  excerpt?: string;
  claims?: any[];
};

export type PredictionLabel = {
  direction: "Up" | "Down" | "Flat";
  magnitude_bucket: "Small" | "Moderate" | "Large";
  reason: string;
};

export type TrackerJson = {
  schema_version?: string;
  date: string; // YYYY-MM-DD
  asof?: string; // ISO timestamp
  tldr?: string;
  verdict?: string;
  tickers: Record<string, TickerSnapshot>;
  benchmarks?: Record<string, BenchmarkValue>;
  prices?: Record<string, OHLCVData>;
  macro_watch?: MacroEvent[];
  sources?: NewsSource[];
  labels?: {
    prediction_for_next_day?: Record<string, PredictionLabel>;
  };
  totals?: { correct: number; incorrect: number; success_rate: number };
  notes?: string;
};

export type ChartRow = {
  date: string;
  [key: string]: string | number | undefined; // Dynamic ticker columns
};

export type TestResult = {
  name: string;
  passed: boolean;
  details?: string;
};

// File: frontend/src/types/tracker.ts - Character count: 1428