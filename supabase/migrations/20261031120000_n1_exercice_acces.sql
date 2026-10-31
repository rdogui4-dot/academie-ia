-- Autorise les apprenants à lire uniquement l'exercice apprenant N1.
-- Le corrigé formateur n'est pas dans le stockage et reste inaccessible.
begin;
drop policy if exists academy_no_original_downloads on storage.objects;
create policy academy_no_original_downloads on storage.objects as restrictive for select to anon,authenticated using(
 bucket_id<>'academy-private' or name ~ '^n[1-4]/(course[.]json|pages/[0-9]{3}[.](webp|txt)|exercice/exercice-apprenant[.]html)$');
commit;
