import { FileText, Users, Truck, CreditCard, BarChart3, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Gestion de Pedidos",
    description: "Crea y rastrea pedidos con especificaciones detalladas, fotos y archivos STL. Recibe notificaciones en tiempo real.",
  },
  {
    icon: Users,
    title: "Portal para Clinicas",
    description: "Agenda citas, gestiona pacientes y envía pedidos al laboratorio con un solo clic desde tu consultorio.",
  },
  {
    icon: Truck,
    title: "Seguimiento de Produccion",
    description: "Tablero Kanban para visualizar el estado de cada trabajo. Desde recepcion hasta entrega final.",
  },
  {
    icon: CreditCard,
    title: "Facturacion Integrada",
    description: "Genera facturas automaticamente, controla pagos pendientes y mantén un registro detallado de transacciones.",
  },
  {
    icon: BarChart3,
    title: "Reportes y Analiticas",
    description: "Dashboards con metricas clave: ingresos, tiempos de entrega, productividad y satisfaccion del cliente.",
  },
  {
    icon: Shield,
    title: "Seguridad y Privacidad",
    description: "Datos encriptados, backups automaticos y cumplimiento con normativas de proteccion de datos de salud.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que necesitas para tu laboratorio
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Herramientas disenadas para optimizar cada aspecto de la gestion dental
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <feature.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
