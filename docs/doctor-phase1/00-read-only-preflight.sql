-- Read-only reconciliation. Run independently for each approved target.
SELECT current_database(), current_user, version();
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM public._prisma_migrations
WHERE (finished_at IS NULL AND rolled_back_at IS NULL)
   OR migration_name IN ('20260829_post_approval_workflow','20261023_doctor_notes_and_partial_kit','20261029_assessment_clinic_location','20261030_partial_checkout_transactions');
SELECT table_name, column_name, data_type
FROM information_schema.columns WHERE table_schema='public'
AND table_name IN ('KitOrderPayment','ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction','ClinicLocation','KitOrderIntent','WhatsappDelivery')
ORDER BY table_name, ordinal_position;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public'
AND tablename IN ('ClinicLocation','Assessment','KitOrderPayment','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction');
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('public."Assessment"'::regclass,'public."ClinicLocation"'::regclass);
SELECT p.proname, pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('jwt_is_super_admin','jwt_user_role','jwt_is_clinic_member','custom_access_token_hook');
SELECT c.id,c.name,c.slug,d.id AS doctor_id,d.name AS doctor_name,d."provisioningStatus",
 d."supabaseUserId" IS NOT NULL AS primary_link_present,
 d."supabasePhoneUserId" IS NOT NULL AS phone_link_present
FROM public."Clinic" c LEFT JOIN public."Doctor" d ON d."clinicId"=c.id
WHERE c.slug IN ('yavana-skin-hair-clinic','aesthetiq-clinic','derma-circles-delhi','reniu-clinic');
SELECT l.id,l."clinicId",l."branchName",l.slug,l.status,l."deletedAt"
FROM public."ClinicLocation" l JOIN public."Clinic" c ON c.id=l."clinicId"
WHERE c.slug='yavana-skin-hair-clinic';
