# App Aerodesign — Plano de construção em blocos

A especificação cobre mais de 20 módulos com permissões finas. Para entregar tudo de forma real (sem telas de fachada), a construção será feita em blocos verificáveis. Cada bloco termina testado com usuários de cargos diferentes.

## Bloco 1 — Fundação (esta etapa)
- Ativar Lovable Cloud (banco, login, arquivos).
- Identidade visual aeroespacial, limpa, em pt-BR, celular e computador; nome/logo configuráveis.
- Login por e-mail e senha, sem cadastro público: acesso só por convite. Recuperação de senha e logout.
- Perfis: foto, nome, nascimento, ingresso, cargo (trainee/membro/gerente/capitão), um setor, ativo/inativo.
- Os 8 setores fixos; no máximo 1 gerente ativo por setor (regra no banco).
- Acesso de administrador separado (botão "Painel de administração" -> /admin), sem poderes operacionais extras; procedimento protegido para o primeiro administrador.
- Gestão de integrantes (capitão e admin): convidar, desativar, mudar cargo/setor, com histórico.
- Chaves globais de módulos, data da competição (capitão) e contagem regressiva.
- Dashboard inicial com dados reais (sem números inventados).
- Trilha de auditoria.

## Bloco 2 — Operação
Tarefas oficiais (subtarefas, dependências, convites intersetoriais, tarefas compartilhadas, reabertura), tarefas voluntárias, central de solicitações e aprovações, notificações no app.

## Bloco 3 — Agenda
Eventos, reuniões (internas e entre setores), chamada e assiduidade (justificativas, dispensas), testes/ensaios (normal com aprovação, rápido sem aprovação, checklist de segurança).

## Bloco 4 — Técnico
Dados da aeronave com versões ("Pendente", nunca zero), Diário de Voo independente, fabricação, problemas e não conformidades, memória técnica e formação.

## Bloco 5 — Equipe e finanças
Compras (interesse compartilhado sem duplicar aprovações), mural unificado, sugestões com anonimato forte, Marketing (apenas recursos aprovados), patrocínios, mensalidades (titular, gerente do Financeiro e capitão).

## Bloco 6 — Documentos e instalação
PDFs (documento de teste, ficha individual, relatórios por setor), instalação no celular, testes finais de permissão.

## Fora do escopo
Tudo listado na seção 26 da especificação não será criado.

## Detalhes técnicos
- Regras de acesso no banco (RLS em todas as tabelas) e verificação no servidor; funções de cargo com security definer; cargos e admin em tabelas separadas do perfil.
- Datas em UTC, exibidas em America/Sao_Paulo (dd/MM/yyyy HH:mm), moeda BRL.
- Arquivamento lógico (archived_at) em vez de exclusão; anexos em armazenamento privado.
- Decisões técnicas registradas no AGENTS.md.
