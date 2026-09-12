import React, { useEffect, useMemo, useRef, useState } from "react";
import { Notification, User } from "../types";

interface Props {
  notifications: Notification[];
  users: User[];
  onBack?: () => void;
  onProfileClick: (id: number) => void;
  onOpenNotification?: (notification: Notification) => void;
  onMarkAllAsRead?: () => Promise<any> | void;
  onDeleteNotification?: (notificationId: number) => Promise<any> | void;
  simulateApi?: boolean;
  stickyHeader?: boolean;
}

const AVATAR_SIZE = 64;
const STACK_AVATAR_SIZE = 28;
const INITIAL_EARLIER_COUNT = 10;
const LOAD_MORE_COUNT = 10;

const safeText = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getNotificationTime = (n: Notification) => {
  const updated = n.updated_at ? new Date(n.updated_at).getTime() : NaN;
  if (Number.isFinite(updated)) return updated;
  const created = n.created_at ? new Date(n.created_at).getTime() : NaN;
  if (Number.isFinite(created)) return created;
  return 0;
};

const formatTimestamp = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = Date.now();
  const diff = now - d.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const dayNum = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${month} ${dayNum} at ${hour12}:${minutes}${ampm}`;
};

const toWords = (text: string, limit = 10) => {
  const clean = safeText(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ");
  if (words.length <= limit) return clean;
  return `${words.slice(0, limit).join(" ")}...`;
};

const parseActorsJson = (value: any): number[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => safeNumber(x, 0)).filter((x) => x > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => {
            if (typeof x === "object" && x !== null) return safeNumber((x as any).id, 0);
            return safeNumber(x, 0);
          })
          .filter((x) => x > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const getStackActorIds = (n: Notification): number[] => {
  const ids = parseActorsJson(n.actors_json);
  const latestActorId = safeNumber(n.actor_id, 0);

  const ordered = [latestActorId, ...ids].filter((x) => x > 0);
  const deduped: number[] = [];

  ordered.forEach((id) => {
    if (!deduped.includes(id)) deduped.push(id);
  });

  return deduped.slice(0, 3);
};

const getReactionEmoji = (n: Notification) => {
  const type = safeText(n.type).toLowerCase();
  const reactionType = safeText((n as any).reaction_type).toLowerCase();
  const rawMessage = safeText(n.message).toLowerCase();

  const source = `${reactionType} ${rawMessage} ${type}`;

  if (source.includes("love") || source.includes("heart")) return "❤️";
  if (source.includes("haha") || source.includes("laugh")) return "😂";
  if (source.includes("wow")) return "😮";
  if (source.includes("sad")) return "😢";
  if (source.includes("angry")) return "😡";
  if (source.includes("fire")) return "🔥";
  if (source.includes("party")) return "🎉";
  if (source.includes("clap")) return "👏";
  if (source.includes("like") || source.includes("react") || source.includes("reaction")) return "👍";

  return "";
};

const getReactionEmojiCluster = (n: Notification): string[] => {
  const primary = getReactionEmoji(n);
  if (!primary) return [];

  const lower = `${safeText((n as any).reaction_type).toLowerCase()} ${safeText(n.message).toLowerCase()}`;

  if (lower.includes("love") && lower.includes("fire")) return ["❤️", "🔥", "👍"];
  if (lower.includes("love")) return ["❤️", "👍"];
  if (lower.includes("haha")) return ["😂", "👍"];
  if (lower.includes("fire")) return ["🔥", "👍"];
  if (lower.includes("wow")) return ["😮", "👍"];

  return [primary];
};

// UPDATED: New badge function with song, podcast, story, event support
const getNotificationBadge = (n: Notification) => {
  const type = safeText(n.type).toLowerCase();
  const entityType = safeText(n.entity_type || (n as any).target_type || "").toLowerCase();
  const reactionEmoji = getReactionEmoji(n);

  if (reactionEmoji) {
    return { kind: "emoji" as const, value: reactionEmoji, bg: "#0B1120" };
  }

  if (type.includes("discuss") || type.includes("comment") || type.includes("reply")) {
    return { kind: "icon" as const, value: "fas fa-comment", bg: "#10B981" };
  }

  if (type.includes("follow")) {
    return { kind: "icon" as const, value: "fas fa-user-plus", bg: "#1877F2" };
  }

  if (type.includes("share")) {
    return { kind: "icon" as const, value: "fas fa-share", bg: "#1877F2" };
  }

  if (type.includes("birthday")) {
    return { kind: "emoji" as const, value: "🎂", bg: "#0B1120" };
  }

  if (entityType === "song") {
    return { kind: "icon" as const, value: "fas fa-music", bg: "#1877F2" };
  }

  if (entityType === "podcast") {
    return { kind: "icon" as const, value: "fas fa-microphone", bg: "#2563EB" };
  }

  if (entityType === "story") {
    return { kind: "icon" as const, value: "fas fa-bolt", bg: "#38BDF8" };
  }

  if (entityType === "event" || type === "event") {
    return { kind: "icon" as const, value: "fas fa-calendar-alt", bg: "#2563EB" };
  }

  if (entityType === "group_post" || entityType === "group" || type.includes("group")) {
    return { kind: "icon" as const, value: "fas fa-users", bg: "#38BDF8" };
  }

  if (entityType === "product" || type.includes("product") || type.includes("marketplace")) {
    return { kind: "icon" as const, value: "fas fa-shopping-bag", bg: "#1877F2" };
  }

  if (entityType === "reel") {
    return { kind: "icon" as const, value: "fas fa-video", bg: "#F43F5E" };
  }

  return { kind: "icon" as const, value: "fas fa-bell", bg: "#1877F2" };
};

// UPDATED: New message builder with full content type support
const buildNotificationMessageParts = (n: Notification) => {
  const type = safeText(n.type).toLowerCase();
  const entityType = safeText(n.entity_type || (n as any).target_type || "").toLowerCase();
  const rawMessage = safeText(n.message || "").trim();
  const actorsCount = Math.max(1, safeNumber((n as any).actors_count, 1));
  const othersCount = Math.max(0, actorsCount - 1);
  const reactionType = safeText((n as any).reaction_type).toLowerCase();
  const othersText = othersCount > 0 ? ` and ${othersCount} others` : "";

  const targetLabel = 
    entityType === "post" ? "your post" :
    entityType === "reel" ? "your reel" :
    entityType === "story" ? "your story" :
    entityType === "song" ? "your song" :
    entityType === "podcast" ? "your podcast" :
    entityType === "product" ? "your product" :
    entityType === "group_post" ? "your group post" :
    entityType === "event" ? "your event" :
    entityType === "comment" ? "your Discuss" :
    entityType === "group" ? "your group" :
    entityType === "profile" ? "you" :
    "your content";

  const reactionVerb = (() => {
    const source = `${reactionType} ${rawMessage}`.toLowerCase();
    if (source.includes("love")) return "loved";
    if (source.includes("haha") || source.includes("laugh")) return "laughed at";
    if (source.includes("wow")) return "were amazed by";
    if (source.includes("sad")) return "felt sad about";
    if (source.includes("angry")) return "felt angry about";
    if (source.includes("fire")) return "fired up";
    if (source.includes("party")) return "celebrated";
    if (source.includes("clap")) return "applauded";
    if (source.includes("star")) return "starred";
    if (source.includes("heart-eyes") || source.includes("heart_eyes")) return "reacted heart-eyes to";
    if (source.includes("rocket")) return "rocketed";
    if (source.includes("trophy")) return "awarded";
    if (source.includes("crown")) return "crowned";
    return "reacted to";
  })();

  if (type === "react" || type === "reaction" || type === "like") {
    return {
      middle: `${othersText} ${reactionVerb} ${targetLabel}`.trim(),
      cta: "See reactions.",
    };
  }

  if (type === "discuss" || type === "comment") {
    return {
      middle: `${othersText} discussed ${targetLabel}`.trim(),
      cta: othersCount > 0 ? "Join their Discuss." : "Join the Discuss.",
    };
  }

  if (type === "reply") {
    return {
      middle: `${othersText} replied in Discuss`.trim(),
      cta: "Join the conversation.",
    };
  }

  if (type === "share") {
    return {
      middle: `${othersText} shared ${targetLabel}`.trim(),
      cta: "View shares.",
    };
  }

  if (type === "follow") {
    return {
      middle: `${othersText} followed you`.trim(),
      cta: "Keep creating great content.",
    };
  }

  if (type === "birthday") {
    return {
      middle: rawMessage || "has a birthday today",
      cta: "Wish them now.",
    };
  }

  if (type === "event") {
    const lower = rawMessage.toLowerCase();
    if (lower.includes("is going to your event")) {
      return {
        middle: `${othersText} is going to your event`.trim(),
        cta: "View event.",
      };
    }
    if (lower.includes("is interested in your event")) {
      return {
        middle: `${othersText} is interested in your event`.trim(),
        cta: "View event.",
      };
    }
    return {
      middle: rawMessage || "interacted with your event",
      cta: "View details.",
    };
  }

  if (type === "group_request") {
    const lower = rawMessage.toLowerCase();
    if (lower.includes("joined your group")) {
      return {
        middle: `${othersText} joined your group`.trim(),
        cta: "Open group.",
      };
    }
    return {
      middle: rawMessage || "requested to join your group",
      cta: "Review request.",
    };
  }

  if (type === "group_invite") {
    return {
      middle: rawMessage || "invited you to a group",
      cta: "View invitation.",
    };
  }

  if (type === "group_approved") {
    return {
      middle: rawMessage || "approved your group request",
      cta: "Open group.",
    };
  }

  if (type === "group_declined") {
    return {
      middle: rawMessage || "declined your group request",
      cta: "See details.",
    };
  }

  if (type === "group_post") {
    return {
      middle: rawMessage || "posted in your group",
      cta: "Join the Discuss.",
    };
  }

  if (type === "mention") {
    return {
      middle: `${othersText} mentioned you`.trim(),
      cta: "See mention.",
    };
  }

  if (type === "tag") {
    return {
      middle: `${othersText} tagged you`.trim(),
      cta: "Open now.",
    };
  }

  if (type === "product_interest" || type === "marketplace") {
    return {
      middle: rawMessage || `showed interest in ${targetLabel}`,
      cta: "View details.",
    };
  }

  if (
    type === "system" ||
    type === "admin" ||
    type === "security" ||
    type === "warning" ||
    type === "info"
  ) {
    return {
      middle: rawMessage || "sent you an update",
      cta: "",
    };
  }

  return {
    middle: rawMessage || "interacted with you",
    cta: "",
  };
};

// NEW: Helper functions for target routing
const getNotificationTargetType = (n: Notification) => 
  safeText((n as any).target_type || n.entity_type || "").toLowerCase();

const getNotificationTargetId = (n: Notification) => 
  safeNumber((n as any).target_id ?? (n as any).entity_id, 0);

const NotificationStackedAvatars: React.FC<{
  notification: Notification;
  users: User[];
  onProfileClick: (id: number) => void;
}> = ({ notification, users, onProfileClick }) => {
  const actorIds = getStackActorIds(notification);
  const totalCount = Math.max(1, safeNumber(notification.actors_count, 1));

  const actors = actorIds
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as User[];

  if (actors.length <= 1 && totalCount <= 1) return null;

  const extra = Math.max(0, totalCount - actors.length);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginTop: 8,
      }}
    >
      {actors.map((user, index) => (
        <button
          key={user.id}
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(user.id);
          }}
          aria-label={user.name || `User ${user.id}`}
          title={user.name || ""}
          style={{
            width: STACK_AVATAR_SIZE,
            height: STACK_AVATAR_SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid #0F172A",
            marginLeft: index === 0 ? 0 : -9,
            padding: 0,
            background: "#1E293B",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
          }}
        >
          <img
            src={safeText(user.profile_image_url, "https://via.placeholder.com/100?text=User")}
            alt={user.name || "User"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </button>
      ))}

      {extra > 0 && (
        <div
          style={{
            marginLeft: actors.length > 0 ? -9 : 0,
            minWidth: 30,
            height: STACK_AVATAR_SIZE,
            borderRadius: 999,
            padding: "0 8px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1E293B",
            border: "2px solid #0F172A",
            color: "#94A3B8",
            fontSize: 11,
            fontWeight: 800,
            boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};

const NotificationReactionCluster: React.FC<{ notification: Notification }> = ({ notification }) => {
  const emojis = getReactionEmojiCluster(notification);
  if (emojis.length === 0) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "3px 7px",
        borderRadius: 999,
        background: "#1E293B",
        border: "1px solid #334155",
      }}
    >
      {emojis.slice(0, 3).map((emoji, i) => (
        <span key={`${emoji}-${i}`} style={{ fontSize: 13, lineHeight: 1 }}>
          {emoji}
        </span>
      ))}
    </div>
  );
};

export const NotificationsPage: React.FC<Props> = ({
  notifications,
  users,
  onBack,
  onProfileClick,
  onOpenNotification,
  onMarkAllAsRead,
  onDeleteNotification,
  simulateApi = false,
  stickyHeader = false,
}) => {
  useEffect(() => {
    const id = "np-roboto-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const getUser = (id?: number) => users.find((u) => u.id === id);

  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [earlierVisibleCount, setEarlierVisibleCount] = useState(INITIAL_EARLIER_COUNT);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setLocalNotifications(Array.isArray(notifications) ? notifications : []);
    setEarlierVisibleCount(INITIAL_EARLIER_COUNT);
  }, [notifications]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuOpenId == null) return;
      const el = menuRefs.current[menuOpenId];
      if (el && !el.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpenId]);

  const unreadCount = useMemo(
    () => localNotifications.filter((n) => !safeNumber(n.is_read, 0)).length,
    [localNotifications]
  );

  const sortedNotifications = useMemo(() => {
    return [...localNotifications].sort((a, b) => {
      const ta = getNotificationTime(a);
      const tb = getNotificationTime(b);
      if (tb !== ta) return tb - ta;
      return safeNumber(b.id, 0) - safeNumber(a.id, 0);
    });
  }, [localNotifications]);

  const { newNotifications, earlierNotifications } = useMemo(() => {
    const now = Date.now();
    const threshold = 48 * 60 * 60 * 1000;

    const newN: Notification[] = [];
    const earlierN: Notification[] = [];

    sortedNotifications.forEach((n) => {
      const t = getNotificationTime(n);
      if (Number.isFinite(t) && now - t <= threshold) newN.push(n);
      else earlierN.push(n);
    });

    return { newNotifications: newN, earlierNotifications: earlierN };
  }, [sortedNotifications]);

  const visibleEarlierNotifications = useMemo(
    () => earlierNotifications.slice(0, earlierVisibleCount),
    [earlierNotifications, earlierVisibleCount]
  );

  const hasMoreEarlier = visibleEarlierNotifications.length < earlierNotifications.length;

  const showToast = (type: "error" | "success", text: string, ms = 3000) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), ms);
  };

  const handleMarkAllAsRead = async () => {
    if (isProcessing || unreadCount === 0) return;

    const snapshot = localNotifications.map((n) => ({ ...n }));
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setIsProcessing(true);

    try {
      if (onMarkAllAsRead) {
        const result = onMarkAllAsRead();
        if (result && typeof (result as Promise<any>).then === "function") {
          await result;
        }
      } else if (simulateApi) {
        await new Promise((res) => setTimeout(res, 700));
      }

      showToast("success", "All notifications marked as read");
    } catch (err) {
      setLocalNotifications(snapshot);
      console.error("Mark all as read failed:", err);
      showToast("error", "Failed to mark all as read");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadMoreEarlier = () => {
    const currentScrollY = window.scrollY;
    setEarlierVisibleCount((prev) => prev + LOAD_MORE_COUNT);

    requestAnimationFrame(() => {
      window.scrollTo({ top: currentScrollY, behavior: "auto" });
    });
  };

  const handleDeleteNotification = async (notificationId: number) => {
    if (!notificationId || deletingId === notificationId) return;

    const snapshot = localNotifications;
    setDeletingId(notificationId);
    setMenuOpenId(null);
    setLocalNotifications((prev) => prev.filter((n) => safeNumber(n.id, 0) !== notificationId));

    try {
      if (onDeleteNotification) {
        const result = onDeleteNotification(notificationId);
        if (result && typeof (result as Promise<any>).then === "function") {
          await result;
        }
      } else if (simulateApi) {
        await new Promise((res) => setTimeout(res, 500));
      }

      showToast("success", "Notification deleted");
    } catch (err) {
      console.error("Delete notification failed:", err);
      setLocalNotifications(snapshot);
      showToast("error", "Failed to delete notification");
    } finally {
      setDeletingId(null);
    }
  };

  // UPDATED: New open handler with target_type + target_id routing
  const handleOpenNotification = (n: Notification) => {
    if (onOpenNotification) {
      onOpenNotification(n);
      return;
    }

    const targetType = getNotificationTargetType(n);
    const targetId = getNotificationTargetId(n);

    if (targetType && targetId) {
      // local fallback only if parent didn't pass routing handler
      // since this component itself cannot open feed/reel/story/song/etc
      // fallback to actor profile when no parent routing exists
      const actorId = safeNumber(n.actor_id, 0);
      if (actorId) onProfileClick(actorId);
      return;
    }

    const actorId = safeNumber(n.actor_id, 0);
    if (actorId) onProfileClick(actorId);
  };

  const renderRow = (n: Notification) => {
    const actor = getUser(n.actor_id);
    const actorName = safeText(actor?.name, "Someone");
    const avatar = safeText(actor?.profile_image_url, "https://via.placeholder.com/100?text=User");
    const isUnread = !safeNumber(n.is_read, 0);
    const notificationId = safeNumber(n.id, 0);
    const badge = getNotificationBadge(n);
    const displayTime = safeText(n.updated_at) || safeText(n.created_at);
    const previewText = toWords(
      safeText((n as any).preview_text || (n as any).content_preview || (n as any).preview_title || ""),
      10
    );
    const previewImage = safeText((n as any).preview_image || "");
    const messageParts = buildNotificationMessageParts(n);
    const hasStack = getStackActorIds(n).length > 1 || safeNumber(n.actors_count, 1) > 1;

    return (
      <div
        key={notificationId}
        className={`flex items-start gap-3.5 p-3.5 sm:p-4 border-b border-[#1E293B] last:border-b-0 transition-colors ${
          isUnread
            ? "bg-[#1877F2]/[0.08] hover:bg-[#1877F2]/[0.12] border-l-4 border-l-[#1877F2]"
            : "hover:bg-[#141E33] border-l-4 border-l-transparent"
        }`}
      >
        <div
          className="flex-shrink-0 relative cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(actor?.id || 0);
          }}
        >
          <img
            src={avatar}
            alt={actorName}
            className="w-14 h-14 rounded-full object-cover bg-[#1E293B] border border-[#1E293B] shadow-sm"
          />

          <div
            className="absolute -right-1 -bottom-1 min-w-[24px] h-[24px] rounded-full flex items-center justify-center border-2 border-[#0F172A] shadow-md px-1"
            style={{ background: badge.bg }}
          >
            {badge.kind === "emoji" ? (
              <span className="text-xs leading-none">{badge.value}</span>
            ) : (
              <i className={`${badge.value} text-[10px] text-white leading-none`} />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleOpenNotification(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenNotification(n);
              }
            }}
            className="text-[15px] leading-snug text-[#F8FAFC] break-words cursor-pointer"
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                onProfileClick(actor?.id || 0);
              }}
              className="font-bold text-[#F8FAFC] hover:text-[#1877F2] transition-colors cursor-pointer"
            >
              {actorName}
            </span>

            {safeNumber(n.actors_count, 1) > 1 && (
              <span className="font-bold text-[#F8FAFC]">
                {messageParts.middle.startsWith(" and") ? "" : ""}
              </span>
            )}

            <span className="font-medium text-[#CBD5E1]">
              {" "}
              {messageParts.middle}
            </span>

            {messageParts.cta && (
              <span className="font-bold text-[#38BDF8]">
                {" "}
                {messageParts.cta}
              </span>
            )}
          </div>

          {hasStack && (
            <NotificationStackedAvatars
              notification={n}
              users={users}
              onProfileClick={onProfileClick}
            />
          )}

          {(previewText || previewImage) && (
            <div
              onClick={() => handleOpenNotification(n)}
              className="mt-2.5 flex items-center gap-2.5 max-w-full bg-[#070D1D] hover:bg-[#141E33] border border-[#1E293B] hover:border-[#1877F2]/40 rounded-xl p-2.5 text-[#94A3B8] text-xs transition-colors cursor-pointer"
            >
              {previewImage && (
                <img
                  src={previewImage}
                  alt="preview"
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-[#0B1120]"
                />
              )}
              {previewText && (
                <div className="min-w-0">
                  <span className="mr-1 text-[#64748B]">“</span>
                  <span className="text-[#94A3B8]">{previewText}</span>
                  <span className="ml-1 text-[#64748B]">”</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs ${
                isUnread ? "text-[#1877F2] font-semibold" : "text-[#64748B] font-medium"
              }`}
            >
              {formatTimestamp(displayTime)}
            </span>

            <NotificationReactionCluster notification={n} />

            {isUnread && (
              <span
                aria-hidden
                className="w-2 h-2 rounded-full bg-[#1877F2] shadow-[0_0_8px_rgba(24,119,242,0.6)] inline-block flex-shrink-0"
              />
            )}
          </div>
        </div>

        <div
          ref={(el) => {
            menuRefs.current[notificationId] = el;
          }}
          className="relative flex-shrink-0"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId((prev) => (prev === notificationId ? null : notificationId));
            }}
            aria-label="Notification menu"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] transition-colors"
          >
            <i className="fas fa-ellipsis-h text-sm" />
          </button>

          {menuOpenId === notificationId && (
            <div className="absolute right-0 top-9 min-w-[190px] bg-[#0B1120] border border-[#1E293B] rounded-xl shadow-2xl p-1 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNotification(notificationId);
                }}
                disabled={deletingId === notificationId}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-trash-alt text-xs" />
                <span>{deletingId === notificationId ? "Deleting..." : "Delete notification"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const newCount = newNotifications.length;
  const earlierCount = earlierNotifications.length;

  return (
    <section className="w-full max-w-3xl mx-auto py-3 px-2 sm:px-4 text-[#F8FAFC]">
      <div
        className={`bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-sm overflow-hidden mb-4 ${
          stickyHeader ? "sticky top-16 z-20" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3 p-4 bg-[#0B1120]/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="w-10 h-10 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center transition-colors flex-shrink-0"
              >
                <i className="fas fa-arrow-left text-sm" />
              </button>
            )}
            <h2 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
              Notifications
            </h2>
          </div>

          <button
            onClick={handleMarkAllAsRead}
            disabled={isProcessing || unreadCount === 0}
            aria-label="Mark all as read"
            title="Mark all as read"
            className={`h-9 px-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
              isProcessing || unreadCount === 0
                ? "bg-[#0F172A] border-[#1E293B] text-[#64748B] opacity-50 cursor-not-allowed"
                : "bg-[#1877F2] hover:bg-[#166FE5] border-[#1877F2] text-white shadow-sm cursor-pointer"
            }`}
          >
            <i className="fas fa-check text-xs" />
            <span className="hidden sm:inline">Mark all as read</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {newNotifications.length > 0 && (
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0B1120]/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">New</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/30">
                  {newCount}
                </span>
              </div>
            </div>
            <div>{newNotifications.map(renderRow)}</div>
          </div>
        )}

        {visibleEarlierNotifications.length > 0 && (
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0B1120]/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Earlier</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#1E293B] text-[#94A3B8]">
                  {earlierCount}
                </span>
              </div>
            </div>

            <div>{visibleEarlierNotifications.map(renderRow)}</div>

            {hasMoreEarlier && (
              <div className="p-3 bg-[#0B1120]/30 border-t border-[#1E293B]">
                <button
                  onClick={handleLoadMoreEarlier}
                  className="w-full py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#141E33] border border-[#1E293B] hover:border-[#1877F2]/50 text-[#F8FAFC] text-sm font-semibold transition-all shadow-sm"
                >
                  See previous notifications
                </button>
              </div>
            )}
          </div>
        )}

        {localNotifications.length === 0 && (
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-12 text-center text-[#94A3B8]">
            <div className="w-16 h-16 rounded-full bg-[#141E33] border border-[#1E293B] flex items-center justify-center mx-auto mb-3 text-[#1877F2] text-2xl">
              <i className="fas fa-bell-slash" />
            </div>
            <p className="text-base font-semibold text-[#F8FAFC]">No notifications yet</p>
            <p className="text-xs text-[#64748B] mt-1">We'll let you know when something arrives</p>
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-2xl border flex items-center gap-2 ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-800 text-rose-200"
              : "bg-[#0B1120] border-[#1877F2] text-[#F8FAFC]"
          }`}
        >
          {toast.text}
        </div>
      )}
    </section>
  );
};

export default NotificationsPage;
