-- Fix Supabase Security Linter Warnings (Applied 2026-04-27)
-- 
-- 1. Switch SECURITY DEFINER functions to SECURITY INVOKER
ALTER FUNCTION public.get_user_role() SECURITY INVOKER;
ALTER FUNCTION public.rls_auto_enable() SECURITY INVOKER;

-- 2. Add deny-all RLS policies for tables with RLS enabled but no policies
-- Backend uses Prisma service role which bypasses RLS entirely.
CREATE POLICY "Service role only" ON public."BlockedIP" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."Inquiry" FOR ALL USING (false);
CREATE POLICY "Service role only" ON public."SecurityLog" FOR ALL USING (false);
