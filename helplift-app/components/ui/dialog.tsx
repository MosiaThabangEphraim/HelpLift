'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeftIcon, Maximize2Icon, Minimize2Icon, XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { clearReturnTo, getReturnTo } from '@/lib/window-return'

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[200] bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  allowMaximize = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Shows a maximize/restore button next to the close button (on by default). */
  allowMaximize?: boolean
}) {
  // Every window opens large (the same size as Settings) and can be
  // maximized to fill the screen. The content unmounts when the window
  // closes, so it always reopens at the normal size.
  const [maximized, setMaximized] = React.useState(false)
  // Opened from another window (e.g. a notification from the Notifications
  // list)? Then offer a way back to it - see lib/window-return.ts.
  const [returnTo] = React.useState(() => getReturnTo())
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[200] grid grid-cols-[minmax(0,1fr)] overflow-x-hidden w-full max-w-[calc(100%-2rem)] max-h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          className,
          // Applied after the window's own classes so every window shares one size.
          'sm:max-w-3xl lg:max-w-5xl max-h-[90vh]',
          // content-start: keep sections stacked at the top instead of the
          // grid spreading them out to fill the full screen height.
          maximized && 'w-screen max-w-none sm:max-w-none lg:max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 content-start',
          // Room above the title for the "Back to ..." link.
          returnTo && 'pt-12',
        )}
        {...props}
      >
        {returnTo && (
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              onClick={() => {
                clearReturnTo()
                // Let this window close before the previous one reopens.
                window.setTimeout(returnTo.reopen, 120)
              }}
              className="absolute top-4 left-6 inline-flex items-center gap-1.5 rounded px-1.5 py-1 -ml-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 [&_svg]:size-3.5"
            >
              <ArrowLeftIcon /> Back to {returnTo.label}
            </button>
          </DialogPrimitive.Close>
        )}
        {children}
        {allowMaximize && (
          <button
            type="button"
            onClick={() => setMaximized(m => !m)}
            aria-label={maximized ? 'Restore size' : 'Maximize'}
            aria-pressed={maximized}
            data-tip={maximized ? 'Restore size' : 'Maximize'}
            className={cn(
              'absolute rounded p-1 text-slate-400 opacity-80 transition-colors hover:bg-slate-100 hover:text-slate-600 hover:opacity-100 dark:hover:bg-[#1A2740] dark:hover:text-slate-300 [&_svg]:size-4',
              // Beside the built-in close button, or left of a window's own header close button.
              showCloseButton ? 'top-3 right-10' : 'top-6 right-14',
            )}
          >
            {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
          </button>
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
