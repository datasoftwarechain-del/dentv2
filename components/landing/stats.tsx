const stats = [
  { value: "40%", label: "Reduccion en errores de pedidos" },
  { value: "3x", label: "Mas rapido en comunicacion" },
  { value: "25%", label: "Ahorro en costos operativos" },
  { value: "99.9%", label: "Uptime garantizado" },
];

export function Stats() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
