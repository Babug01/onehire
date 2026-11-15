import type { Metadata } from "next";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = { title: "Share a referral post" };

export default function SubmitPage() {
  return (
    <section className="hero">
      <h1>Share a referral post</h1>
      <p>Saw a LinkedIn or X post offering referrals for a tech role in Europe? Add it here. We review every post.</p>
      <SubmitForm />
    </section>
  );
}
