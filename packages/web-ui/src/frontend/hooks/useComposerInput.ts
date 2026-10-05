import { useLayoutEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

import { insertPlainText, readComposer, shouldSubmit } from "../lib/composer-dom";

export const useComposerInput = (
  value: string,
  onChange: (text: string) => void,
  onSubmit: () => void,
) => {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const update = () => {
    if (ref.current) onChange(readComposer(ref.current));
  };

  useLayoutEffect(() => {
    if (ref.current && !composing.current && readComposer(ref.current) !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      shouldSubmit(
        event.key,
        event.shiftKey,
        composing.current || event.nativeEvent.isComposing || event.keyCode === 229,
      )
    ) {
      event.preventDefault();
      onSubmit();
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (ref.current) insertPlainText(ref.current, event.clipboardData.getData("text/plain"));

    update();
  };

  return {
    ref,
    onInput: update,
    onKeyDown,
    onPaste,
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: () => {
      composing.current = false;
      update();
    },
  };
};
