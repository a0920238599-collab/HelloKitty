SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'products_judgment_status_check';
