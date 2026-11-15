import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs";
import { JobDetail, placeOf } from "../../ui";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job) return { title: "Job not found" };
  return { title: `${job.title} at ${job.company}`, description: `${job.title} at ${job.company}, ${placeOf(job)}.` };
}

export default async function JobPage({ params }: { params: Params }) {
  const job = await getJob((await params).id);
  if (!job) notFound();
  return (
    <div className="job-page">
      <Link className="back-link" href="/">
        ← Search all jobs
      </Link>
      <JobDetail job={job} />
    </div>
  );
}
