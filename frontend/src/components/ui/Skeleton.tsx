import { cn } from './cn';

export type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-surface-sunken', className)} />;
}
