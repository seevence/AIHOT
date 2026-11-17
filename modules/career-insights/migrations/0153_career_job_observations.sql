CREATE TABLE career_job_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES career_jobs(id),
  observed_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  collector_version text NOT NULL,
  source_url text NOT NULL,
  raw_excerpt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, observed_at, content_hash)
);