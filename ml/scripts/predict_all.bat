@echo off
echo { "ml_predictions": { > temp_predictions.json
python -m ml.scripts.predict OKLO >> temp_predictions.json
echo , >> temp_predictions.json
python -m ml.scripts.predict RKLB >> temp_predictions.json
echo }} >> temp_predictions.json