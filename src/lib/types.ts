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
  createdAt: Date;
};

export type Filters = {
  q: string;
  country: string;
  city: string;
  category: string;
  seniority: string;
  workMode: string;
};
