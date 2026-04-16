import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-4 lg:space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-xl border">
            <CardHeader className="p-4 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Card className="rounded-xl border">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </CardContent>
      </Card>
    </div>
  )
}

export const LevantamentoListSkeleton = () => {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="flex gap-4">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 w-[220px] rounded-md" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
