# proj-st0c Setup Guide

## Project Structure
```
proj-st0c/
├── frontend/          # Next.js web application
├── ml/               # Python ML pipeline
│   ├── venv/        # Python virtual environment
│   └── scripts/     # ML data processing scripts
└── data/            # Data storage
    ├── raw/         # Raw JSON data files
    └── ChatGPTRNN/  # ML prediction outputs
```

## Prerequisites
- **Node.js** (18+ recommended)
- **Python** (3.8+ recommended)
- **Git**

## Setup Instructions

### 1. Clone and Navigate
```bash
git clone <repository-url>
cd proj-st0c
```

### 2. Frontend Setup (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: **http://localhost:3000**

### 3. ML Backend Setup (Python)
```bash
cd ../ml
# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install requirements (if requirements.txt exists)
pip install -r requirements.txt
```

### 4. Data Directory
Ensure the following directories exist:
```bash
mkdir -p data/raw
mkdir -p data/ChatGPTRNN
```

## Running the Application

### Start Frontend Server
```bash
cd frontend
npm run dev
```

### Run ML Pipeline (when needed)
```bash
cd ml
# Activate venv first
venv\Scripts\activate    # Windows
# or
source venv/bin/activate # macOS/Linux

# Run the pipeline
python scripts/run_pipeline.py
```

## Key Features
- **Auto Data Loading**: Frontend automatically loads JSON files from `/data/raw`
- **ML Pipeline**: Python scripts process data and generate predictions
- **API Integration**: Frontend APIs can trigger ML pipeline processing
- **Real-time Updates**: Frontend watches for data changes and updates

## Development Notes
- Frontend development server auto-reloads on code changes
- ML pipeline processes data from `/data/raw` into `/ml/processed_data`
- Predictions are saved to `/frontend/public/latest_ml_predictions.json`
- Daily predictions are archived in `/data/ChatGPTRNN`

## Common Commands
```bash
# Frontend development
cd frontend && npm run dev

# Run ML pipeline
cd ml && python scripts/run_pipeline.py

# Manual prediction trigger via API
# POST http://localhost:3000/api/run-pipeline
```