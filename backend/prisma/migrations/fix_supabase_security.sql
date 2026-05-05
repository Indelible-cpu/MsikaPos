-- Fix Supabase Security Linter Warnings (Comprehensive Policy Update 2026-05-05)
-- 
-- 1. Switch SECURITY DEFINER functions to SECURITY INVOKER
ALTER FUNCTION public.get_user_role() SECURITY INVOKER;
ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER;

-- 2. Explicit RLS Policies
-- Note: Backend uses Prisma service role which bypasses RLS entirely.
-- These policies satisfy the Supabase linter and prevent accidental public leaks.

-- Sensitive Business Data: Service role only (deny all others)
CREATE POLICY "Service role only" ON public."BlockedIP" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Inquiry" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."SecurityLog" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."DebtPayment" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."FeatureConfig" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Sale" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."SaleItem" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Expense" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."SyncLog" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Customer" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."User" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Branch" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Role" FOR ALL USING (false);

-- Public Storefront Access: Allow public read (for SELECT), but service role only for modifications
CREATE POLICY "Public read access" ON public."Product" FOR SELECT USING (true);
CREATE POLICY "Service role only for modifications" ON public."Product" FOR ALL USING (false);

CREATE POLICY "Public read access" ON public."Category" FOR SELECT USING (true);
CREATE POLICY "Service role only for modifications" ON public."Category" FOR ALL USING (false);

CREATE POLICY "Public read access" ON public."CompanySettings" FOR SELECT USING (true);
CREATE POLICY "Service role only for modifications" ON public."CompanySettings" FOR ALL USING (false);

CREATE POLICY "Public read access" ON public."ProductRating" FOR SELECT USING (true);
CREATE POLICY "Service role only for modifications" ON public."ProductRating" FOR ALL USING (false);

-- Instructions: 
-- 1. Copy the SQL above.
-- 2. Go to Supabase Dashboard -> SQL Editor.
-- 3. Paste and Run.
-- 4. If any policy already exists, you may need to DROP it first or use CREATE OR REPLACE if supported (Postgres policies use CREATE POLICY).
