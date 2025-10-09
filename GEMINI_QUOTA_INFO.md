# Gemini API Quota Information

## Current Issue: 429 Too Many Requests

Your free tier quota for `gemini-2.5-flash-preview-image` has been exhausted.

## Check Your Quota:

1. Visit: https://aistudio.google.com/app/apikey
2. Click on your API key
3. View "Usage & Billing"
4. Check limits for image generation models

## Free Tier Limits (Preview Models):

- **gemini-2.5-flash-preview-image**:
  - ~2 requests per minute
  - ~50 requests per day
  - Very limited for testing only

## Solutions:

### A. Wait for Quota Reset
- Daily quotas reset at midnight UTC
- Minute quotas reset every 60 seconds
- Try again tomorrow

### B. Upgrade to Paid Tier
- Visit: https://console.cloud.google.com/billing
- Enable billing on your Google Cloud project
- Get higher limits (1000+ RPM)
- Cost: ~$0.04 per image

### C. Use Alternative (Recommended)

Since Gemini image generation is limited, consider:

**1. Replicate API** (Best option)
   - Cost: $0.002/image (20x cheaper)
   - Free tier: 50 images/month
   - Better availability
   - Proven models (InsightFace)

**2. Manual Selection Mode** (Free forever)
   - No API needed
   - Works with all animals
   - User draws face regions
   - Quality: 7/10

## Next Steps:

1. **Check quota**: https://aistudio.google.com/app/apikey
2. **Wait 24h** for quota reset
3. **Or switch to Replicate** for immediate testing

---

## Important Notes:

- `gemini-2.5-flash-preview-image` is PREVIEW/EXPERIMENTAL
- Not recommended for production use
- Very limited free tier
- Better for testing prompts, not volume usage
