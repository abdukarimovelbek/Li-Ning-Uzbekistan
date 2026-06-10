# MBR · Настройка Supabase

Пошаговая инструкция: как развернуть таблицы, политики безопасности (RLS),
realtime и завести учётные записи для семи пользователей.

> Использовать тот же проект Supabase, что и основной сайт каталога
> (`https://dgyirginrefvjsbhhooi.supabase.co`). Создаются отдельные таблицы
> с префиксом `mbr_` — на основной сайт это никак не влияет.

---

## 1. Создать таблицы и политики (RLS)

Зайдите в Supabase Dashboard → **SQL Editor → + New query**, вставьте
блок ниже и нажмите **Run**.

```sql
-- ============================================================
-- MBR · схема, RLS, realtime
-- ============================================================

-- 1) profiles: расширение auth.users (ФИО + роль)
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  full_name     text not null,
  role          text not null
                check (role in ('director','product_manager','hr','warehouse','marketing','admin')),
  director_slot int check (director_slot between 1 and 3),
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id);

-- Авто-создание профиля при регистрации пользователя
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'admin'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Периоды (Май 2026, Июнь 2026 …)
create table if not exists public.mbr_periods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_current boolean not null default false,
  created_at timestamptz default now()
);

alter table public.mbr_periods enable row level security;

drop policy if exists periods_read on public.mbr_periods;
create policy periods_read on public.mbr_periods
  for select using (auth.role() = 'authenticated');

drop policy if exists periods_write_admin on public.mbr_periods;
create policy periods_write_admin on public.mbr_periods
  for all
  using     (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 3) Данные по секциям (одна строка = одна секция в одном периоде)
create table if not exists public.mbr_data (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references public.mbr_periods on delete cascade,
  section     text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now(),
  updated_by  uuid references public.profiles,
  unique (period_id, section)
);

alter table public.mbr_data enable row level security;

drop policy if exists data_read on public.mbr_data;
create policy data_read on public.mbr_data
  for select using (auth.role() = 'authenticated');

-- Проверка прав на редактирование секции по роли пользователя
create or replace function public.can_edit_section(p_section text)
returns boolean language plpgsql security definer as $$
declare r text; s int;
begin
  select role, director_slot into r, s from public.profiles where id = auth.uid();
  if r is null then return false; end if;
  if r = 'admin' then return true; end if;
  case
    when p_section = 'meta'        then return false; -- редактирует только admin
    when p_section = 'director_1'  then return r = 'director' and s = 1;
    when p_section = 'director_2'  then return r = 'director' and s = 2;
    when p_section = 'director_3'  then return r = 'director' and s = 3;
    when p_section = 'product'     then return r = 'product_manager';
    when p_section = 'hr'          then return r = 'hr';
    when p_section = 'warehouse'   then return r = 'warehouse';
    when p_section = 'marketing'   then return r = 'marketing';
    else return false;
  end case;
end $$;

drop policy if exists data_insert on public.mbr_data;
create policy data_insert on public.mbr_data
  for insert with check (public.can_edit_section(section));

drop policy if exists data_update on public.mbr_data;
create policy data_update on public.mbr_data
  for update using (public.can_edit_section(section));

-- 4) Включить Realtime (mbr.html будет получать live-обновления)
alter publication supabase_realtime add table public.mbr_data;
alter publication supabase_realtime add table public.mbr_periods;
```

---

## 2. Создать первый период и заполнить шаблон данными

Запустите вторым отдельным запросом:

```sql
-- Текущий период
insert into public.mbr_periods (name, is_current) values ('Июнь 2026', true)
on conflict do nothing;

-- Шаблоны для всех секций (пустые значения, заполнят пользователи через mbr-editor.html)
with p as (select id from public.mbr_periods where is_current limit 1)
insert into public.mbr_data (period_id, section, data)
select p.id, x.section, x.data::jsonb from p, (values
  ('meta', '{
    "period":"Июнь 2026",
    "regions":[
      {"name":"Ташкент","count":11},
      {"name":"Самарканд","count":2},
      {"name":"Андижан","count":1}
    ],
    "summary":{"totalStores":14,"totalRegions":3,"note":"Заполните секции в личном кабинете → mbr-editor.html"}
  }'),
  ('director_1', '{
    "name":"Бобур Алиев","role":"Региональный директор","region":"Ташкент-Центр","photo":"",
    "stores":[
      {"name":"Compass · Чиланзар","mall":"ТРЦ Compass","status":"green","planPercent":104,
       "revenue":{"value":"1.82","unit":"млрд сум","mom":12,"yoy":24},
       "pairs":{"value":5290,"mom":9},"tx":{"value":2940,"mom":6},
       "avg":{"value":"619","unit":"тыс","mom":3},
       "upt":1.8,"conversion":31,"returns":2.1,"spe":{"value":"228","unit":"млн"},
       "trend":[38,44,41,62,70,88],"trendPy":[30,36,34,40,48,55],
       "weeks":[[60,80],[58,72],[78,90],[72,64]],
       "traffic":{"план":"green","трафик":"green","конверсия":"yellow","средний чек":"green","возвраты":"green","персонал":"yellow"}}
    ]
  }'),
  ('director_2', '{"name":"Дилшод Каримов","role":"Региональный директор","region":"Ташкент-Юг · Самарканд","photo":"","stores":[]}'),
  ('director_3', '{"name":"Жасур Турсунов","role":"Региональный директор","region":"Ташкент-Север · Андижан","photo":"","stores":[]}'),
  ('product',  '{"topCategories":[],"newSku":0,"topProduct":{"name":"","units":0,"revenue":""},"turnover":0,"notes":""}'),
  ('hr',       '{"headcountPlan":0,"headcountFact":0,"turnover":0,"trained":0,"openVacancies":0,"enps":0,"topTeam":"","notes":""}'),
  ('warehouse','{"stockUnits":0,"stockValue":"","cover30":0,"cover60":0,"cover90":0,"leadTime":0,"writeOffs":"","topShortage":"","notes":""}'),
  ('marketing','{"budget":"","reach":0,"visits":0,"cac":0,"convOnline":0,"bestCampaign":"","socialFollowers":0,"notes":""}')
) as x(section, data)
on conflict (period_id, section) do nothing;
```

---

## 3. Завести пользователей (7 учёток)

### 3.1 Создать аккаунты в Supabase Auth

Dashboard → **Authentication → Users → + Add user → Create new user**.
Заведите 7 пользователей с email и временным паролем (его поменяют сами при первом входе):

| Email                             | Кто                       |
|-----------------------------------|---------------------------|
| `director1@li-ning.uz`            | Региональный директор № 1 |
| `director2@li-ning.uz`            | Региональный директор № 2 |
| `director3@li-ning.uz`            | Региональный директор № 3 |
| `pm@li-ning.uz`                   | Продукт-менеджер          |
| `hr@li-ning.uz`                   | HR-директор               |
| `warehouse@li-ning.uz`            | Управляющий складом       |
| `marketing@li-ning.uz`            | Директор по маркетингу    |
| `admin@li-ning.uz`                | Администратор (вы)        |

### 3.2 Назначить роли

В SQL Editor выполните:

```sql
update public.profiles set role='director',         director_slot=1, full_name='Бобур Алиев'      where email='director1@li-ning.uz';
update public.profiles set role='director',         director_slot=2, full_name='Дилшод Каримов'   where email='director2@li-ning.uz';
update public.profiles set role='director',         director_slot=3, full_name='Жасур Турсунов'   where email='director3@li-ning.uz';
update public.profiles set role='product_manager',                  full_name='Продукт-менеджер'  where email='pm@li-ning.uz';
update public.profiles set role='hr',                                full_name='HR-директор'      where email='hr@li-ning.uz';
update public.profiles set role='warehouse',                         full_name='Управ. складом'   where email='warehouse@li-ning.uz';
update public.profiles set role='marketing',                         full_name='Маркетинг-директор' where email='marketing@li-ning.uz';
update public.profiles set role='admin',                             full_name='Администратор'    where email='admin@li-ning.uz';
```

> Триггер `handle_new_user` создаёт строку `profiles` автоматически
> при добавлении пользователя в Auth (с ролью `admin` по умолчанию).
> Запросом выше мы переназначаем правильные роли.

---

## 4. Проверить, что всё работает

1. Откройте `mbr-login.html` → войдите под любым из созданных email/паролей.
2. После входа откроется `mbr-editor.html` — там ваша секция с формой.
3. Заполните одно-два поля, нажмите **Сохранить**.
4. В соседней вкладке откройте `mbr.html` → проверьте, что данные
   подтянулись и обновляются в реальном времени, если открыт второй экран.

---

## 5. Безопасность

- Anon-ключ публикуется в HTML/JS — это нормально, **он специально для клиентского кода**.
- Реальная защита данных делается через **RLS-политики** выше — без них anon-ключ был бы небезопасен.
- Каждый пользователь видит **все** секции (это нужно для презентации), но
  может **редактировать** только свою. Это проверяется функцией
  `can_edit_section()` на стороне Postgres — обойти её нельзя.
- Если нужно полностью закрыть просмотр от анонимных пользователей —
  политика `data_read` уже требует `auth.role() = 'authenticated'`,
  то есть без логина данные не видны.

---

## 6. Что добавлять при открытии новых магазинов

При запуске нового магазина (например, второго в Самарканде):

1. Соответствующий региональный директор открывает `mbr-editor.html` → в своей секции жмёт **+ Добавить магазин**.
2. Заполняет поля → **Сохранить**.
3. Карточка появится в общей презентации `mbr.html` автоматически.

---

## 7. Новый отчётный период (через месяц)

Когда наступит июль:

```sql
-- 1) Делаем старый период не текущим
update public.mbr_periods set is_current = false where is_current = true;

-- 2) Создаём новый
insert into public.mbr_periods (name, is_current) values ('Июль 2026', true);

-- 3) Копируем данные предыдущего месяца как стартовый шаблон (опционально)
with src as (
  select id from public.mbr_periods where name = 'Июнь 2026'
), dst as (
  select id from public.mbr_periods where is_current limit 1
)
insert into public.mbr_data (period_id, section, data)
select dst.id, d.section, d.data
from public.mbr_data d, src, dst
where d.period_id = src.id
on conflict (period_id, section) do nothing;
```

После этого все пользователи открывают редактор и обновляют цифры под новый месяц.
