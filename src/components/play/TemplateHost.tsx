"use client";

import type { ComponentType } from "react";
import type { TplProps } from "./kit";
import { BitbenchTemplate } from "./templates/Bitbench";
import { CrcTemplate } from "./templates/Crc";
import { DelayTemplate } from "./templates/Delay";
import { FibTemplate } from "./templates/Fib";
import { HammingTemplate } from "./templates/Hamming";
import { HexdumpTemplate } from "./templates/Hexdump";
import { LadderTemplate } from "./templates/Ladder";
import { PinoutTemplate } from "./templates/Pinout";
import { SlicerTemplate } from "./templates/Slicer";
import { SpfTemplate } from "./templates/Spf";
import { VectorsTemplate } from "./templates/Vectors";

const MAP: Record<string, ComponentType<TplProps<any, any>>> = {
  delayline: DelayTemplate,
  pinout: PinoutTemplate,
  bitbench: BitbenchTemplate,
  slicer: SlicerTemplate,
  fib: FibTemplate,
  spf: SpfTemplate,
  vectors: VectorsTemplate,
  crc: CrcTemplate,
  hamming: HammingTemplate,
  hexdump: HexdumpTemplate,
  ladder: LadderTemplate,
};

export function TemplateHost(props: TplProps & { templateId: string }) {
  const C = MAP[props.templateId];
  if (!C) return <p className="text-[13px] text-bad">Unknown question type.</p>;
  return <C {...props} />;
}
