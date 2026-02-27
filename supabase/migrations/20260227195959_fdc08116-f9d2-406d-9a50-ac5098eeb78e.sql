-- Make chat-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-images';

-- Drop existing public read policy
DROP POLICY IF EXISTS "Public read chat images" ON storage.objects;

-- Allow authenticated users to read only their own folder
CREATE POLICY "Authenticated users read own images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Ensure upload policy scopes to user folder
DROP POLICY IF EXISTS "Authenticated users upload chat images" ON storage.objects;
CREATE POLICY "Authenticated users upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own images
DROP POLICY IF EXISTS "Users delete own chat images" ON storage.objects;
CREATE POLICY "Users delete own chat images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);