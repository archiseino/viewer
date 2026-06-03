'use client'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface BookCardProps {
  title: string
  author: string
  progress?: number
  badge?: string
  coverColor?: string
  onClick?: () => void
  className?: string
}

const coverGradients = [
  'from-purple-600 to-pink-500',
  'from-blue-600 to-cyan-500',
  'from-orange-600 to-red-500',
  'from-emerald-600 to-teal-500',
  'from-indigo-600 to-purple-500',
  'from-rose-600 to-pink-400',
  'from-amber-600 to-yellow-500',
  'from-sky-600 to-indigo-500',
  'from-lime-600 to-emerald-500',
  'from-fuchsia-600 to-rose-500',
]

export function BookCard({
  title,
  author,
  progress,
  badge,
  coverColor,
  onClick,
  className,
}: BookCardProps) {
  const gradient = coverColor ?? coverGradients[Math.abs(title.length) % coverGradients.length]

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-[160px] shrink-0 flex-col gap-2 text-left transition-all hover:-translate-y-0.5',
        className
      )}
    >
      {/* Cover */}
      <div
        className={cn(
          'relative flex h-[220px] w-full items-end overflow-hidden rounded-xl bg-gradient-to-br shadow-md transition-shadow group-hover:shadow-lg',
          gradient
        )}
      >
        {/* Badge */}
        {badge && (
          <span
            className={cn(
              'absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              badge === 'Done'
                ? 'bg-emerald-500/90 text-white'
                : 'bg-background/80 text-foreground backdrop-blur-sm'
            )}
          >
            {badge}
          </span>
        )}

        {/* Bottom fade for title read */}
        <div className='w-full bg-gradient-to-t from-black/40 to-transparent p-3 pt-8'>
          {progress != null && (
            <div className='flex items-center gap-2'>
              <Progress
                value={progress}
                className='h-1 flex-1 [&>div]:bg-white/80'
              />
              <span className='text-[11px] font-medium text-white/90'>
                {progress}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className='space-y-0.5 px-0.5'>
        <p className='truncate text-sm font-medium'>{title}</p>
        <p className='truncate text-xs text-muted-foreground'>{author}</p>
      </div>
    </button>
  )
}
