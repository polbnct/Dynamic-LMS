# How to Fix Storage RLS Through Supabase Dashboard

Since you can't run SQL, follow these steps in the Supabase Dashboard:

## For Each Bucket (lesson-pdfs, assignment-pdfs, assignment-submissions):

1. Go to **Storage** in your Supabase Dashboard
2. Click on the bucket name (e.g., `lesson-pdfs`)
3. Click on the **"Policies"** tab
4. Click **"New Policy"**
5. Choose **"For full customization"**

### Create 4 Policies for Each Bucket:

#### Policy 1: Allow Uploads (INSERT)
- **Policy name**: `Allow authenticated uploads`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression): Leave empty or use `true`
- **Policy definition** (WITH CHECK expression): `bucket_id = 'lesson-pdfs'` (replace with your bucket name)

#### Policy 2: Allow Reads (SELECT)
- **Policy name**: `Allow authenticated reads`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression): `bucket_id = 'lesson-pdfs'` (replace with your bucket name)

#### Policy 3: Allow Updates (UPDATE)
- **Policy name**: `Allow authenticated updates`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression): `bucket_id = 'lesson-pdfs'`
- **Policy definition** (WITH CHECK expression): `bucket_id = 'lesson-pdfs'`

#### Policy 4: Allow Deletes (DELETE)
- **Policy name**: `Allow authenticated deletes`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition** (USING expression): `bucket_id = 'lesson-pdfs'`

## Repeat for all 3 buckets:
- `lesson-pdfs`
- `assignment-pdfs`
- `assignment-submissions`

## Alternative: Quick Fix
If the above is too complex, you can try:
1. Go to **Storage** → Click on each bucket
2. Make sure **"Public bucket"** is toggled **ON**
3. In the bucket settings, look for **"RLS"** or **"Row Level Security"** and try to disable it (if available)

After setting up the policies, try uploading again.
