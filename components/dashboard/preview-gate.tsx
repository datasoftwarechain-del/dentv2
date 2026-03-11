import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface PreviewGateProps {
  featureName: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Shown to dentist_preview users when they try to access a locked feature.
 * Provides a call-to-action to upgrade to a full account.
 */
export function PreviewGate({ featureName, description, icon: Icon }: PreviewGateProps) {
  const FeatureIcon = Icon ?? Lock;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="max-w-md w-full space-y-6">
        {/* Icon container */}
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center h-20 w-20 rounded-3xl bg-[#43eada]/10 border border-[#09919b]/20">
            <FeatureIcon className="h-9 w-9 text-[#044c64]" />
          </div>
        </div>

        {/* Lock badge */}
        <div className="flex items-center justify-center gap-2">
          <Lock className="h-4 w-4 text-[#09919b]" />
          <span className="text-sm font-semibold text-[#09919b] uppercase tracking-wider">
            Cuenta Vista Previa
          </span>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-[#044c64]">{featureName}</h2>

        {/* Description */}
        <p className="text-muted-foreground leading-relaxed">{description}</p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild className="bg-[#044c64] hover:bg-[#033d52] text-white px-6">
            <Link href="/onboarding?upgrade=true&from=preview">
              Activar cuenta completa
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-[#09919b]/30 text-[#044c64] hover:bg-[#43eada]/5 px-6">
            <Link href="/dashboard">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
