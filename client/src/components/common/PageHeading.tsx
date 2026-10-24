import type { ReactNode } from 'react';

export function PageHeading({ title, description, eyebrow, actions }: {
  title: string; description: string; eyebrow?: string; actions?: ReactNode;
}) {
  return <div className="page-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>;
}
