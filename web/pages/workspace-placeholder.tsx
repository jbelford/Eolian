import { Chip } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface WorkspacePlaceholderProps {
  section: 'overview' | 'guilds' | 'account';
}

const sectionCopy = {
  overview: {
    title: 'Your Eolian workspace is warming up.',
    description:
      'Discord sign-in and the authenticated dashboard will land in a later change. This route is ready for that handoff without pretending a session exists.',
  },
  guilds: {
    title: 'Guild controls will live here.',
    description:
      'A later change can connect real guild data, permissions, and server settings to this stable route.',
  },
  account: {
    title: 'Account connections will live here.',
    description:
      'Spotify, SoundCloud, and Discord account state remain intentionally disconnected until the authenticated API contract is available.',
  },
};

export const WorkspacePlaceholder = ({ section }: WorkspacePlaceholderProps) => {
  const copy = sectionCopy[section];

  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-4xl items-center px-5 py-20 sm:px-8">
      <div className="w-full rounded-[2rem] border border-separator bg-surface p-7 shadow-sm sm:p-12">
        <Chip color="accent" variant="soft">
          <Sparkles aria-hidden="true" className="size-4" />
          Authenticated entry point
        </Chip>
        <h1 className="font-display mt-7 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{copy.description}</p>
        <nav aria-label="Workspace placeholders" className="mt-8 flex flex-wrap gap-3">
          <Link className={buttonVariants({ variant: 'secondary' })} to="/app">
            Overview
          </Link>
          <Link className={buttonVariants({ variant: 'secondary' })} to="/app/guilds">
            Guilds
          </Link>
          <Link className={buttonVariants({ variant: 'secondary' })} to="/app/account">
            Account
          </Link>
        </nav>
        <div className="mt-10 border-t border-separator pt-7">
          <Link className="font-semibold text-accent hover:underline" to="/">
            Return to the public site
          </Link>
        </div>
      </div>
    </section>
  );
};
