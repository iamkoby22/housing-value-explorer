import type { AnchorHTMLAttributes, ReactNode } from 'react';

type StaticLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

export function StaticLink({ children, href, ...props }: StaticLinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
