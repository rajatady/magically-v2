import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '~/lib/auth';
import { Shell } from '~/components/shell/Shell';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Shell />;
}
