# Operational Procedures - proj-st0c

## Daily Operations

### **Data Collection Verification**
**Every day after 3:30 PM:**
```cmd
# Check if today's file was created
gcloud compute ssh st0c-daily-fetcher --zone=us-central1-a --command="ls -la /home/deric_o_ortiz/proj-st0c/data/raw/"

# Download today's file
gcloud compute scp deric_o_ortiz@st0c-daily-fetcher:/home/deric_o_ortiz/proj-st0c/data/raw/$(date +%Y-%m-%d).json E:\development\proj-st0c\data\raw\ --zone=us-central1-a
```

### **Weekly Data Sync**
```cmd
# Download all new files
gcloud compute scp deric_o_ortiz@st0c-daily-fetcher:/home/deric_o_ortiz/proj-st0c/data/raw/*.json E:\development\proj-st0c\data\raw\ --zone=us-central1-a
```

### **Monitor System Health**
```cmd
# Check cron logs for errors
gcloud compute ssh st0c-daily-fetcher --zone=us-central1-a --command="tail -20 /home/deric_o_ortiz/proj-st0c/cron.log"

# Check VM status
gcloud compute instances list --filter="name=st0c-daily-fetcher"
```

## Troubleshooting Procedures

### **Problem: Daily file not created**
1. **Check cron logs:**
   ```bash
   gcloud compute ssh st0c-daily-fetcher --zone=us-central1-a
   cat proj-st0c/cron.log | tail -50
   ```

2. **Test script manually:**
   ```bash
   cd proj-st0c
   source venv/bin/activate
   python3 daily_fetcher.py
   ```

3. **Check API key:**
   ```bash
   cat .env | grep OPENAI_API_KEY
   ```

### **Problem: VM not responding**
1. **Check VM status in Google Cloud Console**
2. **Restart VM:**
   ```cmd
   gcloud compute instances stop st0c-daily-fetcher --zone=us-central1-a
   gcloud compute instances start st0c-daily-fetcher --zone=us-central1-a
   ```

3. **If VM is corrupted, rebuild from documentation**

### **Problem: Download fails**
1. **Check SSH connectivity:**
   ```cmd
   gcloud compute ssh st0c-daily-fetcher --zone=us-central1-a
   ```

2. **Verify file permissions:**
   ```bash
   ls -la /home/deric_o_ortiz/proj-st0c/data/raw/
   chmod 644 /home/deric_o_ortiz/proj-st0c/data/raw/*.json
   ```

## Maintenance Procedures

### **Monthly VM Updates**
```bash
# Via SSH to VM
sudo apt update && sudo apt upgrade -y
# Reboot if kernel updates were installed
sudo reboot
```

### **Cost Monitoring**
**Check monthly in Google Cloud Console:**
- Compute Engine costs
- API costs
- Storage costs
- Set up billing alerts at $20/month

### **Backup Procedures**
**Weekly snapshot:**
```cmd
gcloud compute disks snapshot st0c-daily-fetcher --zone=us-central1-a --snapshot-names=st0c-backup-$(date +%Y%m%d)
```

**Keep only 4 most recent snapshots:**
```cmd
gcloud compute snapshots list --filter="name ~ st0c-backup" --sort-by="~creationTimestamp" --limit=10
# Manually delete older ones
```

## Next Implementation Priorities

### **Week 1-2: Email Alerts**
**Set up email notifications for cron failures:**

1. **Install mailutils on VM:**
   ```bash
   sudo apt install mailutils -y
   ```

2. **Update cron job to send email on failure:**
   ```bash
   crontab -e
   # Change to:
   0 15 * * * cd /home/deric_o_ortiz/proj-st0c && /home/deric_o_ortiz/proj-st0c/venv/bin/python3 daily_fetcher.py >> cron.log 2>&1 || echo "proj-st0c daily fetch failed $(date)" | mail -s "proj-st0c Alert" your-email@gmail.com
   ```

### **Week 3-4: Cloud Storage Backup**
**Add automatic backup to Google Cloud Storage:**

1. **Enable Cloud Storage API**
2. **Install gsutil on VM**
3. **Modify daily_fetcher.py to also upload to cloud storage**
4. **Set up lifecycle policy to keep files for 90 days**

### **Month 2: Monitoring Dashboard**
**Create simple monitoring:**
1. **Health check endpoint** (simple web server on VM)
2. **Uptime monitoring** via Google Cloud Monitoring
3. **Cost alerts** in billing console

### **Month 3: Infrastructure as Code**
**Document VM creation with Terraform:**
1. **Write Terraform script** to recreate entire setup
2. **Version control** the infrastructure code
3. **Test recreation** in separate project

## Performance Optimization

### **Current Usage Analysis**
- **CPU:** Very low (only active 5-10 minutes daily)
- **Memory:** 1GB sufficient for Python script
- **Disk:** 10GB sufficient (JSON files are small)
- **Network:** Minimal (only API calls)

### **Cost Optimization Options**
1. **Preemptible instances:** Could save 60% but adds complexity
2. **Scheduled start/stop:** Start VM at 2:55 PM, stop at 3:30 PM
3. **Cloud Functions:** Serverless alternative (higher complexity)

**Recommendation:** Keep current setup - it's already optimized for cost vs. complexity.

## Security Best Practices

### **Current Security Posture**
- ✅ SSH keys managed by Google Cloud
- ✅ API keys in environment file (not code)
- ✅ Firewall restricts access
- ⚠️ No secrets management service

### **Security Improvements (Optional)**
1. **Google Secret Manager** for API keys
2. **Regular OS updates** (already planned monthly)
3. **Network isolation** (VPC, but overkill for current setup)
4. **Audit logging** (Google Cloud Audit Logs)

## Success Metrics

### **Reliability Targets**
- **Uptime:** 99%+ (VM available)
- **Success Rate:** 95%+ (daily files created)
- **Recovery Time:** < 4 hours (for any outages)

### **Cost Targets**
- **Monthly VM Cost:** < $10
- **Total Monthly Cost:** < $20 (including API)
- **Cost Growth:** < 20% month-over-month

### **Operational Efficiency**
- **Manual Intervention:** < 1 hour/week
- **Data Sync Time:** < 5 minutes/week
- **Incident Response:** < 2 hours to resolution

**Your current setup already meets or exceeds these targets!**