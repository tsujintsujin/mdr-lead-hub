"use client";
import { setMe } from "./actions";

/** Demo only: pick who you are, so actions in the timeline carry a name. */
export default function MeSwitch({ me, people }: { me: string; people: string[] }) {
  return (
    <select aria-label="You are" defaultValue={me} onChange={(e) => setMe(e.target.value)}>
      {people.map((p) => <option key={p}>{p}</option>)}
    </select>
  );
}
