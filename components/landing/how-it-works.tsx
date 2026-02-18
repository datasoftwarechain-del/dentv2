const steps = [
  {
    number: "01",
    title: "Registra tu organizacion",
    description: "Crea tu cuenta como clinica dental o laboratorio. Configura tu perfil, servicios y precios en minutos.",
  },
  {
    number: "02",
    title: "Conecta con socios",
    description: "Clinicas pueden buscar y conectar con laboratorios. Los laboratorios reciben solicitudes de trabajo automaticamente.",
  },
  {
    number: "03",
    title: "Gestiona pedidos",
    description: "Envia pedidos con especificaciones detalladas. Recibe actualizaciones de estado y fechas de entrega.",
  },
  {
    number: "04",
    title: "Factura y cobra",
    description: "Genera facturas automaticas al completar trabajos. Controla pagos y mantén tu contabilidad al dia.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border bg-card py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Como funciona
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Empieza a usar DigitalDent en cuatro simples pasos
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="mb-4 text-5xl font-bold text-muted-foreground/20">{step.number}</div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
