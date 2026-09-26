"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateProfile, type ProfileState } from "./actions";

/** Inline "Edit Profile": name, nickname, birthday. Timezone stays read-only. */
export function EditProfile({
  displayName,
  nickname,
  birthday,
}: {
  displayName: string;
  nickname: string | null;
  birthday: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState<ProfileState, FormData>(updateProfile, {});

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button type="button" variant="soft" size="sm" onClick={() => setOpen(true)}>
          Edit Profile
        </Button>
        {state.ok ? <p className="text-xs text-accent-ink">Tersimpan ♡</p> : null}
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        act(fd);
        setOpen(false);
      }}
      className="flex flex-col gap-3 rounded-2xl border border-rule bg-paper p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Name</span>
        <input
          name="display_name"
          defaultValue={displayName}
          maxLength={60}
          required
          className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Nickname</span>
        <input
          name="nickname"
          defaultValue={nickname ?? ""}
          maxLength={40}
          placeholder="panggilan sayang…"
          className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Birthday</span>
        <input
          type="date"
          name="birthday"
          defaultValue={birthday ?? ""}
          className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}
