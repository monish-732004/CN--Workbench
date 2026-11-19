import { toBits } from "../src/engine/net";

/** Builds the response a perfect student would send, from the server-side solution. */
export function perfectResponse(id: string, p: any, s: any, cp: string): any {
  switch (id) {
    case "delayline":
      return { prop: String(s.propUs / 1000), tx: String(s.txUs / 1000), total: String(s.totalUs / 1000), dominant: s.dominant, bdp: String(s.bdpBits) };
    case "pinout":
      return { cable: s.cable, pins: s.pins };
    case "bitbench":
      return { prefix: s.prefix, bits: toBits(cp === "network" ? s.network : s.broadcast), total: String(s.total), usable: String(s.usable) };
    case "slicer": {
      const prefixes = Object.fromEntries(s.subnets.map((x: any) => [x.id, x.prefix]));
      const blocks = Object.fromEntries(s.subnets.map((x: any) => [x.id, { offset: x.offset, prefix: x.prefix }]));
      const ranges = Object.fromEntries(s.subnets.map((x: any) => [x.id, { first: x.first, last: x.last, broadcast: x.broadcast }]));
      return { prefixes, blocks, ranges };
    }
    case "fib":
      return { out: s.out };
    case "spf":
      return { order: s.order, distances: s.dist, nexthops: s.nextHop };
    case "vectors":
      return { rows: Object.fromEntries(s.rows.map((r: any) => [r.dest, { action: r.actions[0], next: r.next, cost: r.cost }])) };
    case "crc":
      return { rows: s.steps.map((x: any) => ({ use: x.use, out: x.out })), remainder: s.remainder, codeword: s.codeword };
    case "hamming":
      if (cp === "parity") return { positions: s.parityPositions };
      if (cp === "codeword") return { bits: s.codeword };
      if (cp === "syndrome") return { bits: s.syndrome };
      if (cp === "errorpos") return { pos: s.errorPos };
      return { bits: s.dataword };
    case "hexdump":
      return {
        map: s.fields,
        values: Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, String(v)])),
        hlenBytes: s.hlenBytes,
        flags: s.flags,
        service: s.service,
        direction: s.direction,
        dataLength: s.dataLength,
        phase: s.phase,
        nextSeq: s.nextSeq,
      };
    case "ladder":
      return { rows: s.msgs.map((m: any) => ({ type: m.type, dir: m.dir, seq: String(m.seq), ack: m.ack === null ? "" : String(m.ack) })) };
    case "sorter":
      return { place: s };
    case "sequence":
      return { order: s.map((_: string, i: number) => `s${i}`) };
    case "form":
      return { values: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) };
    case "table":
      return {
        cells: Object.fromEntries(
          p.rows.map((r: any) => [r.id, Object.fromEntries(Object.entries(r.cells).filter(([, c]: any) => "answer" in c).map(([k, c]: any) => [k, String(c.answer)]))]),
        ),
      };
    case "stuffing":
      return { inserts: s.inserts, removed: s.removed };
  }
}
