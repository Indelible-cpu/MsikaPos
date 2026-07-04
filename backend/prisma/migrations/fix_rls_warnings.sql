-- Fix Supabase Security Linter Warnings: RLS Enabled No Policy
-- These tables have RLS enabled but lack explicit policies.
-- Since the backend uses the service role (which bypasses RLS), 
-- we add a "deny all" policy to satisfy the linter and secure public access.

CREATE POLICY "Service role only" ON public."Business" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."ProductVariant" FOR ALL USING (false);
