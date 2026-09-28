import { describe, expect, it } from "vitest";
import {
  bucketOf,
  dueLabel,
  groupTasks,
  isFullyComplete,
  nextOccurrence,
  reminderDateFor,
  taskStatus,
  upcomingTasks,
  type TaskLike,
} from "@/lib/tasks/logic";

const ME = "me-id";
const HER = "her-id";
const MEMBERS = [ME, HER];
const TODAY = "2026-09-28";

function task(partial: Partial<TaskLike> & { id: string }): TaskLike {
  return {
    dueDate: TODAY,
    dueTime: null,
    startedAt: null,
    assignedTo: ME,
    completedBy: [],
    ...partial,
  };
}

describe("completion", () => {
  it("a solo task is done when its assignee ticks it", () => {
    const t = task({ id: "a", assignedTo: ME, completedBy: [ME] });
    expect(isFullyComplete(t, MEMBERS)).toBe(true);
  });

  it("the partner ticking someone else's solo task doesn't complete it", () => {
    const t = task({ id: "a", assignedTo: ME, completedBy: [HER] });
    expect(isFullyComplete(t, MEMBERS)).toBe(false);
  });

  it("a shared task needs both of us", () => {
    const one = task({ id: "b", assignedTo: null, completedBy: [ME] });
    expect(isFullyComplete(one, MEMBERS)).toBe(false);
    const both = task({ id: "b", assignedTo: null, completedBy: [ME, HER] });
    expect(isFullyComplete(both, MEMBERS)).toBe(true);
  });
});

describe("status", () => {
  it("is overdue once the day has passed, and never disappears", () => {
    const t = task({ id: "a", dueDate: "2026-09-27" });
    expect(taskStatus(t, MEMBERS, TODAY)).toBe("overdue");
    expect(bucketOf(t, MEMBERS, TODAY)).toBe("overdue");
  });

  it("a completed thing is completed even if it was late", () => {
    const t = task({ id: "a", dueDate: "2026-09-01", completedBy: [ME] });
    expect(taskStatus(t, MEMBERS, TODAY)).toBe("completed");
  });

  it("marks in-progress once someone has started", () => {
    const t = task({ id: "a", dueDate: "2026-09-30", startedAt: "2026-09-28T10:00:00Z" });
    expect(taskStatus(t, MEMBERS, TODAY)).toBe("in-progress");
  });
});

describe("buckets", () => {
  it("splits today / tomorrow / this week / later", () => {
    expect(bucketOf(task({ id: "a", dueDate: TODAY }), MEMBERS, TODAY)).toBe("today");
    expect(bucketOf(task({ id: "b", dueDate: "2026-09-29" }), MEMBERS, TODAY)).toBe(
      "tomorrow",
    );
    expect(bucketOf(task({ id: "c", dueDate: "2026-10-05" }), MEMBERS, TODAY)).toBe(
      "this-week",
    );
    expect(bucketOf(task({ id: "d", dueDate: "2026-10-20" }), MEMBERS, TODAY)).toBe(
      "later",
    );
  });

  it("groups in reading order and sorts each group", () => {
    const groups = groupTasks(
      [
        task({ id: "later", dueDate: "2026-10-20" }),
        task({ id: "late", dueDate: "2026-09-20" }),
        task({ id: "today-late", dueDate: TODAY, dueTime: "20:00" }),
        task({ id: "today-early", dueDate: TODAY, dueTime: "08:00" }),
        task({ id: "done", completedBy: [ME] }),
      ],
      MEMBERS,
      TODAY,
    );
    expect(groups.map((g) => g.bucket)).toEqual(["overdue", "today", "later", "completed"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["today-early", "today-late"]);
  });

  it("upcoming leaves out what's already done", () => {
    const list = upcomingTasks(
      [
        task({ id: "done", completedBy: [ME] }),
        task({ id: "soon", dueDate: "2026-09-29" }),
        task({ id: "now", dueDate: TODAY }),
      ],
      MEMBERS,
      TODAY,
    );
    expect(list.map((t) => t.id)).toEqual(["now", "soon"]);
  });
});

describe("labels and reminders", () => {
  it("speaks in days, gently", () => {
    expect(dueLabel(TODAY, TODAY)).toBe("Today");
    expect(dueLabel("2026-09-29", TODAY)).toBe("Tomorrow");
    expect(dueLabel("2026-09-27", TODAY)).toBe("Yesterday");
    expect(dueLabel("2026-10-01", TODAY)).toBe("In 3 days");
    expect(dueLabel("2026-11-30", TODAY)).toBe("Nov 30");
  });

  it("places a reminder the right number of days before the due date", () => {
    expect(reminderDateFor("2026-09-30", 0)).toBe("2026-09-30");
    expect(reminderDateFor("2026-09-30", 1)).toBe("2026-09-29");
    expect(reminderDateFor("2026-09-30", 7)).toBe("2026-09-23");
  });

  it("repeats without drifting past the end of a short month", () => {
    expect(nextOccurrence("2026-09-30", "daily")).toBe("2026-10-01");
    expect(nextOccurrence("2026-09-30", "weekly")).toBe("2026-10-07");
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextOccurrence("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(nextOccurrence("2026-09-30", "none")).toBeNull();
  });
});
