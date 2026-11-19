import type { TemplateId } from "./catalog";
import type { Template } from "./types";
import { bitbench } from "./templates/bitbench";
import { crc } from "./templates/crc";
import { delayline } from "./templates/delayline";
import { fib } from "./templates/fib";
import { form } from "./templates/form";
import { hamming } from "./templates/hamming";
import { hexdump } from "./templates/hexdump";
import { ladder } from "./templates/ladder";
import { pinout } from "./templates/pinout";
import { sequence } from "./templates/sequence";
import { slicer } from "./templates/slicer";
import { sorter } from "./templates/sorter";
import { spf } from "./templates/spf";
import { stuffing } from "./templates/stuffing";
import { table } from "./templates/table";
import { vectors } from "./templates/vectors";

export const TEMPLATES: Record<TemplateId, Template> = {
  delayline,
  pinout,
  bitbench,
  slicer,
  fib,
  spf,
  vectors,
  crc,
  hamming,
  hexdump,
  ladder,
  sorter,
  sequence,
  form,
  table,
  stuffing,
};
