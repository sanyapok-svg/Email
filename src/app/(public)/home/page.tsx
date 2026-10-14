import type { Metadata } from "next";
import { Channels } from "@/components/public/channels";
import { FeatureCards } from "@/components/public/feature-cards";
import { FinalCta } from "@/components/public/final-cta";
import { Hero } from "@/components/public/hero";
import { Honesty } from "@/components/public/honesty";
import { HowItWorks } from "@/components/public/how-it-works";
import { RuleSimulator } from "@/components/public/rule-simulator";
import { SavingsCalculator } from "@/components/public/savings-calculator";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { StickyCta } from "@/components/public/sticky-cta";
import { SupportButton } from "@/components/public/support-button";

export const metadata: Metadata = {
  title: { absolute: "Почтаход — из общего ящика в нужные руки" },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <FeatureCards />
        <HowItWorks />
        <Channels />
        <RuleSimulator />
        <Honesty />
        <SavingsCalculator />
        <FinalCta />
      </main>
      <SiteFooter />
      <StickyCta />
      <SupportButton lift />
    </>
  );
}
