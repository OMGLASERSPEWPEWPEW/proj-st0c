# File: ml/scripts/sync_intraday_data.py
# Script to download intraday market data from Google Cloud VM to local development environment

import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
import json

class IntradayDataSyncer:
    """Handles downloading intraday market data from Google Cloud VM."""
    
    def __init__(self):
        """Initialize the data syncer with VM connection details."""
        print("sync_intraday_data.IntradayDataSyncer.__init__: Initializing intraday data syncer")
        
        # VM connection details (matching your existing operational procedures)
        self.vm_name = "st0c-daily-fetcher"
        self.vm_zone = "us-central1-a"
        self.vm_user = "deric_o_ortiz"
        self.vm_project_path = f"/home/{self.vm_user}/proj-st0c"
        
        # Local paths
        self.local_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        self.local_intraday_dir = os.path.join(self.local_project_root, 'data', 'intraday')
        self.local_processed_dir = os.path.join(self.local_project_root, 'ml', 'processed_data')
        
        # Ensure local directories exist
        os.makedirs(self.local_intraday_dir, exist_ok=True)
        os.makedirs(self.local_processed_dir, exist_ok=True)
        
        print("sync_intraday_data.IntradayDataSyncer.__init__: Syncer initialized successfully")
    
    def check_gcloud_auth(self) -> bool:
        """Check if gcloud is authenticated and can connect to VM."""
        print("sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: Checking gcloud authentication")
        
        try:
            # Test gcloud connectivity
            result = subprocess.run([
                'gcloud', 'compute', 'instances', 'list', 
                '--filter', f'name={self.vm_name}',
                '--zones', self.vm_zone
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                print(f"sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: ❌ gcloud command failed: {result.stderr}")
                return False
            
            if self.vm_name not in result.stdout:
                print(f"sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: ❌ VM {self.vm_name} not found")
                return False
            
            print("sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: ✅ gcloud authentication successful")
            return True
            
        except subprocess.TimeoutExpired:
            print("sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: ❌ gcloud command timed out")
            return False
        except FileNotFoundError:
            print("sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: ❌ gcloud not found - please install Google Cloud SDK")
            return False
        except Exception as e:
            print(f"sync_intraday_data.IntradayDataSyncer.check_gcloud_auth: ❌ Error checking gcloud: {e}")
            return False
    
    def list_remote_intraday_files(self) -> list:
        """List available intraday CSV files on the VM."""
        print("sync_intraday_data.IntradayDataSyncer.list_remote_intraday_files: Listing remote intraday files")
        
        try:
            # List intraday CSV files on VM
            result = subprocess.run([
                'gcloud', 'compute', 'ssh', f'{self.vm_user}@{self.vm_name}',
                '--zone', self.vm_zone,
                '--command', f'ls -la {self.vm_project_path}/data/intraday/intraday_*.csv 2>/dev/null || echo "NO_FILES_FOUND"'
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                print(f"sync_intraday_data.IntradayDataSyncer.list_remote_intraday_files: SSH command failed: {result.stderr}")
                return []
            
            output = result.stdout.strip()
            
            if "NO_FILES_FOUND" in output or not output:
                print("sync_intraday_data.IntradayDataSyncer.list_remote_intraday_files: No intraday files found on VM")
                return []
            
            # Parse file list
            lines = output.split('\n')
            files = []
            
            for line in lines:
                if 'intraday_' in line and '.csv' in line:
                    # Extract just the filename from the ls output
                    parts = line.split()
                    if len(parts) >= 9:  # Standard ls -la output has 9+ columns
                        filename = parts[-1]  # Last part is the filename
                        if filename.startswith('intraday_') and filename.endswith('.csv'):
                            files.append(filename)
            
            print(f"sync_intraday_data.IntradayDataSyncer.list_remote_intraday_files: Found {len(files)} intraday files on VM")
            return sorted(files)
            
        except subprocess.TimeoutExpired:
            print("sync_intraday_data.IntradayDataSyncer.list_remote_intraday_files: SSH command timed out")
            return []
        except Exception as e:
            print(f"sync_intraday_data.IntradayDataSyncer.list_remote_intraday_files: Error listing files: {e}")
            return []
    
    def list_local_intraday_files(self) -> list:
        """List existing intraday CSV files in local directory."""
        print("sync_intraday_data.IntradayDataSyncer.list_local_intraday_files: Checking local intraday files")
        
        try:
            if not os.path.exists(self.local_intraday_dir):
                return []
            
            files = [f for f in os.listdir(self.local_intraday_dir) 
                    if f.startswith('intraday_') and f.endswith('.csv')]
            
            print(f"sync_intraday_data.IntradayDataSyncer.list_local_intraday_files: Found {len(files)} local intraday files")
            return sorted(files)
            
        except Exception as e:
            print(f"sync_intraday_data.IntradayDataSyncer.list_local_intraday_files: Error listing local files: {e}")
            return []
    
    def download_intraday_file(self, filename: str) -> bool:
        """Download a single intraday CSV file from VM."""
        print(f"sync_intraday_data.IntradayDataSyncer.download_intraday_file: Downloading {filename}")
        
        try:
            # Use gcloud scp to download the file
            remote_path = f'{self.vm_user}@{self.vm_name}:{self.vm_project_path}/data/intraday/{filename}'
            local_path = os.path.join(self.local_intraday_dir, filename)
            
            result = subprocess.run([
                'gcloud', 'compute', 'scp',
                remote_path,
                local_path,
                '--zone', self.vm_zone
            ], capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                print(f"sync_intraday_data.IntradayDataSyncer.download_intraday_file: Failed to download {filename}: {result.stderr}")
                return False
            
            # Verify file was downloaded and has content
            if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
                print(f"sync_intraday_data.IntradayDataSyncer.download_intraday_file: ✅ Successfully downloaded {filename}")
                return True
            else:
                print(f"sync_intraday_data.IntradayDataSyncer.download_intraday_file: ❌ Download failed - file empty or missing: {filename}")
                return False
            
        except subprocess.TimeoutExpired:
            print(f"sync_intraday_data.IntradayDataSyncer.download_intraday_file: Download timed out: {filename}")
            return False
        except Exception as e:
            print(f"sync_intraday_data.IntradayDataSyncer.download_intraday_file: Error downloading {filename}: {e}")
            return False
    
    def download_processed_files(self) -> bool:
        """Download processed intraday feature files from VM."""
        print("sync_intraday_data.IntradayDataSyncer.download_processed_files: Downloading processed files")
        
        processed_files = [
            'intraday_features.csv',
            'combined_features.csv'  # In case they combine OpenAI + intraday data
        ]
        
        success_count = 0
        
        for filename in processed_files:
            try:
                remote_path = f'{self.vm_user}@{self.vm_name}:{self.vm_project_path}/ml/processed_data/{filename}'
                local_path = os.path.join(self.local_processed_dir, filename)
                
                # Check if file exists on VM first
                check_result = subprocess.run([
                    'gcloud', 'compute', 'ssh', f'{self.vm_user}@{self.vm_name}',
                    '--zone', self.vm_zone,
                    '--command', f'test -f {self.vm_project_path}/ml/processed_data/{filename} && echo "EXISTS" || echo "NOT_FOUND"'
                ], capture_output=True, text=True, timeout=30)
                
                if "NOT_FOUND" in check_result.stdout:
                    print(f"sync_intraday_data.IntradayDataSyncer.download_processed_files: Processed file not found on VM: {filename}")
                    continue
                
                # Download the file
                result = subprocess.run([
                    'gcloud', 'compute', 'scp',
                    remote_path,
                    local_path,
                    '--zone', self.vm_zone
                ], capture_output=True, text=True, timeout=60)
                
                if result.returncode == 0 and os.path.exists(local_path):
                    print(f"sync_intraday_data.IntradayDataSyncer.download_processed_files: ✅ Downloaded {filename}")
                    success_count += 1
                else:
                    print(f"sync_intraday_data.IntradayDataSyncer.download_processed_files: Failed to download {filename}")
                    
            except Exception as e:
                print(f"sync_intraday_data.IntradayDataSyncer.download_processed_files: Error with {filename}: {e}")
                continue
        
        print(f"sync_intraday_data.IntradayDataSyncer.download_processed_files: Downloaded {success_count}/{len(processed_files)} processed files")
        return success_count > 0
    
    def sync_specific_files(self, filenames: list) -> dict:
        """Download specific intraday files by name."""
        print(f"sync_intraday_data.IntradayDataSyncer.sync_specific_files: Syncing {len(filenames)} specific files")
        
        results = {
            'success': [],
            'failed': []
        }
        
        for filename in filenames:
            if self.download_intraday_file(filename):
                results['success'].append(filename)
            else:
                results['failed'].append(filename)
        
        print(f"sync_intraday_data.IntradayDataSyncer.sync_specific_files: Success: {len(results['success'])}, Failed: {len(results['failed'])}")
        return results
    
    def sync_recent_files(self, days: int = 7) -> dict:
        """Download intraday files from the last N days."""
        print(f"sync_intraday_data.IntradayDataSyncer.sync_recent_files: Syncing files from last {days} days")
        
        # Calculate date range
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Generate expected filenames for the date range
        target_files = []
        current_date = start_date
        
        while current_date <= end_date:
            # Skip weekends (Saturday=5, Sunday=6)
            if current_date.weekday() < 5:  # Monday=0 to Friday=4
                filename = f"intraday_{current_date.strftime('%Y-%m-%d')}.csv"
                target_files.append(filename)
            current_date += timedelta(days=1)
        
        print(f"sync_intraday_data.IntradayDataSyncer.sync_recent_files: Looking for {len(target_files)} files from {start_date} to {end_date}")
        
        # Get list of available files on VM
        remote_files = self.list_remote_intraday_files()
        
        # Find intersection of target files and available files
        files_to_sync = [f for f in target_files if f in remote_files]
        
        if not files_to_sync:
            print("sync_intraday_data.IntradayDataSyncer.sync_recent_files: No matching files found on VM")
            return {'success': [], 'failed': [], 'not_found': target_files}
        
        # Sync the files
        results = self.sync_specific_files(files_to_sync)
        results['not_found'] = [f for f in target_files if f not in remote_files]
        
        return results
    
    def sync_all_new_files(self) -> dict:
        """Download all intraday files that don't exist locally."""
        print("sync_intraday_data.IntradayDataSyncer.sync_all_new_files: Syncing all new intraday files")
        
        # Get file lists
        remote_files = self.list_remote_intraday_files()
        local_files = self.list_local_intraday_files()
        
        # Find files that exist remotely but not locally
        new_files = [f for f in remote_files if f not in local_files]
        
        if not new_files:
            print("sync_intraday_data.IntradayDataSyncer.sync_all_new_files: No new files to sync")
            return {'success': [], 'failed': [], 'already_local': local_files}
        
        print(f"sync_intraday_data.IntradayDataSyncer.sync_all_new_files: Found {len(new_files)} new files to sync")
        
        # Sync the new files
        results = self.sync_specific_files(new_files)
        results['already_local'] = local_files
        
        return results
    
    def create_sync_report(self, results: dict) -> str:
        """Create a summary report of the sync operation."""
        report = f"""
╔══════════════════════════════════════════════╗
║          INTRADAY DATA SYNC REPORT           ║
╠══════════════════════════════════════════════╣
║ Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}              ║
║                                              ║
║ SYNC RESULTS:                                ║
║   ✅ Successfully Downloaded: {len(results.get('success', [])):2d}           ║
║   ❌ Failed Downloads:        {len(results.get('failed', [])):2d}           ║
║   ℹ️  Already Local:           {len(results.get('already_local', [])):2d}           ║
║   🔍 Not Found on VM:         {len(results.get('not_found', [])):2d}           ║
╚══════════════════════════════════════════════╝
"""
        
        if results.get('success'):
            report += "\n✅ DOWNLOADED FILES:\n"
            for f in results['success']:
                report += f"   • {f}\n"
        
        if results.get('failed'):
            report += "\n❌ FAILED DOWNLOADS:\n"
            for f in results['failed']:
                report += f"   • {f}\n"
        
        if results.get('not_found'):
            report += "\n🔍 NOT FOUND ON VM:\n"
            for f in results['not_found']:
                report += f"   • {f}\n"
        
        return report

def main():
    """Main function with command line interface."""
    print(f"sync_intraday_data.main: Starting intraday data sync at {datetime.now()}")
    
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description="Sync intraday market data from Google Cloud VM")
    parser.add_argument('--recent', type=int, metavar='DAYS', default=7,
                       help='Download files from last N days (default: 7)')
    parser.add_argument('--all', action='store_true',
                       help='Download all new files not present locally')
    parser.add_argument('--files', nargs='+', metavar='FILE',
                       help='Download specific files (e.g., intraday_2025-09-17.csv)')
    parser.add_argument('--processed', action='store_true',
                       help='Also download processed feature files')
    
    args = parser.parse_args()
    
    try:
        # Create syncer
        syncer = IntradayDataSyncer()
        
        # Check authentication
        if not syncer.check_gcloud_auth():
            print("sync_intraday_data.main: ❌ Cannot connect to Google Cloud VM")
            print("Please run: gcloud auth login")
            return 1
        
        # Execute sync based on arguments
        if args.files:
            print(f"sync_intraday_data.main: Syncing specific files: {args.files}")
            results = syncer.sync_specific_files(args.files)
        elif args.all:
            print("sync_intraday_data.main: Syncing all new files")
            results = syncer.sync_all_new_files()
        else:
            print(f"sync_intraday_data.main: Syncing recent files ({args.recent} days)")
            results = syncer.sync_recent_files(args.recent)
        
        # Download processed files if requested
        if args.processed:
            print("sync_intraday_data.main: Also downloading processed files")
            syncer.download_processed_files()
        
        # Show results
        report = syncer.create_sync_report(results)
        print(report)
        
        # Return appropriate exit code
        if results.get('failed'):
            print("sync_intraday_data.main: ⚠️  Some downloads failed - check network connection and VM status")
            return 1
        elif results.get('success'):
            print("sync_intraday_data.main: ✅ SUCCESS - All requested files synced")
            return 0
        else:
            print("sync_intraday_data.main: ℹ️  No new files to sync")
            return 0
            
    except KeyboardInterrupt:
        print("\nsync_intraday_data.main: ⏹️  Sync cancelled by user")
        return 1
    except Exception as e:
        print(f"sync_intraday_data.main: ❌ ERROR - {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())

# File: ml/scripts/sync_intraday_data.py - Character count: 16684