import { useNavigate } from "react-router-dom";
import { openBooking } from "@/config/links";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import Reveal from "@/components/Reveal";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { getTiers, monthlyCents, tierShade, type AdmissionsTier } from "@/services/admissionsService";

// ============================================================
// College counselling plans, on the public page.
//
// The same rows the parent dashboard sells from, so a price can never be
// right in one place and stale in the other. Editing a tier changes the
// marketing page and the checkout together, which is the only arrangement
// where nobody has to remember to do both.
//
// Nothing renders if there are no active tiers. An empty pricing section is
// worse than no pricing section.
// ============================================================

export default function CounsellingTiers(_props: { scrollTo?: (id: string) => void }) {
  const navigate = useNavigate();
  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ["admissions-tiers"],
    queryFn: getTiers,
  });

  // The section is always in the document, even with nothing in it yet. It
  // used to return null while the tiers loaded, so the College admissions link
  // in the navbar looked for an element that was not there and did nothing.
  if (isLoading || tiers.length === 0) {
    return <section id="counselling" className="w-full" aria-hidden />;
  }

  return (
    <section id="counselling" className="w-full max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#1099A1]">
            College admissions
          </p>
          <h2 className="mt-3 text-[30px] font-bold leading-tight text-[#111] md:text-[40px]">
            Guidance from the first list to Decision Day
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#54656f] md:text-[16px]">
            Every plan pairs your child with a counselor who knows the process. Choose the level
            of contact that suits your family, and pay for it monthly.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-6 md:mt-14 lg:grid-cols-3">
        {tiers.map((tier, i) => (
          <Reveal key={tier.id} delay={i * 100}>
            <TierCard tier={tier} shade={tierShade(i)} onEnquire={() => navigate("/login")} />
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="mt-8 text-center text-[13.5px] text-[#54656f]">
          Not sure which one fits?{" "}
          <button
            onClick={openBooking}
            className="font-semibold text-[#1099A1] underline-offset-4 hover:underline"
          >
            Talk to us first
          </button>
          . We will tell you honestly if a smaller plan is enough.
        </p>
      </Reveal>
    </section>
  );
}

function TierCard({
  tier,
  shade,
  onEnquire,
}: {
  tier: AdmissionsTier;
  shade: string;
  onEnquire: () => void;
}) {
  const monthly = tier.instalmentMonths > 1;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-6 md:p-7",
        tier.isRecommended && "shadow-sm"
      )}
      // The tier's shade is its identity: the top edge and the border carry it,
      // so the three plans read as three different things at a glance.
      style={{ borderColor: shade, borderTopWidth: 4 }}
    >
      {/* A fixed line whether or not it says anything, so three cards start at
          the same height rather than one sitting lower than its neighbours. */}
      <p className="mb-1 h-4 text-[11px] font-bold uppercase tracking-wider" style={{ color: shade }}>
        {tier.isRecommended ? "Most chosen" : ""}
      </p>

      <h3 className="text-[22px] font-bold text-[#111]">{tier.name}</h3>
      {tier.blurb && (
        <p className="mt-2 text-[14px] leading-relaxed text-[#54656f]">{tier.blurb}</p>
      )}

      <div className="mt-5">
        {monthly ? (
          <>
            <p className="text-[30px] font-bold leading-none text-[#111]">
              {money(monthlyCents(tier))}
              <span className="text-[15px] font-normal text-[#54656f]"> /month</span>
            </p>
            <p className="mt-1.5 text-[13px] text-[#54656f]">
              {tier.instalmentMonths} monthly payments, {money(tier.priceCents)} in total
            </p>
          </>
        ) : (
          <>
            <p className="text-[30px] font-bold leading-none text-[#111]">
              {money(tier.priceCents)}
            </p>
            <p className="mt-1.5 text-[13px] text-[#54656f]">One payment</p>
          </>
        )}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#111]">
            <Check size={16} className="mt-0.5 shrink-0 text-[#97CE9D]" />
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      {tier.fits && (
        <p className="mt-6 rounded-xl bg-[#f8f9fa] p-4 text-[13px] leading-relaxed text-[#54656f]">
          <span className="font-semibold text-[#111]">Fits: </span>
          {tier.fits}
        </p>
      )}

      <button
        onClick={onEnquire}
        className={cn(
          "mt-6 h-12 w-full rounded-xl text-[14.5px] font-semibold transition-colors",
          tier.isRecommended
            ? "bg-[#1099A1] text-white hover:bg-[#0d7f86]"
            : "border border-[#1099A1] text-[#1099A1] hover:bg-[#1099A1]/5"
        )}
      >
        Get started
      </button>
    </article>
  );
}
