{/* Prediction Performance Tracker: RNN */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            Prediction Performance Tracker: RNN
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRunPipeline}
              disabled={isPipelineRunning}
            >
              {isPipelineRunning ? 'Running...' : 'Re-run Pipeline'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Debug Info */}
            <div className="text-xs text-gray-500">
              RNN Historical Predictions: {rnnHistoricalPredictions.length} loaded
            </div>
            
            {rnnHistoricalPredictions.length > 0 ? (
              <>
                {/* Latest RNN Predictions */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-semibold">Latest RNN Results</div>
                  <div className="grid grid-cols-3 font-semibold text-xs border-b pb-1">
                    <div>Ticker</div>
                    <div>Date</div>
                    <div>Predicted</div>
                  </div>
                  
                  {/* Show the most recent prediction */}
                  {(() => {
                    const latest = rnnHistoricalPredictions[rnnHistoricalPredictions.length - 1];
                    if (!latest) return <div>No predictions</div>;
                    
                    return Object.entries(latest.predictions).map(([ticker, pred]) => (
                      <div key={ticker} className="grid grid-cols-3 text-xs items-center">
                        <div className="font-mono">{ticker}</div>
                        <div>{latest.date}</div>
                        <div className={pred.predicted_next_day_pct >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {pctText(pred.predicted_next_day_pct)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* All Historical Predictions */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-semibold">Historical RNN Predictions</div>
                  <div className="max-h-40 overflow-y-auto">
                    {rnnHistoricalPredictions.map((rnn) => (
                      <div key={rnn.date} className="text-xs border-b pb-1">
                        <div className="font-semibold">{rnn.date}</div>
                        <div className="grid grid-cols-2 gap-2 pl-2">
                          {Object.entries(rnn.predictions).map(([ticker, pred]) => (
                            <div key={ticker} className="flex justify-between">
                              <span className="font-mono">{ticker}:</span>
                              <span className={pred.predicted_next_day_pct >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                {pctText(pred.predicted_next_day_pct)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No RNN predictions found. Run the pipeline to generate predictions.
              </div>
            )}

            {/* Tomorrow's ML Predictions - Current predictions from latest_ml_predictions.json */}
            <div className="border-t pt-3">
              <div className="text-xs text-muted-foreground font-semibold mb-2">Tomorrow's ML Predictions</div>
              {isLoadingMlPredictions ? (
                <div className="text-sm text-muted-foreground">Loading predictions...</div>
              ) : mlPredictions && Object.keys(mlPredictions).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(mlPredictions).map(([ticker, prediction]) => (
                    <div key={ticker} className="flex justify-between text-sm">
                      <span className="font-mono">{ticker}:</span>
                      <span className={`font-semibold ${(prediction || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {pctText(prediction)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(["OKLO", "RKLB"] as const).map((ticker) => (
                    <div key={ticker} className="flex justify-between text-sm">
                      <span className="font-mono">{ticker}:</span>
                      <span className="text-muted-foreground">No prediction</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>