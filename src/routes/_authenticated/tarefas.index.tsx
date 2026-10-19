import { createFileRoute } from '@tanstack/react-router';
import { TasksPage } from '@/components/TasksPage';
import { tasksQuery, flagsQuery, pageHead } from '@/lib/tasks';
export const Route = createFileRoute('/_authenticated/tarefas/')({ head: () => pageHead('Tarefas oficiais', 'Atividades, responsáveis e prazos da equipe Aerodesign.'), loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(tasksQuery), context.queryClient.ensureQueryData(flagsQuery)]), component: () => <TasksPage kind="official" /> });