-- Slet TEST Padelklub Junior og alle testpersoner (mærket padel_test).
-- Kør hele scriptet i Supabase → SQL Editor (projektet "taskhero"). Vælg "Run without RLS", hvis den spørger.
begin;
create temp table x_g on commit drop as select id from padel_groups where name = 'TEST Padelklub Junior' and kind = 'klub';
create temp table x_u on commit drop as select id from auth.users where raw_app_meta_data->>'padel_test' = 'true';
-- Kun hvis der faktisk er noget at slette
delete from padel_club_posts where group_id in (select id from x_g);
delete from padel_club_kids where group_id in (select id from x_g);          -- fjerner også forældre-koblinger, afbud, fremmøde og kontingent
delete from padel_club_teams where group_id in (select id from x_g);         -- fjerner også træningstider og aflysninger
delete from padel_notifications where user_id in (select id from x_u);
delete from padel_contacts where player_id in (select id from x_u);
delete from padel_group_members where group_id in (select id from x_g) or player_id in (select id from x_u);
delete from padel_group_centers where group_id in (select id from x_g);
delete from padel_groups where id in (select id from x_g);
delete from padel_profiles where id in (select id from x_u);
delete from auth.users where id in (select id from x_u);
commit;
-- Kontrol: skal vise 0 og 0
select (select count(*) from padel_groups where name = 'TEST Padelklub Junior') testklub,
       (select count(*) from auth.users where raw_app_meta_data->>'padel_test' = 'true') testpersoner;
