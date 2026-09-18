-- Migration: 20260914001200_mvp_extended_features.sql
-- Description: Core extensions for HelpLift MVP Phase 1 (Urgency, Fulfillment Proofs, Impact Stories, Gift Library)

-- 1. Urgency on Needs
ALTER TABLE public.needs ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'medium';
ALTER TABLE public.needs DROP CONSTRAINT IF EXISTS needs_urgency_check;
ALTER TABLE public.needs ADD CONSTRAINT needs_urgency_check CHECK (urgency IN ('low', 'medium', 'high'));

-- 2. Fulfillment Proof Attributes
ALTER TABLE public.fulfillments ADD COLUMN IF NOT EXISTS proof_storage_path text;
ALTER TABLE public.fulfillments ADD COLUMN IF NOT EXISTS proof_notes text;
ALTER TABLE public.fulfillments ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Storage Bucket: fulfillment-proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('fulfillment-proofs', 'fulfillment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage policies for fulfillment-proofs
DROP POLICY IF EXISTS "Authenticated users can upload fulfillment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload fulfillment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fulfillment-proofs'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Authenticated users can read fulfillment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can read fulfillment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fulfillment-proofs'
);

-- 3. Impact Stories Table
CREATE TABLE IF NOT EXISTS public.impact_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  need_id uuid REFERENCES public.needs(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  author_role text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.impact_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view impact stories" ON public.impact_stories;
CREATE POLICY "Anyone can view impact stories"
ON public.impact_stories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Organizations can create impact stories" ON public.impact_stories;
CREATE POLICY "Organizations can create impact stories"
ON public.impact_stories FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND o.profile_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Organizations can update their impact stories" ON public.impact_stories;
CREATE POLICY "Organizations can update their impact stories"
ON public.impact_stories FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_id AND o.profile_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage impact stories" ON public.impact_stories;
CREATE POLICY "Admins can manage impact stories"
ON public.impact_stories FOR ALL TO authenticated
USING (public.is_admin());

-- Storage Bucket: impact-media (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('impact-media', 'impact-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view impact media" ON storage.objects;
CREATE POLICY "Public can view impact media"
ON storage.objects FOR SELECT
USING (bucket_id = 'impact-media');

DROP POLICY IF EXISTS "Organizations can upload impact media" ON storage.objects;
CREATE POLICY "Organizations can upload impact media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'impact-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- 4. Gift Library Table
CREATE TABLE IF NOT EXISTS public.gift_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES public.givers(id) ON DELETE CASCADE,
  title text NOT NULL,
  offering_type text NOT NULL DEFAULT 'goods' CHECK (offering_type IN ('goods', 'services', 'financial')),
  description text NOT NULL,
  quantity_or_value text,
  conditions text,
  location text,
  expiry_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'claimed', 'expired', 'rejected')),
  claimed_by_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Givers can view their own gift offerings" ON public.gift_offerings;
CREATE POLICY "Givers can view their own gift offerings"
ON public.gift_offerings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.givers g
    WHERE g.id = giver_id AND g.profile_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Givers can create gift offerings" ON public.gift_offerings;
CREATE POLICY "Givers can create gift offerings"
ON public.gift_offerings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.givers g
    WHERE g.id = giver_id AND g.profile_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Public and orgs can view approved offerings" ON public.gift_offerings;
CREATE POLICY "Public and orgs can view approved offerings"
ON public.gift_offerings FOR SELECT
USING (status = 'approved');

DROP POLICY IF EXISTS "Approved organizations can claim offerings" ON public.gift_offerings;
CREATE POLICY "Approved organizations can claim offerings"
ON public.gift_offerings FOR UPDATE TO authenticated
USING (
  status = 'approved' AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.profile_id = (SELECT auth.uid()) AND o.verification_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.profile_id = (SELECT auth.uid()) AND o.verification_status = 'approved'
  )
);

DROP POLICY IF EXISTS "Admins can manage all gift offerings" ON public.gift_offerings;
CREATE POLICY "Admins can manage all gift offerings"
ON public.gift_offerings FOR ALL TO authenticated
USING (public.is_admin());
