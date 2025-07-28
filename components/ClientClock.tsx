'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

export function ClientClock() {
  const [time, setTime] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString())
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span>--:--:--</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4" />
      <span>{time}</span>
    </div>
  )
}