-- Read-only after approved execution; five RLS-enabled tables expected.
SELECT c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'INSERT') AS browser_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS browser_update,
 has_table_privilege('authenticated',c.oid,'DELETE') AS browser_delete,
 has_table_privilege('service_role',c.oid,'UPDATE') AS service_update
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
AND c.relname IN ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction','KitOrderPayment');
-- anon_select and all browser mutation columns must be false; events service_update false.
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction','KitOrderPayment');
SELECT conname,convalidated FROM pg_constraint WHERE conname LIKE 'r2_%';
SELECT p.proname,t.tgname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND t.tgrelid IN ('public."KitPurchaseLine"'::regclass,'public."KitPurchaseEvent"'::regclass,'public."KitPurchaseTransaction"'::regclass);
SELECT count(*) AS wrong_association FROM public."KitPurchaseLine" l
JOIN public."KitOrderIntent" o ON o.id=l."kitOrderIntentId"
JOIN public."Assessment" a ON a.id=l."assessmentId"
WHERE l."clinicId"<>o."clinicId" OR l."assessmentId"<>o."assessmentId"
OR l."clinicId"<>a."clinicId" OR l."patientId"<>a."patientId";
SELECT "clinicId","clientEventId",count(*) FROM public."KitPurchaseEvent"
WHERE "clientEventId" IS NOT NULL GROUP BY 1,2 HAVING count(*)>1;
SELECT "kitOrderIntentId","clientTransactionId",count(*) FROM public."KitPurchaseTransaction"
GROUP BY 1,2 HAVING count(*)>1;
