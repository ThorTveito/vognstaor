"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock as ClockComponent } from "@/components/ui/clock"
import { Clock, Bus, MapPin } from "lucide-react"

export default function BusDepartureDisplayV8() {
  const [isSetup, setIsSetup] = useState(true)
  const [isSelectingLines, setIsSelectingLines] = useState(false)
  const [availableLines, setAvailableLines] = useState([])
  const [selectedLines, setSelectedLines] = useState([])
  const [stopPlaceId, setStopPlaceId] = useState("")
  const [stopName, setStopName] = useState("")
  const [departures, setDepartures] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState(null)
  const [departureCount, setDepartureCount] = useState(2)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === "S") {
        event.preventDefault()
        setIsSetup(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const savedStopId = localStorage.getItem("busStopId")
    const savedStopName = localStorage.getItem("busStopName")
    const savedSelectedLines = localStorage.getItem("selectedLines")
    const savedDepartureCount = localStorage.getItem("departureCount")

    if (savedStopId && savedStopName && savedSelectedLines) {
      setStopPlaceId(savedStopId)
      setStopName(savedStopName)
      setSelectedLines(JSON.parse(savedSelectedLines))
      setIsSetup(false)
      fetchDepartures(savedStopId, JSON.parse(savedSelectedLines))
    }

    if (savedDepartureCount) {
      setDepartureCount(Number.parseInt(savedDepartureCount))
    }
  }, [])

  useEffect(() => {
    if (!isSetup && !isSelectingLines && stopPlaceId && selectedLines.length > 0) {
      fetchDepartures(stopPlaceId, selectedLines)

      const interval = setInterval(() => {
        fetchDepartures(stopPlaceId, selectedLines)
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [isSetup, isSelectingLines, stopPlaceId, selectedLines])

  const fetchDepartures = async (stopId, linesToShow) => {
    setLoading(true)
    setError("")

    const query = `
      query GetDepartures($stopPlaceId: String!) {
        stopPlace(id: $stopPlaceId) {
          id
          name
          estimatedCalls(numberOfDepartures: 50) {
            realtime
            expectedDepartureTime
            aimedDepartureTime
            destinationDisplay {
              frontText
            }
            serviceJourney {
              line {
                publicCode
                name
                transportMode
              }
            }
            situations {
              summary {
                value
              }
            }
          }
        }
      }
    `

    try {
      const response = await fetch("https://api.entur.io/journey-planner/v3/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ET-Client-Name": "busdisplay-v8",
        },
        body: JSON.stringify({
          query,
          variables: { stopPlaceId: stopId },
        }),
      })

      const data = await response.json()

      if (data.errors) {
        throw new Error(data.errors[0].message)
      }

      if (!data.data.stopPlace) {
        throw new Error("Stop place not found")
      }

      const stopPlace = data.data.stopPlace
      const formattedDepartures = stopPlace.estimatedCalls.map((call) => ({
        line: call.serviceJourney.line,
        destinationDisplay: call.destinationDisplay,
        expectedDepartureTime: call.expectedDepartureTime,
        aimedDepartureTime: call.aimedDepartureTime,
        realtime: call.realtime,
        situations: call.situations || [],
      }))

      if (!linesToShow) {
        const uniqueLines = new Map()

        formattedDepartures.forEach((departure) => {
          const key = `${departure.line.publicCode}-${departure.destinationDisplay.frontText}`
          if (!uniqueLines.has(key)) {
            uniqueLines.set(key, {
              publicCode: departure.line.publicCode,
              name: departure.line.name,
              destination: departure.destinationDisplay.frontText,
            })
          }
        })

        setAvailableLines(Array.from(uniqueLines.values()))
        return
      }

      const groupedDepartures = new Map()

      formattedDepartures.forEach((departure) => {
        const now = new Date()
        const departureTime = new Date(departure.expectedDepartureTime)

        if (departureTime < now) return

        const key = `${departure.line.publicCode}-${departure.destinationDisplay.frontText}`

        if (linesToShow && !linesToShow.includes(key)) return

        if (!groupedDepartures.has(key)) {
          groupedDepartures.set(key, [])
        }

        const group = groupedDepartures.get(key)
        if (group.length < departureCount) {
          group.push(departure)
        }
      })

      const departureGroups = Array.from(groupedDepartures.entries())
        .map(([key, departures]) => ({ key, departures }))
        .sort(
          (a, b) =>
            new Date(a.departures[0].expectedDepartureTime).getTime() -
            new Date(b.departures[0].expectedDepartureTime).getTime(),
        )

      setDepartures(departureGroups)
      setStopName(stopPlace.name)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch departures")
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    if (!stopPlaceId.trim()) {
      setError("Please enter a stop place ID")
      return
    }

    await fetchDepartures(stopPlaceId.trim())

    if (!error && availableLines.length > 0) {
      setIsSelectingLines(true)
    }
  }

  const handleLineSelection = () => {
    if (selectedLines.length === 0) {
      setError("Please select at least one line")
      return
    }

    localStorage.setItem("busStopId", stopPlaceId.trim())
    localStorage.setItem("busStopName", stopName)
    localStorage.setItem("selectedLines", JSON.stringify(selectedLines))
    localStorage.setItem("departureCount", departureCount.toString())

    setIsSetup(false)
    setIsSelectingLines(false)
    fetchDepartures(stopPlaceId.trim(), selectedLines)
  }

  const toggleLineSelection = (lineKey) => {
    setSelectedLines((prev) => (prev.includes(lineKey) ? prev.filter((key) => key !== lineKey) : [...prev, lineKey]))
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getMinutesUntil = (dateString) => {
    const now = new Date()
    const departure = new Date(dateString)
    const minutes = Math.round((departure.getTime() - now.getTime()) / 60000)
    return minutes
  }

  const isDelayed = (expectedTime, aimedTime) => {
    const expected = new Date(expectedTime)
    const aimed = new Date(aimedTime)
    return expected.getTime() > aimed.getTime()
  }

  if (isSelectingLines) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-4xl shadow-xl border border-border">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <Bus className="w-6 h-6" />
              Velg linjer å vise
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {availableLines.map((line) => {
                const lineKey = `${line.publicCode}-${line.destination}`
                return (
                  <div
                    key={lineKey}
                    className="flex items-center space-x-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => toggleLineSelection(lineKey)}
                  >
                    <Checkbox
                      id={lineKey}
                      checked={selectedLines.includes(lineKey)}
                      onCheckedChange={() => toggleLineSelection(lineKey)}
                    />
                    <Badge className="font-bold text-lg px-3 py-1 bg-primary text-primary-foreground">
                      {line.publicCode}
                    </Badge>
                    <div>
                      <p className="font-semibold text-lg">{line.destination}</p>
                      <p className="text-sm text-muted-foreground">{line.name}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsSelectingLines(false)} className="flex-1">
                Tilbake
              </Button>
              <Button
                onClick={handleLineSelection}
                disabled={selectedLines.length === 0}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Start visning ({selectedLines.length} valgt)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl border border-border">
          <CardHeader className="bg-primary text-primary-foreground text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Bus className="w-8 h-8" />
              <div className="text-2xl font-bold">TRANSIT V8</div>
            </div>
            <CardTitle className="text-lg">Sanntidstavle oppsett</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Holdeplass ID
              </label>
              <Input
                value={stopPlaceId}
                onChange={(e) => setStopPlaceId(e.target.value)}
                placeholder="f.eks. NSR:StopPlace:58366"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">Finn holdeplass-ID på entur.no</p>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Antall avganger per linje
              </label>
              <Input
                type="number"
                min="1"
                max="8"
                value={departureCount}
                onChange={(e) => setDepartureCount(Number.parseInt(e.target.value) || 2)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">Hvor mange avganger som skal vises per linje</p>
            </div>

            {error && (
              <div className="text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button onClick={handleSetup} disabled={loading} className="w-full bg-primary hover:bg-primary/90">
              {loading ? "Laster..." : "Start sanntidstavle"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Bus className="w-10 h-10" />
              <div>
                <div className="text-3xl font-bold">Avganger</div>
                <h1 className="text-xl font-semibold">{stopName}</h1>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <ClockComponent className="text-primary-foreground" />
              {lastUpdated && (
                <div className="flex items-center gap-2 text-sm opacity-80">
                  <Clock className="w-4 h-4" />
                  Sist oppdatert: {lastUpdated.toLocaleTimeString("no-NO")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading && departures.length === 0 ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground text-lg">Laster avganger...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-destructive mb-4 text-lg">{error}</p>
            <Button
              onClick={() => fetchDepartures(stopPlaceId, selectedLines)}
              className="bg-primary hover:bg-primary/90"
            >
              Prøv igjen
            </Button>
          </div>
        ) : departures.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">Ingen avganger funnet</p>
          </div>
        ) : (
          <div
            className={
              departures.length === 1
                ? "max-w-2xl mx-auto"
                : departures.length === 2
                  ? "grid grid-cols-2 gap-8 max-w-6xl mx-auto"
                  : "space-y-4"
            }
          >
            {departures.map((group) => {
              const allDepartures = group.departures
              const validDepartures = allDepartures.filter((dep) => getMinutesUntil(dep.expectedDepartureTime) >= 0)

              if (validDepartures.length === 0) return null

              const [primaryDeparture, ...otherDepartures] = validDepartures
              const primaryMinutes = getMinutesUntil(primaryDeparture.expectedDepartureTime)

              return (
                <Card key={group.key} className="shadow-lg border border-border">
                  <CardContent className={`p-6 ${departures.length <= 2 ? "text-center" : ""}`}>
                    {departures.length === 1 ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Badge className="font-bold text-3xl px-6 py-3 bg-primary text-primary-foreground">
                            {primaryDeparture.line.publicCode}
                          </Badge>
                          <p className="font-bold text-4xl">{primaryDeparture.destinationDisplay.frontText}</p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div
                              className={`font-black text-8xl ${primaryMinutes <= 2 ? "text-destructive animate-pulse" : ""}`}
                            >
                              {primaryMinutes === 0 ? "NÅ" : primaryMinutes === 1 ? "1 min" : `${primaryMinutes} min`}
                            </div>
                            <div className="text-muted-foreground text-2xl mt-2 flex items-center justify-center gap-3">
                              {isDelayed(
                                primaryDeparture.expectedDepartureTime,
                                primaryDeparture.aimedDepartureTime,
                              ) && (
                                <span className="line-through text-destructive/70">
                                  {formatTime(primaryDeparture.aimedDepartureTime)}
                                </span>
                              )}
                              <span
                                className={
                                  isDelayed(primaryDeparture.expectedDepartureTime, primaryDeparture.aimedDepartureTime)
                                    ? "text-destructive font-bold"
                                    : ""
                                }
                              >
                                {formatTime(primaryDeparture.expectedDepartureTime)}
                              </span>
                            </div>
                          </div>

                          {otherDepartures.map((departure, index) => {
                            const minutes = getMinutesUntil(departure.expectedDepartureTime)
                            if (minutes < 0) return null

                            return (
                              <div key={index} className="text-muted-foreground">
                                <div className="font-bold text-4xl">{formatTime(departure.expectedDepartureTime)}</div>
                                {isDelayed(departure.expectedDepartureTime, departure.aimedDepartureTime) && (
                                  <div className="text-lg line-through text-destructive/70 mt-1">
                                    {formatTime(departure.aimedDepartureTime)}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : departures.length === 2 ? (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Badge className="font-bold text-2xl px-5 py-2 bg-primary text-primary-foreground">
                            {primaryDeparture.line.publicCode}
                          </Badge>
                          <p className="font-bold text-3xl">{primaryDeparture.destinationDisplay.frontText}</p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div
                              className={`font-black text-6xl ${primaryMinutes <= 2 ? "text-destructive animate-pulse" : ""}`}
                            >
                              {primaryMinutes === 0 ? "NÅ" : primaryMinutes === 1 ? "1 min" : `${primaryMinutes} min`}
                            </div>
                            <div className="text-muted-foreground text-xl mt-2 flex items-center justify-center gap-2">
                              {isDelayed(
                                primaryDeparture.expectedDepartureTime,
                                primaryDeparture.aimedDepartureTime,
                              ) && (
                                <span className="line-through text-destructive/70">
                                  {formatTime(primaryDeparture.aimedDepartureTime)}
                                </span>
                              )}
                              <span
                                className={
                                  isDelayed(primaryDeparture.expectedDepartureTime, primaryDeparture.aimedDepartureTime)
                                    ? "text-destructive font-bold"
                                    : ""
                                }
                              >
                                {formatTime(primaryDeparture.expectedDepartureTime)}
                              </span>
                            </div>
                          </div>

                          {otherDepartures.map((departure, index) => {
                            const minutes = getMinutesUntil(departure.expectedDepartureTime)
                            if (minutes < 0) return null

                            return (
                              <div key={index} className="text-muted-foreground">
                                <div className="font-bold text-3xl">{formatTime(departure.expectedDepartureTime)}</div>
                                {isDelayed(departure.expectedDepartureTime, departure.aimedDepartureTime) && (
                                  <div className="text-base line-through text-destructive/70 mt-1">
                                    {formatTime(departure.aimedDepartureTime)}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Badge className="font-bold text-xl px-4 py-2 bg-primary text-primary-foreground">
                            {primaryDeparture.line.publicCode}
                          </Badge>
                          <p className="font-bold text-xl">{primaryDeparture.destinationDisplay.frontText}</p>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div
                              className={`font-black text-4xl ${primaryMinutes <= 2 ? "text-destructive animate-pulse" : ""}`}
                            >
                              {primaryMinutes === 0 ? "NÅ" : primaryMinutes === 1 ? "1 min" : `${primaryMinutes} min`}
                            </div>
                            <div className="text-muted-foreground text-base mt-1 flex items-center gap-2">
                              {isDelayed(
                                primaryDeparture.expectedDepartureTime,
                                primaryDeparture.aimedDepartureTime,
                              ) && (
                                <span className="line-through text-destructive/70">
                                  {formatTime(primaryDeparture.aimedDepartureTime)}
                                </span>
                              )}
                              <span
                                className={
                                  isDelayed(primaryDeparture.expectedDepartureTime, primaryDeparture.aimedDepartureTime)
                                    ? "text-destructive font-bold"
                                    : ""
                                }
                              >
                                {formatTime(primaryDeparture.expectedDepartureTime)}
                              </span>
                            </div>
                          </div>

                          {otherDepartures.map((departure, index) => {
                            const minutes = getMinutesUntil(departure.expectedDepartureTime)
                            if (minutes < 0) return null

                            return (
                              <div key={index} className="text-muted-foreground text-right">
                                <div className="font-bold text-2xl">{formatTime(departure.expectedDepartureTime)}</div>
                                {isDelayed(departure.expectedDepartureTime, departure.aimedDepartureTime) && (
                                  <div className="text-sm line-through text-destructive/70 mt-1">
                                    {formatTime(departure.aimedDepartureTime)}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {primaryDeparture.situations.length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600">
                        {primaryDeparture.situations[0].summary?.value?.trim()
                          ? primaryDeparture.situations[0].summary.value
                          : "Avik på denne avgangen. Sjekk ATB for mer informasjon."}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
