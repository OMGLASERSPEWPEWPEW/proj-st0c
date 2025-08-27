// frontend/src/utils/autoLoader.ts
// Auto-loads JSON files from data/raw directory and watches for changes

import { TrackerJson } from '@/types/tracker';
import { parseArrayOrSingle, mergeHistory } from './tracker';

export class DataAutoLoader {
  private history: TrackerJson[] = [];
  private listeners: ((history: TrackerJson[]) => void)[] = [];
  private watchInterval: NodeJS.Timeout | null = null;
  private lastModified = new Map<string, number>();

  constructor() {
    console.log('DataAutoLoader.constructor: Initializing auto-loader');
  }

  // Subscribe to history updates
  subscribe(callback: (history: TrackerJson[]) => void) {
    console.log('DataAutoLoader.subscribe: Adding listener');
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of history changes
  private notifyListeners() {
    console.log('DataAutoLoader.notifyListeners: Notifying', this.listeners.length, 'listeners');
    this.listeners.forEach(callback => callback(this.history));
  }

  // Load all JSON files from data/raw directory
  async loadFromDataRaw(): Promise<void> {
    console.log('DataAutoLoader.loadFromDataRaw: Loading files from data/raw');
    
    try {
      // In a real app, this would be an API call to the backend
      // For now, we'll simulate by trying to load known files
      const knownFiles = [
        '2025-08-22.json',
        '2025-08-25.json', 
        '2025-08-26.json'
      ];

      const allEntries: TrackerJson[] = [];
      
      for (const filename of knownFiles) {
        try {
          // This would be replaced with actual file system access via backend API
          const response = await fetch(`/api/data/raw/${filename}`);
          if (response.ok) {
            const text = await response.text();
            const parsed = parseArrayOrSingle(text);
            if (parsed && parsed.length > 0) {
              allEntries.push(...parsed);
              console.log('DataAutoLoader.loadFromDataRaw: Loaded', filename, 'with', parsed.length, 'entries');
            }
          }
        } catch (e) {
          // File doesn't exist or network error - that's okay
          console.log('DataAutoLoader.loadFromDataRaw: Could not load', filename, e);
        }
      }

      if (allEntries.length > 0) {
        this.history = mergeHistory(this.history, allEntries);
        this.notifyListeners();
        console.log('DataAutoLoader.loadFromDataRaw: Loaded total of', this.history.length, 'entries');
      }

    } catch (e) {
      console.error('DataAutoLoader.loadFromDataRaw: Failed to load from data/raw:', e);
    }
  }

  // Start watching for file changes (polls every 30 seconds)
  startWatching(intervalMs = 30000) {
    console.log('DataAutoLoader.startWatching: Starting file watcher');
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }

    this.watchInterval = setInterval(() => {
      this.loadFromDataRaw();
    }, intervalMs);

    // Initial load
    this.loadFromDataRaw();
  }

  // Stop watching for changes
  stopWatching() {
    console.log('DataAutoLoader.stopWatching: Stopping file watcher');
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  // Manual add entries (for file uploads)
  addEntries(entries: TrackerJson[]) {
    console.log('DataAutoLoader.addEntries: Adding', entries.length, 'manual entries');
    this.history = mergeHistory(this.history, entries);
    this.notifyListeners();
  }

  // Get current history
  getHistory(): TrackerJson[] {
    return [...this.history];
  }

  // Clear all data
  clear() {
    console.log('DataAutoLoader.clear: Clearing all data');
    this.history = [];
    this.notifyListeners();
  }
}

// Singleton instance for the app
export const dataLoader = new DataAutoLoader();

// File: frontend/src/utils/autoLoader.ts - Character count: 3238