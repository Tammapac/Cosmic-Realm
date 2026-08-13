import { useState } from "react";
import styles from "./ChatPanel.module.css";

/** Matches the game server's actual chat channels 1:1 (see
 *  ChatMessage["channel"] in game/types.ts and pushChat() in
 *  game/store.ts) -- "local" is the sector/general chat, "party" is the
 *  current group, "clan" is the player's clan, "system" is
 *  kill/reward/info log lines. No client-side channel mapping needed. */
export type ChatChannel = "local" | "party" | "clan" | "system";

/** System-only log entry kind -- drives the color/icon of that line.
 *  Only meaningful when channel is "system". */
export type SystemLogType = "kill" | "reward" | "info";

export type ChatMessage = {
  channel: ChatChannel;
  sender: string;
  text: string;
  time: string;
  /** Player-channel log lines (join/leave, level-up) render dimmed +
   *  italic and have no sender color. Not used on the system channel --
   *  use logType there instead. */
  system?: boolean;
  logType?: SystemLogType;
};

export type ChatPanelProps = {
  messages: ChatMessage[];
  onSend?: (channel: ChatChannel, text: string) => void;
};

const CHANNELS: { key: ChatChannel; label: string; color: string }[] = [
  { key: "local", label: "General", color: "var(--hud-cyan)" },
  { key: "party", label: "Party", color: "var(--hud-energy)" },
  { key: "clan", label: "Clan", color: "var(--hud-green)" },
  { key: "system", label: "System", color: "var(--hud-magenta)" },
];

const LOG_TYPE_COLOR: Record<SystemLogType, string> = {
  kill: "var(--hud-hp)",
  reward: "var(--hud-gold)",
  info: "var(--hud-text-dim)",
};

const LOG_TYPE_ICON: Record<SystemLogType, string> = {
  kill: "⚔",
  reward: "◎",
  info: "ℹ",
};

/**
 * ChatPanel — Formfamily G. Rectangular console anchored bottom-left,
 * same double-contour/brushed-material language as Hotbar/Minimap.
 * Channel tabs filter the message list; input row uses the same
 * "punched in" collar+glass construction as the Minimap's zone display.
 */
export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>("local");
  const [draft, setDraft] = useState("");

  const visibleMessages = messages.filter((m) => m.channel === activeChannel);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    onSend?.(activeChannel, text);
    setDraft("");
  }

  return (
    <div className={`${styles.consoleWrap} hud-interactive`}>
      <div className={`${styles.console} panel`}>
        <div className="hud-titleband">COMMS</div>

        <div className={styles.tabs}>
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${styles.tab} ${activeChannel === c.key ? styles.tabActive : ""}`}
              onClick={() => setActiveChannel(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className={styles.messageList}>
          {activeChannel === "system"
            ? visibleMessages.map((m, i) => (
                <div key={i} className={styles.logEntry}>
                  <span className={styles.messageTime}>{m.time}</span>
                  <span className={styles.logIcon} style={{ color: LOG_TYPE_COLOR[m.logType ?? "info"] }}>
                    {LOG_TYPE_ICON[m.logType ?? "info"]}
                  </span>
                  <span className={styles.logText} style={{ color: LOG_TYPE_COLOR[m.logType ?? "info"] }}>
                    {m.text}
                  </span>
                </div>
              ))
            : visibleMessages.map((m, i) => {
                const channelMeta = CHANNELS.find((c) => c.key === m.channel);
                return (
                  <div key={i} className={`${styles.message} ${m.system ? styles.messageSystem : ""}`}>
                    <span className={styles.messageTime}>{m.time}</span>
                    {!m.system && (
                      <span className={styles.messageSender} style={{ color: channelMeta?.color }}>
                        {m.sender}:
                      </span>
                    )}
                    <span className={styles.messageText}>{m.text}</span>
                  </div>
                );
              })}
        </div>

        {activeChannel !== "system" && (
          <div className={styles.inputRow}>
            <div className={styles.inputCollar}>
              <div className={styles.inputGlass}>
                <input
                  type="text"
                  className={styles.textInput}
                  placeholder={`Message ${CHANNELS.find((c) => c.key === activeChannel)?.label}...`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
              </div>
            </div>
            <button type="button" className={styles.sendButton} onClick={handleSend}>
              ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
