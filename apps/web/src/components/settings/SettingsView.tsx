import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { Palette, User, Bot, Info, type LucideIcon } from 'lucide-react';

type Section = 'appearance' | 'account' | 'agents' | 'about';

interface SettingsSection {
  id: Section;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: SettingsSection[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account',    label: 'Account',    icon: User },
  { id: 'agents',     label: 'Agents',     icon: Bot },
  { id: 'about',      label: 'About',      icon: Info },
];

export function SettingsView() {
  const [active, setActive] = useState<Section>('appearance');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'shrink-0 border-r border-border bg-bg-panel',
          'w-56 p-4',
          'max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:w-64',
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
          'max-md:transition-transform max-md:duration-200',
        )}
      >
        <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-text-3">
          Settings
        </h2>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActive(s.id); setMobileOpen(false); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer',
                active === s.id
                  ? 'bg-accent-dim text-accent font-medium'
                  : 'text-text-2 hover:bg-bg-hover hover:text-text-1',
              )}
            >
              <s.icon size={16} />
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Detail pane */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        {/* Mobile menu button */}
        <button
          className="mb-4 text-sm text-text-2 hover:text-text-1 md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          ☰ Settings
        </button>

        <div className="mx-auto max-w-xl">
          {active === 'appearance' && <AppearanceSection />}
          {active === 'account' && <AccountSection />}
          {active === 'agents' && <AgentsSection />}
          {active === 'about' && <AboutSection />}
        </div>
      </main>
    </div>
  );
}

/* ─── Appearance ─────────────────────────────────────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: 'light' | 'dark' | 'system'; label: string; desc: string }> = [
    { value: 'light',  label: 'Light',  desc: 'Clean bright interface' },
    { value: 'dark',   label: 'Dark',   desc: 'Easy on the eyes' },
    { value: 'system', label: 'System', desc: 'Follow OS preference' },
  ];

  return (
    <section>
      <SectionHeader title="Appearance" subtitle="Customize how Magically looks" />

      <SettingsCard>
        <CardLabel>Theme</CardLabel>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition-all cursor-pointer',
                theme === o.value
                  ? 'border-accent bg-accent-dim'
                  : 'border-border hover:border-text-3',
              )}
            >
              <ThemePreview mode={o.value} />
              <span className="text-sm font-medium text-text-1">{o.label}</span>
              <span className="text-[11px] text-text-3">{o.desc}</span>
            </button>
          ))}
        </div>
      </SettingsCard>
    </section>
  );
}

function ThemePreview({ mode }: { mode: 'light' | 'dark' | 'system' }) {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div
      className={cn(
        'h-16 w-full rounded-lg border',
        isDark
          ? 'border-white/10 bg-[#0a0a0b]'
          : 'border-black/10 bg-[#fafafa]',
      )}
    >
      <div className="flex h-full items-end gap-1 p-2">
        <div className={cn('h-2 w-6 rounded-full', isDark ? 'bg-white/20' : 'bg-black/15')} />
        <div className={cn('h-3 w-4 rounded-full', isDark ? 'bg-violet-400/40' : 'bg-violet-500/30')} />
        <div className={cn('h-1.5 w-8 rounded-full', isDark ? 'bg-white/10' : 'bg-black/10')} />
      </div>
    </div>
  );
}

/* ─── Account ────────────────────────────────────────────────────────────── */

function AccountSection() {
  return (
    <section>
      <SectionHeader title="Account" subtitle="Manage your account settings" />
      <SettingsCard>
        <CardLabel>Profile</CardLabel>
        <p className="mt-1 text-sm text-text-3">Account management coming soon.</p>
      </SettingsCard>
    </section>
  );
}

/* ─── Agents ─────────────────────────────────────────────────────────────── */

function AgentsSection() {
  return (
    <section>
      <SectionHeader title="Agents" subtitle="Configure agent behavior and schedules" />
      <SettingsCard>
        <CardLabel>Agent Settings</CardLabel>
        <p className="mt-1 text-sm text-text-3">Agent configuration coming soon.</p>
      </SettingsCard>
    </section>
  );
}

/* ─── About ──────────────────────────────────────────────────────────────── */

function AboutSection() {
  return (
    <section>
      <SectionHeader title="About" subtitle="Magically — your personal Agent OS" />
      <SettingsCard>
        <CardLabel>Version</CardLabel>
        <p className="mt-1 text-sm text-text-2">0.1.0</p>
      </SettingsCard>
    </section>
  );
}

/* ─── Shared UI ──────────────────────────────────────────────────────────── */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-text-1">{title}</h1>
      <p className="mt-1 text-sm text-text-3">{subtitle}</p>
    </div>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-bg-card p-5">
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-text-2">{children}</h3>;
}
