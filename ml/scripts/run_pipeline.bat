@echo off
echo [Pipeline] Step 1: Preparing data...
python -m ml.scripts.prepare_data

echo [Pipeline] Step 2: Training OKLO model...
python -m ml.scripts.train OKLO

echo [Pipeline] Step 3: Training RKLB model...
python -m ml.scripts.train RKLB

echo [Pipeline] Step 4: Generating predictions...
REM The '>' symbol redirects the output of predict_all.bat to a file
ml\scripts\predict_all.bat > frontend\public\latest_ml_predictions.json

echo [Pipeline] Done! Predictions saved to frontend/public/latest_ml_predictions.json