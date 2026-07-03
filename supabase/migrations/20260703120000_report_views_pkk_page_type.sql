-- Tillat lagring av personlige PKK-visninger i user_report_views.

alter type public.page_type add value if not exists 'pkk';
