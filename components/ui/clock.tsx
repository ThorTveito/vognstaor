"use client"

import { useState, useEffect } from "react"

interface ClockProps {
  className?: string
  format24?: boolean
  showSeconds?: boolean
}

export function Clock({ className = "", format24 = true, showSeconds = true }: ClockProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      ...(showSeconds && { second: "2-digit" }),
      hour12: !format24,
    }
    
    return date.toLocaleTimeString("en-US", options)
  }

  return (
    <div className={`${className}`}>
      <div className="text-3xl font-bold tracking-wider">
        {formatTime(time)}
      </div>
    </div>
  )
}
