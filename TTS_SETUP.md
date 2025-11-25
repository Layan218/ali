# TTS Provider Setup Guide

The Auto-Presentation feature requires at least **ONE** TTS provider to be configured for audio generation.

## Quick Setup

1. Create a `.env.local` file in the root of your project (if it doesn't exist)
2. Add at least one of the following provider configurations:

## Option 1: Amazon Polly (Recommended for Saudi/Gulf English)

Best for: Natural Saudi/Gulf English accent using Zayd (male) or Hala (female) voices.

```env
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_REGION=me-central-1
```

**How to get AWS credentials:**
1. Go to [AWS Console](https://console.aws.amazon.com/iam/)
2. Create an IAM user with `AmazonPollyFullAccess` policy
3. Generate Access Key ID and Secret Access Key
4. Copy them to your `.env.local` file

## Option 2: ElevenLabs (Premium Quality)

Best for: High-quality, natural-sounding voices.

```env
ELEVEN_LABS_API_KEY=your_elevenlabs_api_key_here
```

**How to get ElevenLabs API key:**
1. Go to [ElevenLabs Settings](https://elevenlabs.io/app/settings/api-keys)
2. Create a new API key
3. Copy it to your `.env.local` file

## Option 3: Google Cloud TTS (Fallback)

Best for: Reliable fallback option.

```env
GOOGLE_CLOUD_TTS_API_KEY=your_google_cloud_tts_api_key_here
```

**How to get Google Cloud TTS API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the Cloud Text-to-Speech API
3. Create an API key
4. Copy it to your `.env.local` file

## Complete Example `.env.local` File

```env
# Amazon Polly (Recommended for Saudi/Gulf English)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=me-central-1

# ElevenLabs (Optional - Premium Quality)
# ELEVEN_LABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxx

# Google Cloud TTS (Optional - Fallback)
# GOOGLE_CLOUD_TTS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx
```

## Verification

After adding your API keys:

1. **Restart your development server** (if running):
   ```bash
   # Stop the server (Ctrl+C) and restart:
   npm run dev
   ```

2. **Check the console logs** when generating audio:
   - You should see: `[TTS] ✓ [Provider Name] succeeded`
   - Audio length will be logged: `TTS audio length: [number]`

3. **Test the Auto-Presentation feature**:
   - Go to your presentation editor
   - Click "🤖 AI Auto-Present"
   - Select a voice style (e.g., "Saudi English (Male)")
   - Click "▶ Start Auto-Presentation"
   - Audio should generate and play

## Troubleshooting

### "No TTS provider available" Error

**Cause:** No API keys are configured or all providers failed.

**Solution:**
1. Check that your `.env.local` file exists in the project root
2. Verify the API keys are correct (no extra spaces, quotes, etc.)
3. Restart your development server after adding keys
4. Check server console logs for specific error messages

### "AWS credentials are invalid" Error

**Cause:** AWS credentials are incorrect or don't have Polly permissions.

**Solution:**
1. Verify your AWS Access Key ID and Secret Access Key
2. Ensure the IAM user has `AmazonPollyFullAccess` policy
3. Check that `AWS_REGION` is set correctly (e.g., `me-central-1`)

### Audio Generation Fails

**Cause:** API key is invalid, expired, or quota exceeded.

**Solution:**
1. Check your API provider dashboard for quota/usage limits
2. Verify the API key is active and has sufficient credits
3. Try a different provider as fallback

## Provider Priority

The system tries providers in this order:
1. **Amazon Polly** (if AWS credentials are set)
2. **ElevenLabs** (if API key is set)
3. **Google Cloud TTS** (if API key is set)

The first available provider will be used. If one fails, it automatically tries the next one.

## Notes

- `.env.local` is automatically ignored by git (won't be committed)
- Never commit your actual API keys to version control
- For production deployment, set environment variables in your hosting platform (Vercel, AWS, etc.)

