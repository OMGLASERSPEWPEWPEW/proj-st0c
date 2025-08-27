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
  legendFormatter
} from '@/utils/tracker';

export default function TrackerDashboard() {
  console.log('TrackerDashboard.render: Component rendering');
  
  // State declarations
  const [history, setHistory] = useState<TrackerJson[]>([]);
  const [input, setInput] = useState("");
  const [normalize, setNormalize] = useState(false);
  const [showPred, setShowPred] = useState(true);
  const [show, setShow] = useState<Record<string, boolean>>({
    OKLO: true,
    RKLB: true,
    SPY: false,
    VIX: false,
    VIXY: false,
    VIXM: false,
  });
  const [testLog, setTestLog] = useState<TestResult[]>([]);

  // Load history on mount
  useEffect(() => {
    console.log('TrackerDashboard.useEffect: Loading history from localStorage');
    setHistory(loadHistory());
  }, []);

  // Compute available tickers
  const allKeys = useMemo(() => {
    console.log('TrackerDashboard.allKeys: Computing all ticker keys from', history.length, 'entries');
    const keys = new Set<string>();
    history.forEach((h) => {
      Object.keys(h.tickers || {}).forEach((k) => keys.add(k));
      Object.keys(h.benchmarks || {}).forEach((k) => keys.add(k));
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
      if (show[k]) list.push(k);
      if (showPred) list.push(`${k}_PRED`);
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

  // Computed values
  const latest = history[history.length - 1] || null;
  const prev = history[history.length - 2] || null;
  const totals = latest?.totals;

  // =============================
  // Event Handlers
  // =============================
  async function handleLoadFromRaw() {
    console.log('TrackerDashboard.handleLoadFromRaw: Loading JSON files from data/raw');
    
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      
      console.log('TrackerDashboard.handleLoadFromRaw: API response:', result);
      
      if (!result.success) {
        alert(`Failed to load from data/raw: ${result.error}\nPath checked: ${result.path || 'unknown'}`);
        return;
      }
      
      if (!Array.isArray(result.data)) {
        alert(`API returned invalid data format. Expected array, got: ${typeof result.data}`);
        console.error('TrackerDashboard.handleLoadFromRaw: Invalid data format:', result.data);
        return;
      }
      
      if (result.data.length === 0) {
        alert(`Found ${result.files_found || 0} JSON files but none had valid tracker data.`);
        return;
      }
      
      // Merge with existing history
      const newHistory = mergeHistory(history, result.data);
      setHistory(newHistory);
      saveHistory(newHistory);
      
      alert(`Successfully loaded ${result.entries_loaded} entries from ${result.files_found} JSON files.`);
      console.log('TrackerDashboard.handleLoadFromRaw: Loaded', result.entries_loaded, 'entries');
      
    } catch (error) {
      console.error('TrackerDashboard.handleLoadFromRaw: API call failed:', error);
      alert('Failed to connect to API. Make sure the development server is running.');
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
    setHistory(newHistory);
    saveHistory(newHistory);
    setInput("");
    console.log('TrackerDashboard.handleAdd: Added', parsed.length, 'entries, total history now', newHistory.length);
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
              <YAxis tick={{ fontSize: 12 }} />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Review</CardTitle>
          </CardHeader>
          <CardContent>
            {prev && latest ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">Yesterday vs. Today</div>
                <div className="grid grid-cols-4 font-semibold text-xs border-b pb-1">
                  <div>Ticker</div>
                  <div>Prev Call</div>
                  <div>Actual</div>
                  <div>Result</div>
                </div>
                {(["OKLO", "RKLB"] as const).map((t) => perfRow(t))}
                {totals && (
                  <div className="mt-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Correct</span><span className="font-semibold">{totals.correct}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Incorrect</span><span className="font-semibold">{totals.incorrect}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Success rate</span><span className="font-semibold">{(totals.success_rate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Once we have at least two days in history, this will summarize yesterday's prediction vs today's outcome.</div>
            )}
          </CardContent>
        </Card>

       
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