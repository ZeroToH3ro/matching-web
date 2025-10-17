# Cloudinary Upload Preset Setup

To enable photo uploads in the application, you need to create an upload preset in your Cloudinary account.

## Steps to Create Upload Preset

1. **Log in to Cloudinary Dashboard**
   - Go to https://cloudinary.com/console
   - Log in with your account credentials

2. **Navigate to Upload Settings**
   - Click on **Settings** (gear icon) in the top navigation
   - Click on **Upload** tab in the left sidebar

3. **Create New Upload Preset**
   - Scroll down to **Upload presets** section
   - Click **Add upload preset** button

4. **Configure Upload Preset**
   - **Preset name**: Enter `matchme-demo` (or any name you prefer)
   - **Signing Mode**: Select **Signed** (for security)
   - **Folder**: (Optional) Enter a folder name like `matchme-photos`
   - **Access mode**: Select **Public**
   - **Allowed formats**: Select image formats (jpg, png, webp, etc.)
   - **Max file size**: Set to 10 MB (or your preference)
   - **Auto backup**: Enable if desired
   - **Overwrite**: Enable if you want to allow file replacements

5. **Save Upload Preset**
   - Click **Save** button at the bottom
   - Copy the preset name (e.g., `matchme-demo`)

6. **Update Environment Variable**
   - If you used a different preset name than `matchme-demo`:
     - Open your `.env` file
     - Update or add: `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="your-preset-name"`
   - Restart your development server for changes to take effect

## Environment Variables

Make sure these Cloudinary variables are set in your `.env` file:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="dwwru7dt1"
NEXT_PUBLIC_CLOUDINARY_API_KEY="547457493724379"
CLOUDINARY_API_SECRET="6gGczfSHn3_RKwwwhL9M8uSDwZA"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="matchme-demo"
```

## Testing

After creating the upload preset:

1. Restart your development server (Ctrl+C and run `npm run dev`)
2. Navigate to `/members/edit/photos`
3. Try uploading a photo using the "Upload new image" button
4. If successful, the photo should appear in your gallery

## Troubleshooting

**"Upload preset not found" error:**
- Verify the preset name matches exactly (case-sensitive)
- Ensure the preset is saved and active in Cloudinary dashboard
- Restart your development server after changing environment variables

**Upload fails with signature error:**
- Check that your API secret is correct in `.env`
- Verify the `/api/sign-image` endpoint is working
- Ensure signing mode is set to "Signed" in the upload preset

**Photos not appearing:**
- Check browser console for errors
- Verify your Cloudinary cloud name is correct
- Ensure the preset allows the file format you're uploading
