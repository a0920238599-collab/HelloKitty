ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_judgment_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_judgment_status_check CHECK (judgment_status IN ('unjudged', 'yes', 'no', 'disputed'));
