import { Button, Slider } from "@openuidev/react-ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { drumLabProps } from "../../../shared/openui-scenarios";
import { createDrumAudio, type Voice, voices } from "./drum-audio";
import "./DrumLab.css";

const steps = Array.from({ length: 16 }, (_, index) => index);
const initialPattern = { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] };

const DrumLab = ({ title, tempo: initialTempo = 100 }: z.infer<typeof drumLabProps>) => {
  const { t } = useTranslation();
  const audio = useRef<ReturnType<typeof createDrumAudio>>(undefined);
  const [tempo, setTempo] = useState(initialTempo);
  const [swing, setSwing] = useState(0);
  const [pattern, setPattern] = useState(initialPattern);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const settings = useRef({ tempo, swing, pattern });

  useEffect(() => {
    settings.current = { tempo, swing, pattern };
  }, [tempo, swing, pattern]);

  useEffect(
    () => () => {
      const engine = audio.current;
      audio.current = undefined;
      if (engine) void engine.context.close().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    const engine = audio.current;
    if (!playing || !engine) return;
    let next = engine.context.currentTime + 0.04;
    let index = 0;
    const pending: { step: number; time: number }[] = [];
    const buttons = Array.from({ length: steps.length }, (_, step) =>
      grid.current?.querySelectorAll<HTMLButtonElement>('[data-step="' + step + '"]'),
    );
    let highlighted: number | undefined;
    const highlight = (step?: number) => {
      if (highlighted === step) return;
      if (highlighted !== undefined) {
        buttons[highlighted]?.forEach((button) => delete button.dataset.active);
      }
      if (step !== undefined) {
        buttons[step]?.forEach((button) => {
          button.dataset.active = "true";
        });
      }
      highlighted = step;
    };
    const interval = window.setInterval(() => {
      const now = engine.context.currentTime;
      if (next < now - 0.15) next = now + 0.02;
      while (next < now + 0.08) {
        const current = settings.current;
        for (const voice of voices) {
          if (current.pattern[voice].includes(index)) engine.hit(voice, next);
        }
        pending.push({ step: index, time: next });
        next += (15 / current.tempo) * (1 + ((index % 2 === 0 ? 1 : -1) * current.swing) / 100);
        index = (index + 1) % steps.length;
      }
      let active: number | undefined;
      while (pending[0] && pending[0].time <= now) active = pending.shift()?.step;
      if (active !== undefined) highlight(active);
    }, 20);
    return () => {
      window.clearInterval(interval);
      highlight();
    };
  }, [playing]);

  const startAudio = async (voice?: Voice) => {
    setBusy(true);
    try {
      const engine = (audio.current ??= createDrumAudio());
      await engine.context.resume();
      if (audio.current !== engine) return;
      setFailed(false);
      if (voice) engine.hit(voice);
      else setPlaying(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="loop-openui-drums" aria-label={title}>
      <h3>{title}</h3>
      <div className="loop-openui-slider" role="group" aria-label={t("openUi.tempo", { tempo })}>
        <p>{t("openUi.tempo", { tempo })}</p>
        <Slider
          variant="continuous"
          min={40}
          max={220}
          value={[tempo]}
          onValueChange={([next]) => {
            if (next !== undefined) setTempo(next);
          }}
        />
      </div>
      <div className="loop-openui-slider" role="group" aria-label={t("openUi.swing", { swing })}>
        <p>{t("openUi.swing", { swing })}</p>
        <Slider
          variant="continuous"
          min={0}
          max={50}
          value={[swing]}
          onValueChange={([next]) => {
            if (next !== undefined) setSwing(next);
          }}
        />
      </div>
      <div className="loop-openui-controls">
        <Button
          type="button"
          size="small"
          variant="primary"
          disabled={busy}
          onClick={() => {
            if (playing) {
              setPlaying(false);
            } else void startAudio();
          }}
        >
          {t(playing ? "openUi.stop" : "openUi.play")}
        </Button>
        {voices.map((voice) => (
          <Button
            type="button"
            size="small"
            variant="secondary"
            key={voice}
            disabled={busy}
            onClick={() => void startAudio(voice)}
          >
            {t("openUi.voices." + voice)}
          </Button>
        ))}
      </div>
      {failed && <p role="status">{t("openUi.audioUnavailable")}</p>}
      <div className="loop-openui-pattern" ref={grid}>
        {voices.map((voice) => (
          <div
            className="loop-openui-controls"
            role="group"
            aria-label={t("openUi.voices." + voice)}
            key={voice}
          >
            {steps.map((step) => (
              <Button
                type="button"
                size="extra-small"
                variant={pattern[voice].includes(step) ? "primary" : "secondary"}
                key={step}
                data-step={step}
                aria-label={t("openUi.drumStep", {
                  voice: t("openUi.voices." + voice),
                  step: step + 1,
                })}
                aria-pressed={pattern[voice].includes(step)}
                onClick={() =>
                  setPattern((current) => ({
                    ...current,
                    [voice]: current[voice].includes(step)
                      ? current[voice].filter((value) => value !== step)
                      : [...current[voice], step],
                  }))
                }
              >
                {step + 1}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default DrumLab;
