# ml/scripts/run_pipeline.py
import subprocess
import json
import os
import sys

def run_command(command):
    """Runs a command with the correct environment and working directory."""
    print(f"--- Running: {' '.join(command)} ---")
    
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    
    # Create a copy of the current environment and add our project root to the PYTHONPATH
    # This ensures that 'from ml.src...' imports work correctly in the subprocesses.
    env = os.environ.copy()
    env['PYTHONPATH'] = project_root + os.pathsep + env.get('PYTHONPATH', '')
    
    process = subprocess.run(
        command, 
        capture_output=True, 
        text=True, 
        cwd=project_root, 
        env=env  # Pass the modified environment to the subprocess
    )
    
    if process.returncode != 0:
        print("--- ERROR ---")
        print("STDOUT:")
        print(process.stdout)
        print("STDERR:")
        print(process.stderr)
        raise RuntimeError(f"Command failed: {' '.join(command)}")
    
    print(process.stdout.strip())
    return process.stdout.strip()

def main():
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    PYTHON_EXECUTABLE = sys.executable
    
    # Define script paths
    prepare_script = os.path.join('ml', 'scripts', 'prepare_data.py')
    train_script = os.path.join('ml', 'scripts', 'train.py')
    predict_script = os.path.join('ml', 'scripts', 'predict.py')

    # 1. Prepare Data
    run_command([PYTHON_EXECUTABLE, '-m', 'ml.scripts.prepare_data'])

    tickers = ["OKLO", "RKLB"]
    
    # 2. Train Models
    for ticker in tickers:
        run_command([PYTHON_EXECUTABLE, '-m', 'ml.scripts.train', ticker])

    # 3. Generate Predictions
    predictions = {}
    for ticker in tickers:
        # The output is now just one clean line: '"OKLO": 0.1234'
        output = run_command([PYTHON_EXECUTABLE, '-m', 'ml.scripts.predict', ticker])
        try:
            key, value = output.strip().replace('"', '').split(':')
            predictions[key.strip()] = float(value)
        except (ValueError, IndexError) as e:
            print(f"--- PARSE ERROR --- Could not parse prediction output: '{output}'")
            continue

    # 4. Save predictions to a file
    output_data = {"ml_predictions": predictions}
    output_path = os.path.join(PROJECT_ROOT, "frontend", "public", "latest_ml_predictions.json")
    
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"--- Pipeline complete! Predictions saved to {output_path} ---")

    # 5. Save daily predictions with metadata for historical tracking
    print("--- Step 5: Saving daily predictions for historical tracking ---")
    save_daily_script = os.path.join('ml', 'scripts', 'save_daily_prediction.py')
    run_command([PYTHON_EXECUTABLE, '-m', 'ml.scripts.save_daily_prediction'])

if __name__ == "__main__":
    main()