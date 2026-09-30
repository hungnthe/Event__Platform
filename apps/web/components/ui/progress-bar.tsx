import { clampProgress } from '../../lib/event-ui';

export function ProgressBar({ value, label }: Readonly<{ value: number; label: string }>) {
  const percentage = clampProgress(value);
  return <div className="w-full" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${percentage}%`}><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none" style={{ width: `${percentage}%` }} /></div></div>;
}
