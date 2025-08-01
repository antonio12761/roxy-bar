"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, indeterminate, ...props }, ref) => {
    const isChecked = props.checked || false;
    const displayState = indeterminate ? 'indeterminate' : isChecked ? 'checked' : 'unchecked';
    
    return (
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          ref={ref}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={indeterminate ? 'mixed' : props.checked}
          onClick={() => {
            if (!props.disabled) {
              onCheckedChange?.(!props.checked)
            }
          }}
          className={cn(
            "peer h-5 w-5 shrink-0 rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          style={{
            backgroundColor: displayState !== 'unchecked' 
              ? (indeterminate ? 'var(--accent, #f59e0b)' : 'var(--primary, #22c55e)') 
              : 'transparent',
            borderColor: displayState !== 'unchecked' 
              ? (indeterminate ? 'var(--accent, #f59e0b)' : 'var(--primary, #22c55e)') 
              : 'var(--primary, #22c55e)',
            color: displayState !== 'unchecked' ? 'white' : 'transparent',
            ...(props.style as React.CSSProperties)
          }}
          disabled={props.disabled}
        >
          {displayState === 'checked' && (
            <div className="flex items-center justify-center text-current">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
          )}
          {displayState === 'indeterminate' && (
            <div className="flex items-center justify-center text-current">
              <Minus className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
          )}
        </button>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }