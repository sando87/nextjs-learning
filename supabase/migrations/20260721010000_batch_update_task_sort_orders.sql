-- 다수 업무의 sort_order를 한 번의 UPDATE로 갱신 (RLS는 invoker 기준)
create or replace function public.batch_update_task_sort_orders(updates jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  update public.tasks t
  set
    sort_order = (u->>'sort_order')::int,
    updated_at = now()
  from jsonb_array_elements(updates) as u
  where t.id = (u->>'id')::uuid;
end;
$$;

grant execute on function public.batch_update_task_sort_orders(jsonb) to authenticated;
grant execute on function public.batch_update_task_sort_orders(jsonb) to service_role;
