"use client";

import { useActionState } from "react";
import { CATEGORIES, CITIES, COUNTRIES, SENIORITY, WORK_MODES } from "@/lib/options";
import { submitPost, type SubmitState } from "./actions";

export default function SubmitForm() {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitPost, null);

  return (
    <form className="form" action={action}>
      <label>
        Link to the post
        <span className="hint">Public LinkedIn or X post where someone offers a referral.</span>
        <input name="sourceUrl" type="url" required maxLength={500} placeholder="https://www.linkedin.com/posts/..." />
      </label>
      <label>
        Role
        <input name="title" required maxLength={120} placeholder="Senior Backend Engineer" />
      </label>
      <div className="row">
        <label>
          Company
          <input name="company" required maxLength={80} />
        </label>
        <label>
          Post author
          <input name="authorName" required maxLength={80} placeholder="Name as shown on the post" />
        </label>
      </div>
      <div className="row">
        <label>
          City
          <input name="city" list="submit-cities" required maxLength={60} />
          <datalist id="submit-cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Country
          <select name="country" required defaultValue="NL">
            {Object.entries(COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Category
          <select name="category" required defaultValue="">
            <option value="" disabled>
              Choose...
            </option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Seniority
          <select name="seniority" required defaultValue="">
            <option value="" disabled>
              Choose...
            </option>
            {SENIORITY.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Work mode
          <select name="workMode" required defaultValue="Hybrid">
            {WORK_MODES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Short summary <span className="hint">(optional)</span>
        <textarea name="description" maxLength={600} placeholder="Team, stack, visa sponsorship, language..." />
      </label>
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="confirm" required />
        The post is public and the author offers to refer people.
      </label>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Sending..." : "Share post"}
        </button>
      </div>
      {state && (
        <p className={state.ok ? "status-ok" : "status-err"} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
