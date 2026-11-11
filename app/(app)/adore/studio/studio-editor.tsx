"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { AdoreStatus, AdoreType } from "@/lib/supabase/database.types";
import { CATEGORIES, KINDS, ALL_KINDS, MOMENT_TIME, WISH_STATES } from "../adore-config";
import { deleteAdore, discardAdoreUpload, saveAdore, type SaveState } from "../actions";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { VoiceRecorder, type VoiceState } from "@/components/media/voice-recorder";
import { IMAGE_MIME, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, extFromMime } from "@/lib/media-config";

const field =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

export type EditorInitial = {
  id?: string;
  content_type: AdoreType;
  title: string;
  subtitle: string;
  body: string;
  category: string;
  status: AdoreStatus;
  publish_date: string;
  publish_time: string;
  song: string;
  in_pool: boolean;
  repeat_allowed: boolean;
  number: number | null;
  wish_state: string;
  target_date: string;
  /** Signed URLs of what's already attached (editing). */
  photoUrl: string | null;
  audioUrl: string | null;
};

/** One line under the collection picker so each kind is written the right way. */
const HINTS: Partial<Record<AdoreType, string>> = {
  remembered: "Terbit = dia bisa lihat (“Aku mengingat ini untukmu”). Draf = catatan pribadimu. Simpan cuma yang memang dia ceritakan sendiri.",
  name_page: "Judul = nama/panggilannya, subjudul = kutipan, isi = dedikasi. Kategori = warna halaman.",
  notification: "Isi = pesan notifikasinya (singkat). Muncul di 🔔 dia saat jamnya tiba; WhatsApp cuma kalau dia sendiri yang menyalakan.",
  reasons_i_stay: "Komitmen yang sehat — jangan janji yang nggak realistis, jangan bikin dia merasa bersalah.",
  another_universe: "Tulisan imajinatif. Kalau suatu hari terwujud, kalian berdua bisa menandainya.",
  future_wish: "Daftar harapan yang bisa diwujudkan. Kalian berdua bisa memindahkan statusnya.",
};

export function StudioEditor({ initial, spaceId, selfId }: { initial: EditorInitial; spaceId: string; selfId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<AdoreType>(initial.content_type);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [voice, setVoice] = useState<VoiceState>({ kind: "unchanged" });

  // Media goes up from the browser first (compressed), then the row is saved
  // pointing at it; if the save fails, the fresh upload is taken back.
  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, fd) => {
    const supabase = createClient();
    const uploaded: string[] = [];
    const put = async (blob: Blob, mime: string) => {
      const path = `${spaceId}/${selfId}/adore/${crypto.randomUUID()}.${extFromMime(mime)}`;
      const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: mime, upsert: false });
      if (error) throw error;
      uploaded.push(path);
      return path;
    };
    try {
      if (photo) {
        const small = await imageCompression(photo, { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true });
        fd.set("photo", await put(small, small.type || photo.type));
      } else fd.set("photo", removePhoto ? "remove" : "keep");
      if (voice.kind === "new") {
        if (voice.blob.size > MAX_AUDIO_BYTES) return { error: "Rekamannya terlalu besar. Coba yang lebih singkat ya." };
        fd.set("audio", await put(voice.blob, voice.mime));
        fd.set("audio_seconds", String(voice.durationSec));
      } else fd.set("audio", voice.kind === "removed" ? "remove" : "keep");
    } catch {
      uploaded.forEach((u) => void discardAdoreUpload(u));
      return { error: "Fotonya/suaranya gagal diunggah. Tulisanmu masih di sini — coba lagi ya." };
    }
    const res = await saveAdore(prev, fd);
    if (!res.ok) uploaded.forEach((u) => void discardAdoreUpload(u));
    return res;
  }, {});

  useEffect(() => {
    if (state.ok) router.push("/adore/studio");
  }, [state.ok, router]);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-rule bg-paper p-5">
      <p className="font-display text-lg font-medium text-ink">{initial.id ? "Sunting tulisan" : "Tulis yang baru"}</p>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
        Koleksi
        <select name="content_type" value={kind} onChange={(e) => setKind(e.target.value as AdoreType)} className={field}>
          {ALL_KINDS.map((k) => (
            <option key={k} value={k}>{KINDS[k].label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
        {HINTS[kind] ? <span className="text-xs text-ink-faint">{HINTS[kind]}</span> : null}
        {kind === "open_when" ? "Untuk saat…" : kind === "through_my_eyes" ? "Bagian" : kind === "surprise" ? "Momen" : "Kategori"}
        <select key={kind} name="category" defaultValue={kind === initial.content_type ? initial.category : ""} className={field}>
          <option value="">{kind === "reason" || kind === "thousand" ? "Tanpa kategori" : "— pilih —"}</option>
          {CATEGORIES[kind].map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </label>

      {kind === "thousand" ? (
        <p className="font-mono text-xs text-ink-faint">
          {initial.number && initial.content_type === "thousand"
            ? `Nomor ${String(initial.number).padStart(3, "0")}`
            : "Nomornya otomatis — nomor berikutnya, nggak akan dobel."}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
        {kind === "thousand" ? "Alasannya (singkat)" : "Judul"}
        <input name="title" defaultValue={initial.title} maxLength={160} required className={field}
          placeholder={kind === "reason" ? "The way you tell stories" : kind === "thousand" ? "Your curiosity about little things." : "Judul suratnya"} />
      </label>

      {kind !== "reason" && kind !== "thousand" ? (
        <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
          Subjudul <span className="text-xs text-ink-faint">(opsional)</span>
          <input name="subtitle" defaultValue={initial.subtitle} maxLength={200} className={field} />
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
        Isi {kind === "thousand" ? <span className="text-xs text-ink-faint">(opsional)</span> : null}
        <textarea name="body" defaultValue={initial.body} rows={kind === "reason" || kind === "thousand" ? 4 : 12} required={kind !== "thousand"} maxLength={20000}
          className={`${field} resize-y font-display leading-relaxed`}
          placeholder="Tulis dari pengamatanmu sendiri — detail kecil yang cuma kamu yang tahu. ♡" />
      </label>

      {kind === "future_wish" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
            Status harapan
            <select name="wish_state" defaultValue={initial.wish_state || "someday"} className={field}>
              {WISH_STATES.map((w) => (
                <option key={w.key} value={w.key}>{w.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
            Target <span className="text-xs text-ink-faint">(opsional)</span>
            <input type="date" name="target_date" defaultValue={initial.target_date} className={field} />
          </label>
        </div>
      ) : null}

      {kind === "open_when" || kind === "surprise" ? (
        <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
          Lagu Spotify <span className="text-xs text-ink-faint">(opsional — tempel link lagunya)</span>
          <input name="song" defaultValue={initial.song} maxLength={300} className={field} placeholder="https://open.spotify.com/track/…" />
        </label>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-rule-soft p-3 text-sm text-ink-soft">
        <p>Foto <span className="text-xs text-ink-faint">(opsional)</span></p>
        {initial.photoUrl && !removePhoto && !photo ? (
          <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img src={initial.photoUrl} alt="Foto yang terpasang" className="h-16 w-16 rounded-lg object-cover" />
            <button type="button" onClick={() => setRemovePhoto(true)} className="text-xs text-ink-faint hover:text-danger">hapus foto</button>
          </div>
        ) : null}
        <input
          type="file"
          accept={IMAGE_MIME.join(",")}
          aria-label="Pilih foto"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_IMAGE_BYTES) {
              e.target.value = "";
              return;
            }
            setPhoto(f);
          }}
          className="text-xs"
        />
        <p className="mt-1">Voice note <span className="text-xs text-ink-faint">(opsional)</span></p>
        <VoiceRecorder existingUrl={initial.audioUrl} onChange={setVoice} disabled={pending} />
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-rule-soft p-3 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="in_pool" defaultChecked={initial.in_pool} />
          Masuk kotak kejutan (tombol &quot;Aku butuh sedikit sayang&quot;)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="repeat_allowed" defaultChecked={initial.repeat_allowed} />
          Boleh muncul lagi setelah dia buka
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5 text-sm text-ink-soft">
        <legend className="mb-1.5">Status</legend>
        <div className="flex flex-wrap gap-3">
          {(["draft", "published", "archived"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-ink">
              <input type="radio" name="status" value={s} defaultChecked={initial.status === s} />
              {s === "draft" ? "Draf" : s === "published" ? "Terbitkan" : "Arsip"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
          Terbuka mulai
          <input type="date" name="publish_date" defaultValue={initial.publish_date} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
          Jam
          <input type="time" name="publish_time" defaultValue={initial.publish_time} className={field} />
        </label>
      </div>
      <p className="text-xs text-ink-faint">
        {kind === "surprise"
          ? `Morning = jam ${MOMENT_TIME.morning}, Midnight = jam ${MOMENT_TIME.midnight} kalau jamnya dikosongkan. `
          : ""}
        Kosongkan tanggal = langsung terbuka saat diterbitkan. Tanggal di masa depan = terjadwal; sampai saat itu dia cuma melihat amplop tersegel.
      </p>

      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
        {initial.id ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => router.push("/adore/studio")}>Batal</Button>
        ) : null}
      </div>
    </form>
  );
}

export function DeleteAdore({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm) return setConfirm(true);
        start(async () => {
          await deleteAdore(id);
          router.refresh();
        });
      }}
      className="text-xs text-ink-faint hover:text-danger"
    >
      {pending ? "…" : confirm ? "yakin hapus?" : "hapus"}
    </button>
  );
}
