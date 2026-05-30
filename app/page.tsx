// Landing page — composes Nav, Hero, Problem, How, Why, Security, Stack, Footer.
import Nav from "@/components/landing/nav";
import Hero from "@/components/landing/hero";
import { Problem, How, Why, Security, Stack, Footer } from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <div style={{ position: "relative" }} className="landing-body">
      <Nav />
      <Hero />
      <Problem />
      <How />
      <Why />
      <Security />
      <Stack />
      <Footer />
    </div>
  );
}
