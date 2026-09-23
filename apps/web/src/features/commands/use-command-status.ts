import { useCallback, useEffect, useRef, useState } from "react";
import { readCommand, type V2Command } from "../../services/api/v2";
import { COMMAND_PRESENTATION } from "./command-state";

export function useCommandStatus(onTerminal?: () => void) {
  const [command, setCommand] = useState<V2Command>();
  const [pollError, setPollError] = useState("");
  const callback = useRef(onTerminal);
  callback.current = onTerminal;
  const accept = useCallback((next: V2Command) => {
    setCommand(next);
    setPollError("");
  }, []);
  const clear = useCallback(() => {
    setCommand(undefined);
    setPollError("");
  }, []);

  useEffect(() => {
    if (!command || COMMAND_PRESENTATION[command.status].terminal) return;
    let closed = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (closed) return;
      if (!navigator.onLine || document.hidden) {
        timer = setTimeout(() => void poll(), 2_000);
        return;
      }
      try {
        const next = await readCommand(command.statusUrl);
        failures = 0;
        setPollError("");
        setCommand(next);
        if (COMMAND_PRESENTATION[next.status].terminal) callback.current?.();
        if (!COMMAND_PRESENTATION[next.status].terminal) timer = setTimeout(() => void poll(), 2_000);
      } catch (error) {
        failures += 1;
        setPollError(error instanceof Error ? error.message : "Command status is unavailable.");
        timer = setTimeout(() => void poll(), Math.min(30_000, 2_000 * (2 ** failures)));
      }
    };

    timer = setTimeout(() => void poll(), 2_000);
    return () => {
      closed = true;
      clearTimeout(timer);
    };
  }, [command?.commandId, command?.status, command?.statusUrl]);

  return { command, pollError, accept, clear };
}
