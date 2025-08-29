// frontend/src/app/page.tsx
// Main dashboard component for the stock tracker application
'use client';

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Trash2, PlusCircle, Bug } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { 
  TrackerJson, 
  TickerSnapshot, 
  ChartRow, 
  TestResult,
  ActionType,
  OHLCVData,
  MacroEvent,
  NewsSource,
  PredictionLabel
} from '@/types/tracker';

import {
  loadHistory,
  saveHistory,
  parseArrayOrSingle,
  mergeHistory,
  toChartRowsActualOnly,
  withPredictions,
  normalizeRows,
  isWeekendDate,
  pctText,
  callEmoji,
  actionBadgeClass,
  deriveVerdict,
  COLOR_BY_SERIES,
  legendFormatter,
  computePhase1Metrics,
  calculateDayMetrics  
} from '@/utils/tracker';

export default function TrackerDashboard() {
  console.log('TrackerDashboard.render: Component rendering');
  const [mlPredictions, setMlPredictions] = useState<Record<string, number> | null>(null);
  const [isLoadingMlPredictions, setIsLoadingMlPredictions] = useState(true);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  
  // State declarations
  const [history, setHistory] = useState<TrackerJson[]>([]);
  const [input, setInput] = useState("");
  const [normalize, setNormalize] = useState(false);
  const [showPred, setShowPred] = useState(true);
  const [show, setShow] = useState<Record<string, boolean>>({
    OKLO: true,
    RKLB: true,
  });
  const [testLog, setTestLog] = useState<TestResult[]>([]);

  // Fetch ML predictions on mount
  useEffect(() => {
    // We can remove the console.log statements now
    setIsLoadingMlPredictions(true);
    fetch('/latest_ml_predictions.json', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) { // Handle cases where the file might not be found
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then(data => {
        setMlPredictions(data.ml_predictions);
      })
      .catch(err => {
        console.error("Failed to load ML predictions:", err);
        setMlPredictions(null); // Clear out old predictions on failure
      })
      .finally(() => {
        setIsLoadingMlPredictions(false); // <-- ADD THIS
      });
  }, []);

  // Load history on mount
  useEffect(() => {
    console.log('TrackerDashboard.useEffect: Loading history from localStorage');
    const loadedHistory = loadHistory();
    const historyWithMetrics = computePhase1Metrics(loadedHistory);
    setHistory(historyWithMetrics);
  }, []);

  async function handleRunPipeline() {
    setIsPipelineRunning(true);
    alert("Kicking off the ML pipeline. This can take a few minutes. The predictions will update here automatically when it's done. You don't need to refresh.");
    
    // Call our new API endpoint
    await fetch('/api/run-pipeline', { method: 'POST' });

    // We can set a timeout to re-enable the button after a while
    setTimeout(() => {
      setIsPipelineRunning(false);
    }, 60000); // Re-enable after 1 minute
  }

  // Compute available tickers
  const allKeys = useMemo(() => {
    console.log('TrackerDashboard.allKeys: Computing all ticker keys from', history.length, 'entries');
    const keys = new Set<string>();
    history.forEach((h) => {
      Object.keys(h.tickers || {}).forEach((k) => keys.add(k));
      // Remove this line: Object.keys(h.benchmarks || {}).forEach((k) => keys.add(k));
    });
    return Array.from(keys);
  }, [history]);

  // Update show toggles for new tickers
  useEffect(() => {
    if (allKeys.length === 0) return;
    console.log('TrackerDashboard.useEffect: Updating show toggles for keys:', allKeys);
    setShow((prev) => {
      const copy = { ...prev };
      allKeys.forEach((k) => {
        if (!(k in copy)) copy[k] = false;
      });
      return copy;
    });
  }, [allKeys]);

  // Compute active chart series
  const activeSeries = useMemo(() => {
    const list: string[] = [];
    allKeys.forEach((k) => {
      if (show[k]) {
        list.push(k);
        if (showPred) list.push(`${k}_PRED`); // Only add prediction if base stock is shown
      }
    });
    console.log('TrackerDashboard.activeSeries: Active series for chart:', list);
    return list;
  }, [allKeys, show, showPred]);

  // Compute chart data
  const baseRows = useMemo(() => {
    console.log('TrackerDashboard.baseRows: Computing base chart rows');
    return toChartRowsActualOnly(history, true);
  }, [history]);

  const rowsWithPred = useMemo(() => {
    console.log('TrackerDashboard.rowsWithPred: Adding predictions to chart data');
    return withPredictions(baseRows.map((r) => ({ ...r })), history);
  }, [baseRows, history]);

  const chartRows = useMemo(() => {
    const rows = rowsWithPred;
    return normalize ? normalizeRows(rows.map((r) => ({ ...r })), activeSeries) : rows;
  }, [rowsWithPred, normalize, activeSeries]);

  // Compute dynamic Y-axis domain based on visible data
  const yAxisDomain = useMemo(() => {
    console.log('TrackerDashboard.yAxisDomain: Computing dynamic Y-axis domain for visible series');
    
    if (chartRows.length === 0 || activeSeries.length === 0) {
      return [0, 100]; // fallback
    }

    let min = Infinity;
    let max = -Infinity;

    // Only consider active series for domain calculation
    const activeDataSeries = activeSeries.filter(key => !key.endsWith('_PRED')); // Focus on actual data for primary scaling
    
    if (activeDataSeries.length === 0) {
      return [0, 100]; // fallback when only predictions are shown
    }

    chartRows.forEach(row => {
      activeDataSeries.forEach(seriesKey => {
        const value = row[seriesKey];
        if (typeof value === 'number' && isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    // Handle edge cases
    if (!isFinite(min) || !isFinite(max) || min === max) {
      return [0, 100];
    }

    // FAANG-level smart padding: 5% padding with minimum 2-point spread
    const range = max - min;
    const paddingPercent = 0.05; // 5% padding
    const minSpread = Math.max(2, range * 0.1); // Ensure at least 10% spread or 2 points
    
    const finalMin = min - Math.max(range * paddingPercent, minSpread * 0.5);
    const finalMax = max + Math.max(range * paddingPercent, minSpread * 0.5);

    console.log('TrackerDashboard.yAxisDomain: Calculated domain', { 
      originalRange: [min, max], 
      finalRange: [finalMin, finalMax],
      activeSeries: activeDataSeries 
    });

    return [Math.max(0, finalMin), finalMax]; // Never go below 0 for stock prices
  }, [chartRows, activeSeries]);


  // Computed values
  const latest = history[history.length - 1] || null;
  const prev = history[history.length - 2] || null;
  const totals = latest?.totals;

  // =============================
  // Event Handlers
  // =============================
useEffect(() => {
  console.log('page.tsx.useEffect: Initial data load');
  
  // First load from localStorage
  const savedHistory = loadHistory();
  setHistory(savedHistory);
  
  // Then load from data/raw directory
  loadFromDataRaw();
}, []);

// Auto-load all JSON files from data/raw directory
async function loadFromDataRaw() {
  console.log('page.tsx.loadFromDataRaw: Auto-loading JSON files from data/raw');
  
  try {
    const response = await fetch('/api/data');
    const result = await response.json();
    
    console.log('page.tsx.loadFromDataRaw: API response:', result);
    
    if (!result.success) {
      console.error('page.tsx.loadFromDataRaw: Failed to load from data/raw:', result.error);
      return;
    }
    
    // Fix: Use 'entries' instead of 'data' (matching what API actually returns)
    if (!Array.isArray(result.entries)) {
      console.error('page.tsx.loadFromDataRaw: Invalid data format:', result);
      return;
    }
    
    if (result.entries.length === 0) {
      console.log('page.tsx.loadFromDataRaw: No valid tracker data found in', result.totalFiles || 0, 'files');
      return;
    }
    
    // Get current history from state (need to use callback form since we're in useEffect)
    setHistory(currentHistory => {
      // Merge with existing history
      const newHistory = mergeHistory(currentHistory, result.entries);
      
      // Compute Phase 1 metrics before saving
      const historyWithMetrics = computePhase1Metrics(newHistory);
      
      // Save to localStorage
      saveHistory(historyWithMetrics);
      
      console.log('page.tsx.loadFromDataRaw: Loaded', result.totalEntries, 'entries from', result.totalFiles, 'files. Total history:', historyWithMetrics.length);
      
      return historyWithMetrics;  // Return the version with metrics
    });
    
  } catch (error) {
    console.error('page.tsx.loadFromDataRaw: API call failed:', error);
    // Don't show alert on auto-load failure - just log it
  }
}

  function handleAdd() {
    console.log('TrackerDashboard.handleAdd: Processing input of length', input.length);
    
    const parsed = parseArrayOrSingle(input);
    if (!parsed) {
      alert("Failed to parse JSON. Please check the format.");
      return;
    }
    if (parsed.length === 0) {
      alert("No valid entries found in the input.");
      return;
    }

    // Weekend guard
    const weekendEntries = parsed.filter(p => isWeekendDate(p.date));
    if (weekendEntries.length > 0) {
      const dates = weekendEntries.map(w => w.date).join(", ");
      if (!confirm(`Warning: ${dates} fall on weekends. Proceed anyway?`)) {
        return;
      }
    }

    const newHistory = mergeHistory(history, parsed);
    const historyWithMetrics = computePhase1Metrics(newHistory);  // Add this line
    setHistory(historyWithMetrics);
    saveHistory(historyWithMetrics);  // Save the metrics too
    setInput("");
    console.log('TrackerDashboard.handleAdd: Added', parsed.length, 'entries, total history now', historyWithMetrics.length);
  }

  function handleClear() {
    console.log('TrackerDashboard.handleClear: Clearing all history');
    if (confirm("Clear all history? This cannot be undone.")) {
      setHistory([]);
      saveHistory([]);
      setInput("");
    }
  }

  function handleExport() {
    console.log('TrackerDashboard.handleExport: Exporting', history.length, 'entries');
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracker_history.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function runSelfTests() {
    console.log('TrackerDashboard.runSelfTests: Running test suite');
    const tests: TestResult[] = [];
    
    // Mock data for testing
    const mockHistory: TrackerJson[] = [
      {
        date: "2025-08-22",
        tickers: {
          OKLO: { close: 10, predicted_next_day_pct: 2.5 },
          SPY: { close: 100, predicted_next_day_pct: 0.5 }
        }
      },
      {
        date: "2025-08-25", 
        tickers: {
          OKLO: { close: 11 },
          SPY: { close: 105 }
        }
      }
    ];

    const rows = toChartRowsActualOnly(mockHistory, true);
    const withPred = withPredictions(rows, mockHistory);

    tests.push({ 
      name: "Base rows created", 
      passed: rows.length === 2 
    });

    const day2 = withPred.find(r => r.date === "2025-08-25");
    tests.push({ 
      name: "withPredictions carries yesterday's prediction (OKLO)", 
      passed: !!day2 && Math.abs(Number((day2 as any).OKLO_PRED) - 10.25) < 1e-9 
    });
    
    tests.push({ 
      name: "legendFormatter actual label", 
      passed: legendFormatter("OKLO") === "OKLO (actual)" 
    });
    
    tests.push({ 
      name: "legendFormatter pred label", 
      passed: legendFormatter("OKLO_PRED") === "OKLO (pred)" 
    });

    const arrParsed = parseArrayOrSingle(JSON.stringify([
      { date: "2025-08-20", tickers: { OKLO: { close: 9 } } },
      { date: "2025-08-21", tickers: { RKLB: { close: 19 } } }
    ]));
    
    tests.push({ 
      name: "parseArrayOrSingle handles array", 
      passed: (arrParsed || []).length === 2 
    });

    tests.push({ 
      name: "isWeekendDate flags Saturday (2025-08-23)", 
      passed: isWeekendDate("2025-08-23") === true 
    });

    const bad = parseArrayOrSingle("not json at all");
    tests.push({ 
      name: "garbage input rejected", 
      passed: bad === null 
    });

    setTestLog(tests);
    console.log('TrackerDashboard.runSelfTests: Completed', tests.length, 'tests');
  }

  

  // Performance review row helper
  function perfRow(ticker: "OKLO" | "RKLB") {
    if (!prev || !latest) return null;
    
    const prevInfo = prev.tickers[ticker];
    const currInfo = latest.tickers[ticker];
    if (!prevInfo || !currInfo) return null;

    const wasUp = (currInfo.pct_change || 0) > 0;
    const call = prevInfo.call;
    const correct = (call === "Positive" && wasUp) || (call === "Negative" && !wasUp) || (call === "Neutral");

    return (
      <div key={ticker} className="grid grid-cols-4 text-xs">
        <div className="font-mono">{ticker}</div>
        <div>{call ? `${callEmoji(call)} ${call}` : "—"}</div>
        <div className={wasUp ? "text-emerald-600" : "text-rose-600"}>
          {pctText(currInfo.pct_change || 0)}
        </div>
        <div className={correct ? "text-emerald-600" : "text-rose-600"}>
          {correct ? "✓" : "✗"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Stock Tracker Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="normalize">Normalize to 100</Label>
              <Switch id="normalize" checked={normalize} onCheckedChange={setNormalize} />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="showPred">Show predictions</Label>
              <Switch id="showPred" checked={showPred} onCheckedChange={setShowPred} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Schema Info */}
      {latest && (latest.schema_version || latest.asof) && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {latest.schema_version && (
                <span>Schema: <strong>{latest.schema_version}</strong></span>
              )}
              {latest.asof && (
                <span>As of: <strong>{new Date(latest.asof).toLocaleString()}</strong></span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

       {/* Price Chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Price history</CardTitle>
        </CardHeader>
        <CardContent className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ left: 8, right: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis 
                tick={{ fontSize: 12 }} 
                domain={yAxisDomain}
                tickFormatter={(value) => `$${value.toFixed(1)}`}
              />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend formatter={legendFormatter} />
              {activeSeries.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLOR_BY_SERIES[key.replace("_PRED", "")] || undefined}
                  dot={key.endsWith("_PRED")}
                  strokeDasharray={key.endsWith("_PRED") ? "5 5" : undefined}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stock Toggle Controls */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Stock Toggle Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {allKeys.map((ticker) => (
              <div key={ticker} className="flex items-center space-x-2">
                <Switch
                  id={`toggle-${ticker}`}
                  checked={show[ticker] || false}
                  onCheckedChange={(checked) => {
                    console.log(`TrackerDashboard.toggle: Toggling ${ticker} to ${checked}`);
                    setShow(prev => ({ ...prev, [ticker]: checked }));
                  }}
                />
                <Label 
                  htmlFor={`toggle-${ticker}`} 
                  className={`font-mono text-sm cursor-pointer ${
                    show[ticker] ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                  style={{ 
                    color: show[ticker] && COLOR_BY_SERIES[ticker] 
                      ? COLOR_BY_SERIES[ticker] 
                      : undefined 
                  }}
                >
                  {ticker}
                </Label>
              </div>
            ))}
          </div>
          {allKeys.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('TrackerDashboard.toggleAll: Enabling all stocks');
                  const allOn = Object.fromEntries(allKeys.map(k => [k, true]));
                  setShow(prev => ({ ...prev, ...allOn }));
                }}
              >
                Show All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('TrackerDashboard.toggleAll: Disabling all stocks');
                  const allOff = Object.fromEntries(allKeys.map(k => [k, false]));
                  setShow(prev => ({ ...prev, ...allOff }));
                }}
              >
                Hide All
              </Button>
              <div className="ml-auto text-sm text-muted-foreground">
                {activeSeries.filter(s => !s.endsWith('_PRED')).length} of {allKeys.length} visible
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {prev && latest ? (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Yesterday vs. Today</div>
          <div className="grid grid-cols-5 font-semibold text-xs border-b pb-1">
            <div>Ticker</div>
            <div>Call</div>
            <div>Actual</div>
            <div>Result</div>
            <div>P&L</div>
          </div>
          {(["OKLO", "RKLB"] as const).map((t) => {
            const prevInfo = prev.tickers[t];
            const currInfo = latest.tickers[t];
            if (!prevInfo || !currInfo) return null;

            const wasUp = (currInfo.pct_change || 0) > 0;
            const call = prevInfo.call;
            const correct = currInfo.correct;
            const pnl = currInfo.daily_pnl;

            return (
              <div key={t} className="grid grid-cols-5 text-xs items-center">
                <div className="font-mono">{t}</div>
                <div>{call ? `${callEmoji(call)} ${call}` : "—"}</div>
                <div className={wasUp ? "text-emerald-600" : "text-rose-600"}>
                  {pctText(currInfo.pct_change || 0)}
                </div>
                <div className={correct ? "text-emerald-600" : "text-rose-600"}>
                  {correct ? "✓" : "✗"} {currInfo.quality_score?.toFixed(0)}/100
                </div>
                <div className={`font-bold ${(pnl || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pnl ? `$${pnl.toFixed(0)}` : "—"}
                </div>
              </div>
            );
          })}
          {/* Running totals */}
          <div className="mt-3 text-sm border-t pt-3">
            <div className="flex items-center justify-between">
              <span>Hit Rate</span><span className="font-semibold">{((latest.totals?.success_rate || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total P&L</span>
              <span className={`font-semibold ${(latest.totals?.total_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ${(latest.totals?.total_pnl || 0).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Performance metrics will appear after we have consecutive days of data.</div>
      )}

      {/* Enhanced TL;DR Section */}
      {latest && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              TL;DR — Next Trading Day
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {deriveVerdict(latest)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm leading-relaxed mb-4">
              {latest.tldr || "Paste today's report to see the 300-word gist here."}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Verdict</div>
                <div className="font-semibold">{latest.verdict || "Risk-on"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Watched Prices</div>
                <div className="space-y-1 text-sm">
                  {Object.entries(latest.tickers).map(([t, info]) => (
                    <div key={t} className="flex justify-between font-mono">
                      <span>{t}</span>
                      <span>{Number(info.close).toFixed(2)}</span>
                    </div>
                  ))}
                  {latest.benchmarks && Object.entries(latest.benchmarks).map(([t, val]) => {
                    const closeVal = typeof val === 'number' ? val : (val as any)?.close;
                    return (
                      <div key={t} className="flex justify-between font-mono">
                        <span>{t}</span>
                        <span>{isFinite(Number(closeVal)) ? Number(closeVal).toFixed(2) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Next-Day Predictions</div>
                <div className="space-y-1">
                  {Object.entries(latest.tickers).map(([t, info]) => {
                    const pct = info.predicted_next_day_pct;
                    const implied = typeof pct === 'number' && isFinite(Number(info.close)) 
                      ? Number(info.close) * (1 + pct / 100)
                      : null;
                    if (pct === undefined) return null;
                    return (
                      <div key={t} className="flex items-center justify-between">
                        <div className="font-mono text-sm">
                          <span className="mr-2">{t}</span>
                          <span>
                            {info.call ? `${callEmoji(info.call)} ` : ""}
                            {pctText(pct)}
                            {info.expected_degree ? ` (${info.expected_degree})` : ""}
                            {implied ? ` → ${implied.toFixed(2)}` : ""}
                          </span>
                        </div>
                        {info.action ? (
                          <span className={`text-xs px-2 py-0.5 rounded ${actionBadgeClass(info.action)}`}>
                            {info.action}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

       {/* ML Model Forecasts Card */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">ML Model Forecasts</CardTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRunPipeline}
            disabled={isPipelineRunning}
          >
            {isPipelineRunning ? 'Pipeline Running...' : 'Re-run Pipeline'}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingMlPredictions ? (
            <div className="text-sm text-muted-foreground">Loading latest predictions...</div>
          ) : mlPredictions && Object.keys(mlPredictions).length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 text-xs text-muted-foreground">
                <div>Ticker</div>
                <div className="text-right">Predicted Change</div>
              </div>
              {Object.entries(mlPredictions).map(([ticker, prediction]) => (
                <div key={ticker} className="grid grid-cols-2 font-mono">
                  <div>{ticker}</div>
                  <div className={`text-right font-semibold ${(prediction || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {pctText(prediction)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No predictions available. The pipeline may be running in the background. Please refresh in a moment.
            </div>
          )}
        </CardContent>
      </Card>
      

      {/* Enhanced Ticker Details */}
      {latest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Ticker Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(latest.tickers).map(([ticker, info]) => (
                  <div key={ticker} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold font-mono">{ticker}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${actionBadgeClass(info.action)}`}>
                        {info.action || 'Hold'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Close:</span>
                        <span className="font-mono ml-2">${info.close.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Change:</span>
                        <span className={`font-mono ml-2 ${(info.pct_change || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {pctText(info.pct_change || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="ml-2">{info.confidence || '—'}/5</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Streak:</span>
                        <span className="ml-2">{info.streak || 0} days</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dip Onset:</span>
                        <span className="ml-2">{info.dip_onset_prob || '—'}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dip Exhaustion:</span>
                        <span className="ml-2">{info.dip_exhaustion_prob || '—'}%</span>
                      </div>
                    </div>
                    {latest.labels?.prediction_for_next_day?.[ticker] && (
                      <div className="mt-3 p-2 bg-muted rounded text-xs">
                        <strong>Reasoning:</strong> {latest.labels.prediction_for_next_day[ticker].reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* OHLCV Price Data */}
          {latest.prices && Object.keys(latest.prices).length > 0 && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Full Price Data (OHLCV)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(latest.prices).map(([ticker, priceData]) => (
                    <div key={ticker} className="border rounded-lg p-3">
                      <h3 className="font-semibold font-mono mb-2">{ticker}</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {typeof priceData.open === 'number' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Open:</span>
                            <span className="font-mono">${priceData.open.toFixed(2)}</span>
                          </div>
                        )}
                        {typeof priceData.high === 'number' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">High:</span>
                            <span className="font-mono text-emerald-600">${priceData.high.toFixed(2)}</span>
                          </div>
                        )}
                        {typeof priceData.low === 'number' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Low:</span>
                            <span className="font-mono text-rose-600">${priceData.low.toFixed(2)}</span>
                          </div>
                        )}
                        {typeof priceData.close === 'number' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Close:</span>
                            <span className="font-mono font-semibold">${priceData.close.toFixed(2)}</span>
                          </div>
                        )}
                        {typeof priceData.volume === 'number' && (
                          <div className="flex justify-between col-span-2">
                            <span className="text-muted-foreground">Volume:</span>
                            <span className="font-mono">{(priceData.volume / 1000000).toFixed(2)}M</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      
     

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">


        {/* Phase 1 Metrics - Three Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Yesterday */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Yesterday</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                if (!prev) {
                  return <div className="text-sm text-muted-foreground">No yesterday data</div>;
                }
                
                const yesterdayMetrics = calculateDayMetrics(prev);
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>P&L:</span>
                      <span className={`font-bold ${yesterdayMetrics.day_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${yesterdayMetrics.day_pnl.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Hit Rate:</span>
                      <span className="font-semibold">
                        {yesterdayMetrics.day_trades > 0 ? ((yesterdayMetrics.day_hits / yesterdayMetrics.day_trades) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Quality:</span>
                      <span className="font-semibold">{yesterdayMetrics.day_avg_quality.toFixed(0)}/100</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Error:</span>
                      <span className="font-mono">{yesterdayMetrics.day_avg_error.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Trades:</span>
                      <span>{yesterdayMetrics.day_trades}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          
          {/* Today */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                if (!latest?.totals?.trade_count) {
                  return <div className="text-sm text-muted-foreground">No metrics available</div>;
                }
                
                const todayMetrics = calculateDayMetrics(latest);
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>P&L:</span>
                      <span className={`font-bold ${todayMetrics.day_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ${todayMetrics.day_pnl.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Hit Rate:</span>
                      <span className="font-semibold">
                        {todayMetrics.day_trades > 0 ? ((todayMetrics.day_hits / todayMetrics.day_trades) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Quality:</span>
                      <span className="font-semibold">{todayMetrics.day_avg_quality.toFixed(0)}/100</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Error:</span>
                      <span className="font-mono">{todayMetrics.day_avg_error.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Trades:</span>
                      <span>{todayMetrics.day_trades}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          

          {/* All-Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All-Time ({history.length} days)</CardTitle>
            </CardHeader>
            <CardContent>
              {latest?.totals?.trade_count ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Total P&L:</span>
                    <span className={`font-bold ${(latest.totals.total_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ${(latest.totals.total_pnl || 0).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Hit Rate:</span>
                    <span className="font-semibold">{(latest.totals.success_rate * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Quality:</span>
                    <span className="font-semibold">{(latest.totals.avg_quality_score || 0).toFixed(0)}/100</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Error:</span>
                    <span className="font-mono">{(latest.totals.avg_abs_error || 0).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Trade Count:</span>
                    <span>{latest.totals.trade_count}</span>
                  </div>
                  
                  {/* Best/Worst Calls */}
                  {(latest.totals.best_call || latest.totals.worst_call) && (
                    <div className="border-t pt-2 mt-3">
                      <div className="text-xs text-muted-foreground mb-1">Best & Worst</div>
                      {latest.totals.best_call && (
                        <div className="flex justify-between text-xs">
                          <span>🏆 {latest.totals.best_call.ticker}</span>
                          <span className="text-emerald-600 font-bold">+${latest.totals.best_call.pnl.toFixed(0)}</span>
                        </div>
                      )}
                      {latest.totals.worst_call && (
                        <div className="flex justify-between text-xs">
                          <span>💥 {latest.totals.worst_call.ticker}</span>
                          <span className="text-rose-600 font-bold">${latest.totals.worst_call.pnl.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Metrics will appear after we have prediction vs actual data pairs.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

       
      </div>

      {/* Test Results */}
      {testLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Self-Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {testLog.map((test, i) => (
                <div key={i} className={`text-sm flex items-center gap-2 ${test.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span>{test.passed ? '✓' : '✗'}</span>
                  <span>{test.name}</span>
                  {test.details && <span className="text-muted-foreground">— {test.details}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// File: frontend/src/app/page.tsx - Character count: 12847