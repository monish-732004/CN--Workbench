import type { TemplateId } from "./catalog";
import type { Template } from "./types";
import { bitbench } from "./templates/bitbench";
import { crc } from "./templates/crc";
import { delayline } from "./templates/delayline";
import { fib } from "./templates/fib";
import { hamming } from "./templates/hamming";
import { hexdump } from "./templates/hexdump";
import { ladder } from "./templates/ladder";
import { pinout } from "./templates/pinout";
import { slicer } from "./templates/slicer";
import { spf } from "./templates/spf";
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
};
