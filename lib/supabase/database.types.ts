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
export type AwayKind = "working" | "playing" | "outside" | "sleeping" | "busy";
export type BoothStatus = "waiting" | "joined" | "shooting" | "completed";
export type TaskRepeat = "none" | "daily" | "weekly" | "monthly";
export type MeanwhileCategory = "question" | "pick" | "photo" | "song" | "creation" | "silly";
export type WatchStatus = "waiting" | "ready" | "watching" | "ended";
/** How the thing plays inside a Watch Room. Only youtube/file are controllable. */
export type WatchSourceKind = "youtube" | "file" | "embed";

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
      daily_coloring: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          rating_id: string;
          template_id: string;
          fills: Record<string, string>;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          rating_id: string;
          template_id: string;
          fills?: Record<string, string>;
        };
        Update: Partial<Database["public"]["Tables"]["daily_coloring"]["Insert"]>;
        Relationships: [];
      };
      away_status: {
        Row: {
          space_id: string;
          user_id: string;
          kind: AwayKind;
          active: boolean;
        } & Timestamps;
        Insert: {
          space_id: string;
          user_id: string;
          kind: AwayKind;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["away_status"]["Insert"]>;
        Relationships: [];
      };
      meanwhile_moments: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          category: MeanwhileCategory;
          prompt: string;
          payload: Record<string, unknown>;
          shared: boolean;
          moment_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          category: MeanwhileCategory;
          prompt: string;
          payload?: Record<string, unknown>;
          shared?: boolean;
          moment_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["meanwhile_moments"]["Insert"]>;
        Relationships: [];
      };
      photobooth_sessions: {
        Row: {
          id: string;
          space_id: string;
          creator_id: string;
          participant_id: string | null;
          status: BoothStatus;
          frame_id: string;
          shot_count: number;
          expires_at: string;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          creator_id: string;
          participant_id?: string | null;
          status?: BoothStatus;
          frame_id?: string;
          shot_count?: number;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photobooth_sessions"]["Insert"]>;
        Relationships: [];
      };
      photobooth_photos: {
        Row: {
          session_id: string;
          user_id: string;
          shot_index: number;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          user_id: string;
          shot_index: number;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["photobooth_photos"]["Insert"]>;
        Relationships: [];
      };
      presence_days: {
        Row: {
          space_id: string;
          user_id: string;
          day: string;
          created_at: string;
        };
        Insert: {
          space_id: string;
          user_id: string;
          day: string;
        };
        Update: Partial<Database["public"]["Tables"]["presence_days"]["Insert"]>;
        Relationships: [];
      };
      flame_recoveries: {
        Row: {
          id: string;
          space_id: string;
          day: string;
          restored_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          day: string;
          restored_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["flame_recoveries"]["Insert"]>;
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
      tasks: {
        Row: {
          id: string;
          space_id: string;
          created_by: string;
          /** null = "both of us". */
          assigned_to: string | null;
          title: string;
          note: string | null;
          emoji: string | null;
          due_date: string;
          due_time: string | null;
          started_at: string | null;
          repeat_kind: TaskRepeat;
          notify_whatsapp: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          created_by: string;
          assigned_to?: string | null;
          title: string;
          note?: string | null;
          emoji?: string | null;
          due_date: string;
          due_time?: string | null;
          started_at?: string | null;
          repeat_kind?: TaskRepeat;
          notify_whatsapp?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      task_completions: {
        Row: { task_id: string; user_id: string; completed_at: string };
        Insert: { task_id: string; user_id: string; completed_at?: string };
        Update: Partial<Database["public"]["Tables"]["task_completions"]["Insert"]>;
        Relationships: [];
      };
      task_reminders: {
        Row: {
          id: string;
          task_id: string;
          space_id: string;
          remind_at: string;
          offset_days: number | null;
          remind_time: string;
          sent_at: string | null;
          dismissed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          space_id: string;
          remind_at: string;
          offset_days?: number | null;
          remind_time?: string;
          sent_at?: string | null;
          dismissed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["task_reminders"]["Insert"]>;
        Relationships: [];
      };
      watch_rooms: {
        Row: {
          id: string;
          space_id: string;
          host_id: string;
          guest_id: string | null;
          status: WatchStatus;
          source_kind: WatchSourceKind;
          source_url: string;
          video_id: string | null;
          title: string;
          subtitle: string | null;
          poster_url: string | null;
          is_playing: boolean;
          position_seconds: number;
          position_at: string;
          duration_seconds: number | null;
          updated_by: string | null;
          started_at: string | null;
          ended_at: string | null;
          expires_at: string;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          host_id: string;
          guest_id?: string | null;
          status?: WatchStatus;
          source_kind: WatchSourceKind;
          source_url: string;
          video_id?: string | null;
          title: string;
          subtitle?: string | null;
          poster_url?: string | null;
          is_playing?: boolean;
          position_seconds?: number;
          position_at?: string;
          duration_seconds?: number | null;
          updated_by?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["watch_rooms"]["Insert"]>;
        Relationships: [];
      };
      watch_messages: {
        Row: {
          id: string;
          room_id: string;
          space_id: string;
          user_id: string;
          body: string;
          reply_to: string | null;
          at_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          space_id: string;
          user_id: string;
          body: string;
          reply_to?: string | null;
          at_seconds?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["watch_messages"]["Insert"]>;
        Relationships: [];
      };
      watch_reactions: {
        Row: {
          id: string;
          room_id: string;
          space_id: string;
          user_id: string;
          emoji: string;
          at_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          space_id: string;
          user_id: string;
          emoji: string;
          at_seconds?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["watch_reactions"]["Insert"]>;
        Relationships: [];
      };
      watch_memories: {
        Row: {
          id: string;
          space_id: string;
          room_id: string | null;
          created_by: string;
          title: string;
          subtitle: string | null;
          source_kind: WatchSourceKind;
          source_url: string | null;
          poster_url: string | null;
          watched_date: string;
          minutes: number;
          message_count: number;
          reaction_count: number;
          note: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          space_id: string;
          room_id?: string | null;
          created_by: string;
          title: string;
          subtitle?: string | null;
          source_kind: WatchSourceKind;
          source_url?: string | null;
          poster_url?: string | null;
          watched_date: string;
          minutes?: number;
          message_count?: number;
          reaction_count?: number;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["watch_memories"]["Insert"]>;
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
