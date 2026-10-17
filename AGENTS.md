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
