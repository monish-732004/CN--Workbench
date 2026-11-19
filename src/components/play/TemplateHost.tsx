"use client";

import type { ComponentType } from "react";
import type { TplProps } from "./kit";
import { BitbenchTemplate } from "./templates/Bitbench";
import { CrcTemplate } from "./templates/Crc";
import { CustomTemplate } from "./templates/Custom";
import { DelayTemplate } from "./templates/Delay";
import { FibTemplate } from "./templates/Fib";
import { FormTemplate } from "./templates/Form";
import { HammingTemplate } from "./templates/Hamming";
import { HexdumpTemplate } from "./templates/Hexdump";
import { LadderTemplate } from "./templates/Ladder";
import { PinoutTemplate } from "./templates/Pinout";
import { SequenceTemplate } from "./templates/Sequence";
import { SlicerTemplate } from "./templates/Slicer";
import { SorterTemplate } from "./templates/Sorter";
import { SpfTemplate } from "./templates/Spf";
import { StuffingTemplate } from "./templates/Stuffing";
import { TableTemplate } from "./templates/Table";
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
  sorter: SorterTemplate,
  sequence: SequenceTemplate,
  form: FormTemplate,
  table: TableTemplate,
  stuffing: StuffingTemplate,
  custom: CustomTemplate,
};

export function TemplateHost(props: TplProps & { templateId: string }) {
  const C = MAP[props.templateId];
  if (!C) return <p className="text-[13px] text-bad">Unknown question type.</p>;
  return <C {...props} />;
}
