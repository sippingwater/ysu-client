"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmptyState, LoadingCards, ValidatingList } from "@/components/academic/list-state"
import { formatTimeRange } from "@/lib/academic/time"
import { useTranslation } from "@/lib/i18n/use-translation"
import { useLaborActivities, useLaborRecords, useLaborSummary } from "@/providers/hooks"
import { cn } from "@/lib/utils"
import { CircleAlert, Clock, MapPin, ScrollText, User } from "lucide-react"

function RecordsPanel({ recordsQuery }: { recordsQuery: ReturnType<typeof useLaborRecords> }) {
  const { t } = useTranslation()
  const records = recordsQuery.data ?? []

  if (recordsQuery.error && records.length === 0) return null
  if ((recordsQuery.isLoading || recordsQuery.isValidating) && records.length === 0) {
    return <LoadingCards className="h-28" />
  }
  if (records.length === 0) {
    return <EmptyState title={t("labor.noRecords")} />
  }
  return (
    <ValidatingList validating={recordsQuery.isValidating} className="flex flex-col gap-4">
      {records.map((record, idx) => (
        <Card key={`${record.name}-${record.timeStart ?? idx}`}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {record.name}
                  {record.enrollType && (
                    <Badge variant="outline" className="ml-2 align-middle">
                      {record.enrollType}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {[record.term, record.category].filter(Boolean).join(" · ")}
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {record.hours !== undefined && (
                  <span className="text-lg font-semibold tabular-nums">
                    {record.hours}
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      {t("labor.hoursUnit")}
                    </span>
                  </span>
                )}
                {record.status && <Badge variant="secondary">{record.status}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {record.teacher && (
                <span className="flex items-center gap-1">
                  <User className="size-4" />
                  {record.teacher}
                </span>
              )}
            </div>
            {formatTimeRange(record.timeStart, record.timeEnd) && (
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span>{formatTimeRange(record.timeStart, record.timeEnd)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </ValidatingList>
  )
}

function ActivitiesPanel({
  activitiesQuery,
}: {
  activitiesQuery: ReturnType<typeof useLaborActivities>
}) {
  const { t } = useTranslation()
  const activities = activitiesQuery.data ?? []

  if (activitiesQuery.error && activities.length === 0) return null
  if ((activitiesQuery.isLoading || activitiesQuery.isValidating) && activities.length === 0) {
    return <LoadingCards className="h-28" />
  }
  if (activities.length === 0) {
    return <EmptyState title={t("labor.noActivities")} />
  }
  return (
    <ValidatingList validating={activitiesQuery.isValidating} className="flex flex-col gap-4">
      {activities.map((activity, idx) => (
        <Card key={`${activity.name}-${activity.timeStart ?? idx}`}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">{activity.name}</CardTitle>
                <CardDescription>
                  {[activity.category, activity.department].filter(Boolean).join(" · ")}
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {activity.hours !== undefined && (
                  <span className="text-lg font-semibold tabular-nums">
                    {activity.hours}
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      {t("labor.hoursUnit")}
                    </span>
                  </span>
                )}
                {activity.isEnrolled && <Badge variant="default">{t("labor.enrolled")}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {activity.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  {activity.location}
                </span>
              )}
            </div>
            {formatTimeRange(activity.timeStart, activity.timeEnd) && (
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {t("labor.activityTime")}: {formatTimeRange(activity.timeStart, activity.timeEnd)}
                </span>
              </div>
            )}
            {formatTimeRange(activity.enrollStart, activity.enrollEnd) && (
              <div className="flex items-center gap-2">
                <ScrollText className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {t("labor.enrollWindow")}:{" "}
                  {formatTimeRange(activity.enrollStart, activity.enrollEnd)}
                </span>
              </div>
            )}
            {activity.operation && (
              <p className="text-xs text-muted-foreground">{activity.operation}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </ValidatingList>
  )
}

export default function LaborPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"records" | "activities">("records")

  const summaryQuery = useLaborSummary()
  const recordsQuery = useLaborRecords(tab === "records")
  const activitiesQuery = useLaborActivities(tab === "activities")
  const activeQuery = tab === "records" ? recordsQuery : activitiesQuery
  const summary = summaryQuery.data
  const error = activeQuery.error ?? summaryQuery.error
  const retrying = summaryQuery.isValidating || activeQuery.isValidating
  const retry = () => Promise.allSettled([summaryQuery.mutate(), activeQuery.mutate()])

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{t("labor.loadFailed")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>{t("labor.loadFailedHint")}</p>
            <details className="w-full text-xs">
              <summary className="cursor-pointer">{t("labor.errorDetails")}</summary>
              <p className="mt-2 break-all">{error.message}</p>
            </details>
            <Button variant="outline" size="sm" disabled={retrying} onClick={() => void retry()}>
              {t(retrying ? "app.updating" : "labor.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {(summary || summaryQuery.isLoading) && (
        <Card>
          <CardContent className="py-4">
            {summaryQuery.isLoading && !summary ? (
              <div className="flex gap-8">
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-12 w-24" />
              </div>
            ) : summary ? (
              <div
                className={cn(
                  "flex gap-8 transition-opacity",
                  summaryQuery.isValidating && "opacity-50"
                )}
              >
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{t("labor.totalHours")}</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {summary.totalHours ?? "-"}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {t("labor.hoursUnit")}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{t("labor.totalCredits")}</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {summary.totalCredits ?? "-"}
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "records" | "activities")}>
        <TabsList className="w-full">
          <TabsTrigger value="records">{t("labor.recordsTab")}</TabsTrigger>
          <TabsTrigger value="activities">{t("labor.activitiesTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <RecordsPanel recordsQuery={recordsQuery} />
        </TabsContent>
        <TabsContent value="activities" className="mt-4">
          <ActivitiesPanel activitiesQuery={activitiesQuery} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
