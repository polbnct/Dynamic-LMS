# How to Fix Storage RLS Error

## Option 1: Run SQL Script (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `src/FIX_STORAGE_NOW.sql`
3. Click "Run"
4. You should see 12 policies created
5. Try uploading a file again

## Option 2: Use Supabase Dashboard UI

If the SQL script doesn't work, use the Dashboard:

### Step 1: Create the Buckets (if they don't exist)

1. Go to **Storage** in your Supabase Dashboard
2. Click **"New bucket"**
3. Create these buckets (one at a time):
   - Name: `lesson-pdfs` → Set to **Public**
   - Name: `assignment-pdfs` → Set to **Public**
   - Name: `assignment-submissions` → Set to **Public**

### Step 2: Set Bucket Policies

For each bucket:

1. Click on the bucket name
2. Go to **"Policies"** tab
3. Click **"New Policy"**
4. Choose **"For full customization"**
5. Create these policies:

#### For Uploads:
- **Policy name**: `Allow authenticated uploads`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'lesson-pdfs'  -- (or 'assignment-pdfs' or 'assignment-submissions')
  ```

#### For Reads:
- **Policy name**: `Allow authenticated reads`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'lesson-pdfs'  -- (or 'assignment-pdfs' or 'assignment-submissions')
  ```

#### For Updates:
- **Policy name**: `Allow authenticated updates`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'lesson-pdfs'  -- (or 'assignment-pdfs' or 'assignment-submissions')
  ```

#### For Deletes:
- **Policy name**: `Allow authenticated deletes`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'lesson-pdfs'  -- (or 'assignment-pdfs' or 'assignment-submissions')
  ```

Repeat for all 3 buckets.

## Option 3: Make Buckets Public (Simplest)

1. Go to **Storage** → Select each bucket
2. Click **"Make Public"** or toggle **"Public bucket"** to ON
3. This automatically allows all operations

**Note**: Making buckets public means anyone with the URL can access files. For development/testing, this is fine. For production, use proper policies.

## Verification

After applying any of the above:
1. Refresh your browser
2. Try uploading a PDF file
3. The error should be gone!
