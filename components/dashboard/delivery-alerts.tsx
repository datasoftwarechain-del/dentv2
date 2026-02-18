"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_BADGE_CLASSES } from "@/lib/order-status";
import { formatDueTime, isOverdue } from "@/lib/date-utils";
import {
  AlertCircle,
  Clock,
  Calendar,
  Bell,
  ChevronRight,
  User,
  Building2,
} from "lucide-react";
import Link from "next/link";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Organization {
  id: string;
  name: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  due_date: string;
  patient: Patient | Patient[] | null;
  dentist_org: Organization | Organization[] | null;
  lab_org: Organization | Organization[] | null;
}

interface DeliveryAlertsProps {
  todayOrders: Order[];
  tomorrowOrders: Order[];
  isDentist: boolean;
}

export function DeliveryAlerts({
  todayOrders,
  tomorrowOrders,
  isDentist,
}: DeliveryAlertsProps) {
  const statusColors = ORDER_STATUS_BADGE_CLASSES;

  // Don't render if no alerts
  if (todayOrders.length === 0 && tomorrowOrders.length === 0) {
    return null;
  }

  // Using utility functions from date-utils

  return (
    <div className="space-y-4">
      {/* Today's Deliveries - Brand Highlight */}
      {todayOrders.length > 0 && (
        <Card className="border border-secondary/20 bg-gradient-to-br from-secondary/[0.04] via-background to-secondary/[0.02] shadow-premium animate-in fade-in slide-in-from-top-2 duration-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-lg shadow-secondary/20">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-secondary flex items-center gap-2">
                    Entregas HOY
                    <Badge variant="outline" className="bg-secondary/10 border-secondary/20 text-secondary text-[10px] uppercase tracking-wider h-5 font-bold">Urgente</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {todayOrders.length}{" "}
                    {todayOrders.length === 1 ? "trabajo pendiente" : "trabajos pendientes"}
                  </p>
                </div>
              </div>
              <Link href="/dashboard/orders">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-bold text-secondary hover:bg-secondary/10"
                >
                  Ver Todos
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {todayOrders.slice(0, 3).map((order) => {
              const patientData = order.patient;
              const patient = Array.isArray(patientData) ? patientData[0] : patientData;
              const orgData = isDentist ? order.lab_org : order.dentist_org;
              const org = Array.isArray(orgData) ? orgData[0] : orgData;
              const overdue = isOverdue(order.due_date);

              return (
                <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                  <Card className="group cursor-pointer border border-border/50 hover:border-secondary/40 hover:shadow-md transition-all bg-white/50 dark:bg-background/50 backdrop-blur-sm rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground group-hover:text-secondary transition-colors">
                              {order.order_number}
                            </p>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[9px] font-bold uppercase",
                                statusColors[order.status]
                              )}
                            >
                              {order.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {patient && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate font-medium">
                                <User className="h-3 w-3" />
                                {patient.first_name} {patient.last_name}
                              </p>
                            )}
                            {org && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate font-medium">
                                <Building2 className="h-3 w-3" />
                                {org.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 font-bold",
                              overdue ? "text-primary px-2 py-0.5 bg-primary/5 rounded-lg" : "text-[#09919b]"
                            )}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-lg">{formatDueTime(order.due_date)}</span>
                          </div>
                          {overdue && (
                            <div className="flex justify-end mt-1">
                              <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-tighter">
                                ATRASADO
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {todayOrders.length > 3 && (
              <Link href="/dashboard/orders">
                <div className="text-center py-2 text-[11px] text-secondary font-bold hover:underline transition-all cursor-pointer">
                  + {todayOrders.length - 3} ENTREGAS MÁS HOY
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tomorrow's Deliveries - Warning Alert */}
      {tomorrowOrders.length > 0 && (
        <Card className="border border-indigo-200 bg-gradient-to-r from-indigo-50 to-[#d2f2f3] dark:from-indigo-950/20 dark:to-[#044c64]/10 dark:border-indigo-900/50 shadow-md animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-indigo-900 dark:text-indigo-300">
                    Entregas MAÑANA
                  </CardTitle>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                    {tomorrowOrders.length}{" "}
                    {tomorrowOrders.length === 1 ? "trabajo programado" : "trabajos programados"}
                  </p>
                </div>
              </div>
              <Link href="/dashboard/schedule">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:hover:bg-indigo-900/30"
                >
                  Ver Agenda
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {tomorrowOrders.slice(0, 3).map((order) => {
              const patientData = order.patient;
              const patient = Array.isArray(patientData) ? patientData[0] : patientData;
              const orgData = isDentist ? order.lab_org : order.dentist_org;
              const org = Array.isArray(orgData) ? orgData[0] : orgData;

              return (
                <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                  <Card className="group cursor-pointer border border-indigo-200/50 hover:border-indigo-400 hover:shadow-md transition-all bg-white/80 dark:bg-background/50 backdrop-blur-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground group-hover:text-indigo-600 transition-colors">
                              {order.order_number}
                            </p>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[9px] font-bold uppercase",
                                statusColors[order.status]
                              )}
                            >
                              {order.status}
                            </Badge>
                          </div>
                          {patient && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <User className="h-3 w-3" />
                              {patient.first_name} {patient.last_name}
                            </p>
                          )}
                          {org && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                              <Building2 className="h-3 w-3" />
                              {org.name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[#09919b] font-bold">
                          <Clock className="h-4 w-4" />
                          <span className="text-lg">{formatDueTime(order.due_date)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {tomorrowOrders.length > 3 && (
              <Link href="/dashboard/schedule">
                <div className="text-center py-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                  + {tomorrowOrders.length - 3} entregas más mañana
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
