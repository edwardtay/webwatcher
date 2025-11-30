# Environment Variables Setup Guide for Google Cloud Run

## Quick Setup

### Method 1: Google Cloud Console (Easiest)

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on your service: `verisense-agentkit` or `webwatcher`
3. Click **"Edit & Deploy New Revision"**
4. Scroll to **"Variables & Secrets"** tab
5. Click **"Add Variable"** for each:

#### Required for Basic Functionality:
```
OPENAI_API_KEY=sk-...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CDP_WALLET_SECRET=...
```

#### Required for Wallet Analysis Integrations:
```
MORALIS_API_KEY=eyJhbGci...
BLOCKSCOUT_API_KEY=...
ALCHEMY_API_KEY=...
THIRDWEB_SECRET_KEY=...
NANSEN_API_KEY=...
METASLEUTH_LABEL_API_KEY=...
METASLEUTH_RISK_API_KEY=...
PASSPORT_API_KEY=...
```

#### Optional (for additional features):
```
EXA_API_KEY=...
URLSCAN_API_KEY=...
LETTA_API_KEY=...
```

6. Click **"Deploy"** at the bottom

---

### Method 2: Command Line (gcloud CLI)

#### Set All Variables at Once:

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars \
    "MORALIS_API_KEY=your_moralis_key,"\
    "BLOCKSCOUT_API_KEY=your_blockscout_key,"\
    "ALCHEMY_API_KEY=your_alchemy_key,"\
    "THIRDWEB_SECRET_KEY=your_thirdweb_key,"\
    "NANSEN_API_KEY=your_nansen_key,"\
    "METASLEUTH_LABEL_API_KEY=your_metasleuth_label_key,"\
    "METASLEUTH_RISK_API_KEY=your_metasleuth_risk_key,"\
    "PASSPORT_API_KEY=your_passport_key,"\
    "OPENAI_API_KEY=your_openai_key,"\
    "PORT=8080,"\
    "NODE_ENV=production"
```

#### Set Variables Individually:

```bash
# Moralis
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "MORALIS_API_KEY=eyJhbGci..."

# Blockscout
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "BLOCKSCOUT_API_KEY=your_key"

# Alchemy
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "ALCHEMY_API_KEY=your_key"

# Continue for each service...
```

#### Using the Script:

```bash
# Set environment variables in your shell first
export MORALIS_API_KEY=your_key
export BLOCKSCOUT_API_KEY=your_key
# ... etc

# Then run the script
./set-env-vars.sh
```

---

### Method 3: Update cloudbuild.yaml (For CI/CD)

Add environment variables to your `cloudbuild.yaml`:

```yaml
steps:
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'verisense-agentkit'
      - '--image'
      - 'gcr.io/$PROJECT_ID/verisense-agentkit:$SHORT_SHA'
      - '--region'
      - 'us-central1'
      - '--update-env-vars'
      - 'MORALIS_API_KEY=${_MORALIS_API_KEY},BLOCKSCOUT_API_KEY=${_BLOCKSCOUT_API_KEY},ALCHEMY_API_KEY=${_ALCHEMY_API_KEY}'
```

Then set substitution variables in Cloud Build:
- Go to Cloud Build → Triggers → Edit Trigger
- Add substitution variables:
  - `_MORALIS_API_KEY`
  - `_BLOCKSCOUT_API_KEY`
  - etc.

---

## Where to Get API Keys

### Moralis
- Sign up: https://moralis.io
- Dashboard → API Keys → Copy API Key

### Blockscout
- Public API: No key needed (or get from https://blockscout.com)
- Or use your own Blockscout instance

### Alchemy
- Sign up: https://www.alchemy.com
- Dashboard → Apps → View Key → Copy API Key

### Thirdweb
- Sign up: https://thirdweb.com
- Dashboard → Settings → API Keys → Create Secret Key

### Nansen
- Sign up: https://www.nansen.ai
- Dashboard → API → Generate API Key

### MetaSleuth
- Sign up: https://metasleuth.io
- Dashboard → API Keys → Copy Label API Key and Risk API Key

### Passport
- Sign up: https://passport.xyz
- Dashboard → API → Generate API Key

---

## Verify Environment Variables

Check if variables are set:

```bash
gcloud run services describe verisense-agentkit \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Or view in Console:
- Cloud Run → Service → "Revisions & Variables" tab

---

## Notes

- **Graceful Degradation**: If an API key is missing, that integration will return an error but won't break the endpoint
- **Security**: Never commit API keys to git. Use environment variables or Google Secret Manager
- **Secret Manager**: For production, consider using Google Secret Manager instead of plain env vars:
  ```bash
  gcloud run services update verisense-agentkit \
    --region us-central1 \
    --update-secrets="MORALIS_API_KEY=moralis-key:latest"
  ```

---

## Troubleshooting

**Variables not working?**
- Make sure you deployed a new revision after adding variables
- Check logs: `gcloud run services logs read verisense-agentkit --region us-central1`
- Verify variable names match exactly (case-sensitive)

**Integration failing?**
- Check if API key is valid
- Verify API key has correct permissions
- Check integration logs in the response (each integration reports errors independently)

