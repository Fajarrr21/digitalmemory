/**
 * Hand-authored to match supabase/migrations. Once the Supabase CLI is set up
 * you can regenerate this with:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
 */

export type MemberRole = "keeper" | "author";
export type LetterStatus = "sealed" | "opened";
export type MediaType = "image" | "video" | "audio";
export type UnlockType = "always" | "date" | "streak" | "manual";
export type ThemePref = "system" | "light" | "dark";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          nickname: string | null;
          birthday: string | null;
          avatar_path: string | null;
          timezone: string;
          theme: ThemePref;
          reduced_motion: boolean;
          notif_prefs: Record<string, unknown>;
          whatsapp: string | null;
        } & Timestamps;
        Insert: {
          id: string;
          display_name: string;
          nickname?: string | null;
          birthday?: string | null;
          avatar_path?: string | null;
          timezone?: string;
          theme?: ThemePref;
          reduced_motion?: boolean;
          notif_prefs?: Record<string, unknown>;
          whatsapp?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      spaces: {
        Row: { id: string; name: string; created_by: string } & Timestamps;
        Insert: { id?: string; name: string; created_by: string };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      space_members: {
        Row: { space_id: string; user_id: string; role: MemberRole; created_at: string };
        Insert: { space_id: string; user_id: string; role: MemberRole };
        Update: Partial<{ role: MemberRole }>;
        Relationships: [];
      };
      letter_pool: {
        Row: {
          id: string;
          space_id: string;
          category: string;
          title: string | null;
          body: string;
          content_hash: string | null;
          author_id: string | null;
          used_on: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          category: string;
          title?: string | null;
          body: string;
          content_hash?: string | null;
          author_id?: string | null;
          used_on?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["letter_pool"]["Insert"]>;
        Relationships: [];
      };
      daily_letters: {
        Row: {
          id: string;
          space_id: string;
          recipient_id: string;
          letter_date: string;
          pool_id: string | null;
          category: string;
          title: string | null;
          body: string;
          status: LetterStatus;
          opened_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          recipient_id: string;
          letter_date: string;
          pool_id?: string | null;
          category: string;
          title?: string | null;
          body: string;
          status?: LetterStatus;
          opened_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["daily_letters"]["Insert"]>;
        Relationships: [];
      };
      direct_letters: {
        Row: {
          id: string;
          space_id: string;
          sender_id: string;
          recipient_id: string;
          title: string | null;
          body: string;
          song_track_id: string | null;
          song_title: string | null;
          song_image: string | null;
          batch_id: string | null;
          sort_index: number;
          status: LetterStatus;
          opened_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          sender_id: string;
          recipient_id: string;
          title?: string | null;
          body: string;
          song_track_id?: string | null;
          song_title?: string | null;
          song_image?: string | null;
          batch_id?: string | null;
          sort_index?: number;
          status?: LetterStatus;
          opened_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["direct_letters"]["Insert"]>;
        Relationships: [];
      };
      daily_ratings: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          rating_date: string;
          score: number;
          mood: string | null;
          reason: string | null;
          note: string | null;
          notify_count: number;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          rating_date: string;
          score: number;
          mood?: string | null;
          reason?: string | null;
          note?: string | null;
          notify_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["daily_ratings"]["Insert"]>;
        Relationships: [];
      };
      daily_activities: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          activity_date: string;
          title: string;
          description: string | null;
          location: string | null;
          visibility: "shared" | "private";
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          activity_date: string;
          title: string;
          description?: string | null;
          location?: string | null;
          visibility?: "shared" | "private";
        };
        Update: Partial<Database["public"]["Tables"]["daily_activities"]["Insert"]>;
        Relationships: [];
      };
      media: {
        Row: {
          id: string;
          space_id: string;
          owner_id: string;
          type: MediaType;
          storage_path: string;
          mime: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          duration: number | null;
          alt_text: string | null;
          activity_id: string | null;
          memory_id: string | null;
          message_id: string | null;
          rating_id: string | null;
          album_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          owner_id: string;
          type: MediaType;
          storage_path: string;
          mime: string;
          size_bytes: number;
          width?: number | null;
          height?: number | null;
          duration?: number | null;
          alt_text?: string | null;
          activity_id?: string | null;
          memory_id?: string | null;
          message_id?: string | null;
          rating_id?: string | null;
          album_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["media"]["Insert"]>;
        Relationships: [];
      };
      albums: {
        Row: {
          id: string;
          space_id: string;
          title: string;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          title: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["albums"]["Insert"]>;
        Relationships: [];
      };
      our_memories: {
        Row: {
          id: string;
          space_id: string;
          title: string;
          description: string | null;
          memory_date: string | null;
          sort_order: number;
          is_featured: boolean;
          created_by: string;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          title: string;
          description?: string | null;
          memory_date?: string | null;
          sort_order?: number;
          is_featured?: boolean;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["our_memories"]["Insert"]>;
        Relationships: [];
      };
      special_messages: {
        Row: {
          id: string;
          space_id: string;
          recipient_id: string;
          author_id: string;
          title: string;
          body: string;
          unlock_type: UnlockType;
          unlock_value: Record<string, unknown>;
          opened_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          recipient_id: string;
          author_id: string;
          title: string;
          body: string;
          unlock_type?: UnlockType;
          unlock_value?: Record<string, unknown>;
          opened_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["special_messages"]["Insert"]>;
        Relationships: [];
      };
      night_reflections: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          reflection_date: string;
          q_today: string | null;
          q_smile: string | null;
          q_hard: string | null;
          q_release: string | null;
          q_grateful: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          reflection_date: string;
          q_today?: string | null;
          q_smile?: string | null;
          q_hard?: string | null;
          q_release?: string | null;
          q_grateful?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["night_reflections"]["Insert"]>;
        Relationships: [];
      };
      tags: {
        Row: { id: string; space_id: string; name: string; created_at: string };
        Insert: { id?: string; space_id: string; name: string };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      activity_tags: {
        Row: { activity_id: string; tag_id: string };
        Insert: { activity_id: string; tag_id: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
