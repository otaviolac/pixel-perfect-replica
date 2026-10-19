import { createFileRoute } from '@tanstack/react-router';
import { TasksPage } from '@/components/TasksPage';
import { tasksQuery, flagsQuery, pageHead } from '@/lib/tasks';
export const Route = createFileRoute('/_authenticated/voluntarias')({ head: () => pageHead('Voluntárias', 'Oportunidades de colaboração voluntária na equipe Aerodesign.'), loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(tasksQuery), context.queryClient.ensureQueryData(flagsQuery)]), component: () => <TasksPage kind="voluntary" /> });