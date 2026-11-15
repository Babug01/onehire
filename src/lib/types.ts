export type Post = {
  id: string;
  title: string;
  company: string;
  city: string;
  country: string;
  category: string;
  seniority: string;
  workMode: string;
  sourceUrl: string;
  platform: string;
  authorName: string;
  description: string;
  status: string;
  source: string;
  createdAt: Date;
  lastSeenAt: Date;
};

export type Kind = "" | "referral" | "jobs";

export type Filters = {
  q: string;
  country: string;
  city: string;
  category: string;
  seniority: string;
  workMode: string;
  kind: Kind;
  page: number;
};
