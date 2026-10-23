<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisões técnicas
- Cargo operacional e setor ficam em `memberships`, acesso admin em `admin_access_grants` — nunca no perfil, para impedir autopromoção.
- Mudanças de cargo/setor/convites passam por server functions (`src/lib/members.functions.ts`) que checam `is_captain` (área operacional) ou `is_admin` (painel /admin) antes de usar o cliente admin; ambas gravam `audit_log` com `area`.
- `is_admin` nunca é usado em políticas operacionais: admin só tem poderes dentro de /admin.
- Cadastro público desativado; contas entram só por convite. O primeiro admin é concedido por inserção direta em `admin_access_grants` feita pelo dono do projeto (sem senha mestra).
- Datas: instantes em UTC, exibição em America/Sao_Paulo via `src/lib/format.ts`.
- Regras puras de permissão em `src/lib/permissions.ts`, testadas em `src/test/`.
- Task mutations use an authenticated server function calling the transactional task_command RPC; row locks enforce capacity and shared-sector authority without administrative bypass.
- Task reads use RLS-scoped Query options and leaf route loaders; dependencies, participants, collaboration decisions and execution history remain separate records to preserve auditability.
- Task files live in private task-files storage with task-ID paths and database-validated read/write authority, so attachments follow the same operational permissions.
- Agenda mutations use an authenticated server function calling agenda_command; database authorization, row locks and audit records enforce operational roles without administrative bypass.
- Agenda events, individual invitations/responses, history and private minutes attachments are separate records; recurring meetings materialize distinct occurrences so decisions and responses stay per-event.
- Agenda reads use RLS-scoped Query options under authenticated routes; pending proposals send information only and cannot accept participation responses before approval.
- Attendance changes use an authenticated attendance_command RPC with event locks and operational authorization; current records and private per-person history remain separate from invitation responses.
- Attendance summaries use RLS-scoped records and count only enabled, actual convocations with present or absent status; disabling a call never deletes its records.
- Test mutations use the authenticated test_command RPC and separate session records linked to agenda events; checklist versions and acknowledgments preserve safety evidence and operational authority without admin bypass.
- Tests have dedicated authenticated list/detail routes; agenda entries link to the test sheet rather than exposing generic event lifecycle controls, preventing contradictory session states.
- Test measurements are immutable per-session records validated by an authenticated transactional RPC; missing cells remain null and comparisons require matching column names and units.
- Test document revisions store server-created immutable snapshots and generate paginated PDFs client-side; downloads of old revisions never read current mutable test data.
