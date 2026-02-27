export const WORK_TYPE_LABELS: Record<string, string> = {
  corona_metal_ceramica: "Corona Metal-Cerámica",
  corona_zirconia:       "Corona Zirconia",
  corona_emax:           "Corona Emax",
  puente_fijo:           "Puente Fijo",
  protesis_removible:    "Prótesis Removible",
  protesis_total:        "Prótesis Total",
  implante_corona:       "Corona s/ Implante",
  carilla:               "Carilla",
  incrustacion:          "Incrustación",
  ferula:                "Férula",
  retenedor:             "Retenedor",
  reparacion:            "Reparación",
  otro:                  "Otro",
};

export function formatWorkType(wt: string | null | undefined): string {
  if (!wt) return "—";
  return WORK_TYPE_LABELS[wt] || wt.replace(/_/g, " ");
}
