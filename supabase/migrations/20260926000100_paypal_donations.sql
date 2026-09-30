-- Migration: 20260926000100_paypal_donations.sql
-- Description: Adds 'paypal' as a third donation_method, alongside 'eft' and
-- 'payfast'. No other schema change needed - donations.payment_method already
-- drives everything (which dialog step to show, which webhook/return route
-- confirms it, receipt wording), the same way payfast slotted in.

alter type public.donation_method add value if not exists 'paypal';
